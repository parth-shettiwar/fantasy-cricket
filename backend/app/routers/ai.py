from collections import Counter, defaultdict
from datetime import datetime, timedelta
import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import (
    Match, MatchStatus, Player, PlayerMatchPerformance, PlayerRole, User,
    MatchCondition, PlayerFeatureSnapshot, AIRecommendationFeedback,
)
from app.routers.auth import get_current_user
from app.services.points_engine import calculate_player_points
from app.schemas import AIFeedbackRequest

router = APIRouter()

MAX_CREDITS = 100.0
ROLE_CONSTRAINTS = {
    PlayerRole.WK: (1, 4),
    PlayerRole.BAT: (1, 6),
    PlayerRole.AR: (1, 4),
    PlayerRole.BOWL: (1, 6),
}
ROLE_BASELINE = {
    PlayerRole.WK: 26.0,
    PlayerRole.BAT: 28.0,
    PlayerRole.AR: 32.0,
    PlayerRole.BOWL: 27.0,
}

_CACHE: dict[str, dict] = {}
_CACHE_TTL_SECONDS = 600


def _is_valid_team(players: list[Player], match: Match) -> bool:
    if len(players) != 11:
        return False
    if sum(p.credits for p in players) > MAX_CREDITS:
        return False

    role_counts = Counter(p.role for p in players)
    for role, (min_c, max_c) in ROLE_CONSTRAINTS.items():
        count = role_counts.get(role, 0)
        if count < min_c or count > max_c:
            return False

    team_counts = Counter(p.team_id for p in players)
    if any(c > 7 for c in team_counts.values()):
        return False

    valid_team_ids = {match.team1_id, match.team2_id}
    return all(p.team_id in valid_team_ids for p in players)


def _cache_get(key: str):
    row = _CACHE.get(key)
    if not row:
        return None
    if datetime.utcnow() > row["expires_at"]:
        _CACHE.pop(key, None)
        return None
    return row["value"]


def _cache_set(key: str, value: dict):
    _CACHE[key] = {
        "value": value,
        "expires_at": datetime.utcnow() + timedelta(seconds=_CACHE_TTL_SECONDS),
    }


def _refresh_feature_snapshots(db: Session, player_ids: list[int]):
    perfs = (
        db.query(PlayerMatchPerformance)
        .options(joinedload(PlayerMatchPerformance.match), joinedload(PlayerMatchPerformance.player))
        .filter(PlayerMatchPerformance.player_id.in_(player_ids))
        .all()
    )
    rows = defaultdict(list)
    for perf in perfs:
        if not perf.match or not perf.player:
            continue
        rows[(perf.player_id, perf.match.date.year)].append(perf)

    for (pid, season), samples in rows.items():
        if season < datetime.utcnow().year - 5:
            continue
        existing = (
            db.query(PlayerFeatureSnapshot)
            .filter(PlayerFeatureSnapshot.player_id == pid, PlayerFeatureSnapshot.season == season)
            .first()
        )
        if not existing:
            existing = PlayerFeatureSnapshot(player_id=pid, season=season)
            db.add(existing)

        pts = []
        bat = []
        bowl = []
        field = []
        for perf in samples:
            p = calculate_player_points(perf, perf.player.role)
            pts.append(p["total_points"])
            bat.append(p["batting_points"])
            bowl.append(p["bowling_points"])
            field.append(p["fielding_points"])
        n = len(pts)
        if n == 0:
            continue
        avg = sum(pts) / n
        existing.matches = n
        existing.fantasy_avg = avg
        existing.batting_avg = sum(bat) / n
        existing.bowling_avg = sum(bowl) / n
        existing.fielding_avg = sum(field) / n
        existing.vs_spin_index = 1.0 + min(max((existing.batting_avg - 8.0) / 40.0, -0.2), 0.2)
        existing.vs_pace_index = 1.0 + min(max((existing.bowling_avg - 8.0) / 40.0, -0.2), 0.2)
        existing.venue_index = 1.0
        existing.consistency_index = 0.85 if n < 5 else 1.0

    db.commit()


def _pitch_role_multiplier(pitch_type: str, role: PlayerRole) -> float:
    pitch_type = pitch_type or "balanced"
    if pitch_type == "batting":
        return 1.12 if role in (PlayerRole.BAT, PlayerRole.WK) else 0.95 if role == PlayerRole.BOWL else 1.04
    if pitch_type == "spin":
        return 1.10 if role in (PlayerRole.BOWL, PlayerRole.AR) else 0.97
    if pitch_type == "pace":
        return 1.08 if role in (PlayerRole.BOWL, PlayerRole.AR) else 0.98
    return 1.0


def _best_c_vc(selected_ids: set[int], proj: dict[int, float]) -> tuple[int, int]:
    ordered = sorted(selected_ids, key=lambda pid: proj.get(pid, 0.0), reverse=True)
    if len(ordered) < 2:
        return ordered[0], ordered[0]
    return ordered[0], ordered[1]


def _team_total_with_cvc(selected_ids: set[int], captain_id: int, vice_captain_id: int, proj: dict[int, float]) -> float:
    total = 0.0
    for pid in selected_ids:
        p = proj.get(pid, 0.0)
        if pid == captain_id:
            total += p * 2.0
        elif pid == vice_captain_id:
            total += p * 1.5
        else:
            total += p
    return total


@router.post("/recommend/swap")
def recommend_one_swap(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Suggest one legal swap for a given team draft.
    Payload:
      match_id, player_ids[11], captain_id, vice_captain_id
    """
    _ = current_user  # endpoint is personalized/auth-protected
    match_id = payload.get("match_id")
    player_ids = payload.get("player_ids") or []
    captain_id = payload.get("captain_id")
    vice_captain_id = payload.get("vice_captain_id")

    if not match_id:
        raise HTTPException(status_code=400, detail="match_id is required")
    if len(player_ids) != 11:
        raise HTTPException(status_code=400, detail="Need exactly 11 selected players")
    if captain_id not in player_ids or vice_captain_id not in player_ids or captain_id == vice_captain_id:
        raise HTTPException(status_code=400, detail="Invalid captain/vice-captain selection")

    match = (
        db.query(Match)
        .options(joinedload(Match.team1), joinedload(Match.team2))
        .filter(Match.id == match_id)
        .first()
    )
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    if match.status != MatchStatus.UPCOMING:
        raise HTTPException(status_code=400, detail="Recommendations are for upcoming matches only")
    if datetime.utcnow() > match.lock_time:
        raise HTTPException(status_code=400, detail="Team selection is locked for this match")

    cond = db.query(MatchCondition).filter(MatchCondition.match_id == match_id).first()
    pitch_type = cond.pitch_type if cond else "balanced"
    dew_factor = cond.dew_factor if cond else 0.0
    cache_key = f"{match_id}:{sorted(player_ids)}:{captain_id}:{vice_captain_id}:{pitch_type}:{dew_factor}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return {**cached, "cache_hit": True, "cache_ttl_seconds": _CACHE_TTL_SECONDS}

    selected = db.query(Player).filter(Player.id.in_(player_ids)).all()
    if len(selected) != len(set(player_ids)):
        raise HTTPException(status_code=400, detail="One or more player IDs are invalid")
    if not _is_valid_team(selected, match):
        raise HTTPException(status_code=400, detail="Current team does not pass constraints")

    selected_ids = {p.id for p in selected}
    pool = (
        db.query(Player)
        .filter(
            Player.team_id.in_([match.team1_id, match.team2_id]),
            ~Player.id.in_(selected_ids),
        )
        .all()
    )
    all_players = selected + pool

    # One-time / periodic feature snapshots for the current pool (supports 5-season store).
    _refresh_feature_snapshots(db, [p.id for p in all_players])

    all_player_ids = list(selected_ids | {p.id for p in pool})
    perf_rows = (
        db.query(PlayerMatchPerformance)
        .options(joinedload(PlayerMatchPerformance.player), joinedload(PlayerMatchPerformance.match))
        .filter(PlayerMatchPerformance.player_id.in_(all_player_ids))
        .all()
    )
    perfs_by_player = defaultdict(list)
    for perf in perf_rows:
        # Use historical matches only; exclude current target match.
        if perf.match_id == match_id:
            continue
        perfs_by_player[perf.player_id].append(perf)

    snapshots = (
        db.query(PlayerFeatureSnapshot)
        .filter(PlayerFeatureSnapshot.player_id.in_(all_player_ids))
        .all()
    )
    snaps_by_player = defaultdict(list)
    for s in snapshots:
        snaps_by_player[s.player_id].append(s)

    def projected_points(player: Player) -> tuple[float, int, float]:
        perfs = sorted(
            perfs_by_player.get(player.id, []),
            key=lambda x: x.match.date if x.match else datetime.min,
        )
        recent_season = sorted(snaps_by_player.get(player.id, []), key=lambda x: x.season, reverse=True)[:5]
        snap_avg = 0.0
        snap_n = 0
        if recent_season:
            snap_avg = sum(s.fantasy_avg * max(s.matches, 1) for s in recent_season) / max(sum(max(s.matches, 1) for s in recent_season), 1)
            snap_n = sum(s.matches for s in recent_season)

        if not perfs and snap_n == 0:
            base = ROLE_BASELINE[player.role]
            adj = base * _pitch_role_multiplier(pitch_type, player.role)
            return adj, 0, 0.45

        recent = perfs[-20:]
        weighted = 0.0
        weight_sum = 0.0
        n = len(recent)
        for i, perf in enumerate(recent):
            w = i + 1  # more weight to recent games
            weight_sum += w
            pts = calculate_player_points(perf, player.role)["total_points"]
            weighted += pts * w

        perf_avg = (weighted / max(weight_sum, 1.0)) if n > 0 else 0.0
        if snap_n > 0:
            avg = perf_avg * 0.65 + snap_avg * 0.35
            n_eff = n + min(snap_n, 20)
        else:
            avg = perf_avg
            n_eff = n

        avg *= _pitch_role_multiplier(pitch_type, player.role)
        # Dew generally favors batting; slightly hurts bowlers.
        if player.role in (PlayerRole.BAT, PlayerRole.WK):
            avg *= 1.0 + (0.04 * dew_factor)
        elif player.role == PlayerRole.BOWL:
            avg *= 1.0 - (0.04 * dew_factor)

        confidence = min(0.95, 0.45 + 0.5 * min(n_eff / 12.0, 1.0))
        return avg, n_eff, confidence

    proj = {}
    samples = {}
    conf = {}
    for p in all_players:
        v, n, c = projected_points(p)
        proj[p.id] = v
        samples[p.id] = n
        conf[p.id] = c

    selected_by_id = {p.id: p for p in selected}

    current_total = _team_total_with_cvc(selected_ids, captain_id, vice_captain_id, proj)
    best_c, best_vc = _best_c_vc(selected_ids, proj)
    vc_change_gain = _team_total_with_cvc(selected_ids, best_c, best_vc, proj) - current_total

    options = []  # (gain, p_out, p_in, new_c, new_vc, risk)
    for p_out in selected:
        for p_in in pool:
            candidate = [selected_by_id[pid] for pid in selected_ids if pid != p_out.id] + [p_in]
            if not _is_valid_team(candidate, match):
                continue

            cand_ids = (selected_ids - {p_out.id}) | {p_in.id}
            cand_c, cand_vc = _best_c_vc(cand_ids, proj)
            cand_total = _team_total_with_cvc(cand_ids, cand_c, cand_vc, proj)
            gain = cand_total - current_total
            if gain <= 0:
                continue
            risk = 1.0 - min(conf.get(p_out.id, 0.5), conf.get(p_in.id, 0.5))
            options.append((gain, p_out, p_in, cand_c, cand_vc, risk))

    # Compare against pure C/VC optimization as an alternate "one change".
    best_vc_option = None
    if vc_change_gain > 0 and (best_c != captain_id or best_vc != vice_captain_id):
        best_vc_option = {
            "recommendation_type": "vc_change",
            "from_captain_id": captain_id,
            "from_vice_captain_id": vice_captain_id,
            "to_captain_id": best_c,
            "to_vice_captain_id": best_vc,
            "expected_gain": round(vc_change_gain, 1),
            "confidence_score": 0.8,
            "risk_level": "low",
            "why_tags": [
                "Current XI unchanged",
                "Optimized multiplier assignment",
                "Higher projected captain/vice-captain impact",
            ],
        }

    if not options and not best_vc_option:
        return {
            "recommendation": None,
            "message": "Current team already looks optimized for one-swap improvements.",
            "alternatives": [],
        }

    options.sort(key=lambda x: x[0], reverse=True)
    top = options[0]

    def pack(gain: float, p_out: Player, p_in: Player, new_c: int, new_vc: int, risk: float):
        conf_score = min(conf.get(p_out.id, 0.5), conf.get(p_in.id, 0.5))
        risk_level = "low" if risk < 0.22 else "medium" if risk < 0.4 else "high"
        return {
            "recommendation_type": "swap",
            "swap_out": {
                "id": p_out.id,
                "name": p_out.name,
                "role": p_out.role.value,
                "team_id": p_out.team_id,
                "credits": p_out.credits,
                "projected_points": round(proj[p_out.id], 1),
                "sample_matches": samples[p_out.id],
            },
            "swap_in": {
                "id": p_in.id,
                "name": p_in.name,
                "role": p_in.role.value,
                "team_id": p_in.team_id,
                "credits": p_in.credits,
                "projected_points": round(proj[p_in.id], 1),
                "sample_matches": samples[p_in.id],
            },
            "expected_gain": round(gain, 1),
            "new_captain_id": new_c,
            "new_vice_captain_id": new_vc,
            "confidence_score": round(conf_score, 2),
            "risk_level": risk_level,
            "why_tags": [
                "Higher projected form",
                "Constraint-safe one swap",
                f"Pitch-adjusted for {pitch_type} track",
            ],
        }

    top_swap = pack(*top)
    recommendation = top_swap
    if best_vc_option and best_vc_option["expected_gain"] > top_swap["expected_gain"]:
        recommendation = best_vc_option

    alternatives = [pack(*row) for row in options[1:6]]
    # Add a safe and upside pick labels for the first two alternatives.
    if alternatives:
        alternatives[0]["profile"] = "safe"
    if len(alternatives) > 1:
        alternatives[1]["profile"] = "upside"

    # Cache exact payload recommendation.
    response = {
        "recommendation": recommendation,
        "alternatives": alternatives[:3],
        "context": {
            "pitch_type": pitch_type,
            "dew_factor": dew_factor,
            "venue": match.venue,
        },
    }
    _cache_set(cache_key, response)
    return {
        **response,
        "cache_ttl_seconds": _CACHE_TTL_SECONDS,
    }


@router.post("/recommend/precompute/{match_id}")
def precompute_recommendations_for_match(
    match_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Warm player-feature snapshots and clear stale cache for a match."""
    _ = current_user
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    players = db.query(Player).filter(Player.team_id.in_([match.team1_id, match.team2_id])).all()
    _refresh_feature_snapshots(db, [p.id for p in players])

    keys = [k for k in _CACHE.keys() if k.startswith(f"{match_id}:")]
    for k in keys:
        _CACHE.pop(k, None)
    return {"status": "ok", "players_indexed": len(players), "cache_entries_cleared": len(keys)}


@router.post("/feedback")
def capture_feedback(
    body: AIFeedbackRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rec = AIRecommendationFeedback(
        user_id=current_user.id,
        match_id=body.match_id,
        recommendation_type=body.recommendation_type,
        accepted=body.accepted,
        payload_json=body.payload_json,
    )
    db.add(rec)
    db.commit()
    return {"status": "saved", "feedback_id": rec.id}
