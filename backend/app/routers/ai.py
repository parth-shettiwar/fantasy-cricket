from collections import Counter, defaultdict
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Match, MatchStatus, Player, PlayerMatchPerformance, PlayerRole, User
from app.routers.auth import get_current_user
from app.services.points_engine import calculate_player_points

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

    def projected_points(player: Player) -> tuple[float, int]:
        perfs = sorted(
            perfs_by_player.get(player.id, []),
            key=lambda x: x.match.date if x.match else datetime.min,
        )
        if not perfs:
            return ROLE_BASELINE[player.role], 0

        recent = perfs[-20:]
        weighted = 0.0
        weight_sum = 0.0
        n = len(recent)
        for i, perf in enumerate(recent):
            w = i + 1  # more weight to recent games
            weight_sum += w
            pts = calculate_player_points(perf, player.role)["total_points"]
            weighted += pts * w

        avg = weighted / max(weight_sum, 1.0)
        confidence_mult = 0.6 + 0.4 * min(n / 8.0, 1.0)
        return avg * confidence_mult, n

    proj = {}
    samples = {}
    for p in selected + pool:
        v, n = projected_points(p)
        proj[p.id] = v
        samples[p.id] = n

    selected_by_id = {p.id: p for p in selected}

    options = []
    for p_out in selected:
        # Avoid recommending swaps that invalidate C/VC in MVP.
        if p_out.id in (captain_id, vice_captain_id):
            continue
        for p_in in pool:
            candidate = [selected_by_id[pid] for pid in selected_ids if pid != p_out.id] + [p_in]
            if not _is_valid_team(candidate, match):
                continue

            gain = proj[p_in.id] - proj[p_out.id]
            if gain <= 0:
                continue
            options.append((gain, p_out, p_in))

    if not options:
        return {
            "recommendation": None,
            "message": "Current team already looks optimized for one-swap improvements.",
            "alternatives": [],
        }

    options.sort(key=lambda x: x[0], reverse=True)
    top = options[0]

    def pack(gain: float, p_out: Player, p_in: Player):
        return {
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
            "why_tags": [
                "Higher projected form",
                "Constraint-safe one swap",
                "Recency-weighted historical points",
            ],
        }

    return {
        "recommendation": pack(*top),
        "alternatives": [pack(g, po, pi) for g, po, pi in options[1:4]],
    }
