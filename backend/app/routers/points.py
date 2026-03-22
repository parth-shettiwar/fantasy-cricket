from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.database import get_db
from app.models import (
    UserTeam, UserTeamSubstitute, PlayerMatchPerformance, Player, User,
    Match, MatchStatus, user_team_players,
)
from app.services.scheduler import _build_effective_xi
from app.schemas import (
    TeamPointsBreakdown, PlayerPoints, LeaderboardEntry, PerformanceResponse,
)
from app.services.points_engine import calculate_player_points, calculate_final_points
from app.routers.auth import get_current_user

router = APIRouter()


@router.get("/breakdown/{user_team_id}", response_model=TeamPointsBreakdown)
def get_points_breakdown(
    user_team_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_team = (
        db.query(UserTeam)
        .options(joinedload(UserTeam.players))
        .filter(UserTeam.id == user_team_id, UserTeam.user_id == current_user.id)
        .first()
    )
    if not user_team:
        raise HTTPException(status_code=404, detail="Team not found")

    player_points_list = []
    total = 0.0

    for player in user_team.players:
        perf = (
            db.query(PlayerMatchPerformance)
            .filter(
                PlayerMatchPerformance.player_id == player.id,
                PlayerMatchPerformance.match_id == user_team.match_id,
            )
            .first()
        )

        if not perf:
            pp = PlayerPoints(
                player_id=player.id,
                player_name=player.name,
                role=player.role,
                team_short_name=player.team.short_name if player.team else "",
                batting_points=0, bowling_points=0, fielding_points=0,
                bonus_points=0, total_points=0,
                is_captain=player.id == user_team.captain_id,
                is_vice_captain=player.id == user_team.vice_captain_id,
                final_points=0,
            )
        else:
            pts = calculate_player_points(perf, player.role)
            is_cap = player.id == user_team.captain_id
            is_vc = player.id == user_team.vice_captain_id
            final = calculate_final_points(pts["total_points"], is_cap, is_vc)

            pp = PlayerPoints(
                player_id=player.id,
                player_name=player.name,
                role=player.role,
                team_short_name=player.team.short_name if player.team else "",
                batting_points=pts["batting_points"],
                bowling_points=pts["bowling_points"],
                fielding_points=pts["fielding_points"],
                bonus_points=pts["bonus_points"],
                total_points=pts["total_points"],
                is_captain=is_cap,
                is_vice_captain=is_vc,
                final_points=final,
            )

        player_points_list.append(pp)
        total += pp.final_points

    return TeamPointsBreakdown(
        user_team_id=user_team.id,
        match_id=user_team.match_id,
        total_points=total,
        player_points=player_points_list,
    )


@router.post("/calculate/{user_team_id}")
def calculate_and_store_points(
    user_team_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Recalculate and persist total points for a user team."""
    user_team = (
        db.query(UserTeam)
        .options(joinedload(UserTeam.players))
        .filter(UserTeam.id == user_team_id, UserTeam.user_id == current_user.id)
        .first()
    )
    if not user_team:
        raise HTTPException(status_code=404, detail="Team not found")

    total = 0.0
    for player in user_team.players:
        perf = (
            db.query(PlayerMatchPerformance)
            .filter(
                PlayerMatchPerformance.player_id == player.id,
                PlayerMatchPerformance.match_id == user_team.match_id,
            )
            .first()
        )
        if perf:
            pts = calculate_player_points(perf, player.role)
            is_cap = player.id == user_team.captain_id
            is_vc = player.id == user_team.vice_captain_id
            total += calculate_final_points(pts["total_points"], is_cap, is_vc)

    user_team.total_points = total
    db.commit()
    return {"user_team_id": user_team_id, "total_points": total}


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
def leaderboard(db: Session = Depends(get_db)):
    results = (
        db.query(
            User.id,
            User.username,
            func.coalesce(func.sum(UserTeam.total_points), 0).label("total_points"),
            func.count(UserTeam.id).label("teams_count"),
        )
        .outerjoin(UserTeam, User.id == UserTeam.user_id)
        .group_by(User.id)
        .order_by(func.sum(UserTeam.total_points).desc())
        .all()
    )

    return [
        LeaderboardEntry(
            user_id=r.id,
            username=r.username,
            total_points=float(r.total_points),
            teams_count=r.teams_count,
        )
        for r in results
    ]


@router.get("/match/{match_id}/performances", response_model=list[PerformanceResponse])
def match_performances(match_id: int, db: Session = Depends(get_db)):
    perfs = (
        db.query(PlayerMatchPerformance)
        .filter(PlayerMatchPerformance.match_id == match_id)
        .all()
    )
    return perfs


@router.get("/match/{match_id}/leaderboard")
def match_leaderboard(match_id: int, db: Session = Depends(get_db)):
    """Leaderboard for a single match.

    Before match starts: only shows usernames (team submitted = yes).
    After match starts (live/completed): shows full details.
    """
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    teams = (
        db.query(UserTeam)
        .options(joinedload(UserTeam.players), joinedload(UserTeam.captain), joinedload(UserTeam.vice_captain))
        .join(User, User.id == UserTeam.user_id)
        .filter(UserTeam.match_id == match_id)
        .order_by(UserTeam.total_points.desc())
        .all()
    )

    locked = match.status != MatchStatus.UPCOMING

    result = []
    for ut in teams:
        user = db.query(User).filter(User.id == ut.user_id).first()
        entry = {
            "user_team_id": ut.id,
            "user_id": ut.user_id,
            "username": user.username if user else "?",
            "locked": locked,
        }
        if locked:
            entry.update({
                "captain": ut.captain.name if ut.captain else "?",
                "vice_captain": ut.vice_captain.name if ut.vice_captain else "?",
                "total_points": ut.total_points,
                "players": [
                    {"id": p.id, "name": p.name, "role": p.role.value, "team_short": p.team.short_name if p.team else ""}
                    for p in ut.players
                ],
            })
        else:
            entry.update({
                "captain": None,
                "vice_captain": None,
                "total_points": None,
                "players": [],
            })
        result.append(entry)

    return result


@router.get("/match/{match_id}/team-count")
def match_team_count(match_id: int, db: Session = Depends(get_db)):
    """How many users have submitted teams for a match."""
    count = db.query(func.count(UserTeam.id)).filter(UserTeam.match_id == match_id).scalar()
    return {"match_id": match_id, "team_count": count}


@router.get("/team-counts")
def all_team_counts(db: Session = Depends(get_db)):
    """Team counts for all matches (used by home page)."""
    rows = (
        db.query(UserTeam.match_id, func.count(UserTeam.id))
        .group_by(UserTeam.match_id)
        .all()
    )
    return {str(mid): cnt for mid, cnt in rows}


@router.get("/user/{user_id}/profile")
def user_profile(user_id: int, db: Session = Depends(get_db)):
    """Public profile: user's match history with points per match."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    teams = (
        db.query(UserTeam)
        .options(
            joinedload(UserTeam.match).joinedload(Match.team1),
            joinedload(UserTeam.match).joinedload(Match.team2),
            joinedload(UserTeam.captain),
            joinedload(UserTeam.vice_captain),
        )
        .filter(UserTeam.user_id == user_id)
        .order_by(UserTeam.match_id.desc())
        .all()
    )

    overall_points = sum(ut.total_points for ut in teams)

    team_entries = []
    for ut in teams:
        started = ut.match and ut.match.status != MatchStatus.UPCOMING
        entry = {
            "user_team_id": ut.id,
            "match_id": ut.match_id,
            "match_name": f"{ut.match.team1.short_name} vs {ut.match.team2.short_name}" if ut.match else "?",
            "match_date": ut.match.date.isoformat() if ut.match else "",
            "match_status": ut.match.status.value if ut.match else "",
            "venue": ut.match.venue if ut.match else "",
            "locked": started,
        }
        if started:
            entry["captain"] = ut.captain.name if ut.captain else "?"
            entry["vice_captain"] = ut.vice_captain.name if ut.vice_captain else "?"
            entry["total_points"] = ut.total_points
        else:
            entry["captain"] = None
            entry["vice_captain"] = None
            entry["total_points"] = None
        team_entries.append(entry)

    return {
        "user_id": user.id,
        "username": user.username,
        "total_points": overall_points,
        "matches_played": len(teams),
        "teams": team_entries,
    }


@router.get("/user-team/{user_team_id}/detail")
def public_team_detail(user_team_id: int, db: Session = Depends(get_db)):
    """Public view of any user's team with per-player points breakdown.

    Blocked for upcoming matches to prevent team copying.
    """
    ut = (
        db.query(UserTeam)
        .options(
            joinedload(UserTeam.players).joinedload(Player.team),
            joinedload(UserTeam.substitutes).joinedload(UserTeamSubstitute.player).joinedload(Player.team),
            joinedload(UserTeam.match).joinedload(Match.team1),
            joinedload(UserTeam.match).joinedload(Match.team2),
            joinedload(UserTeam.captain),
            joinedload(UserTeam.vice_captain),
        )
        .filter(UserTeam.id == user_team_id)
        .first()
    )
    if not ut:
        raise HTTPException(status_code=404, detail="Team not found")

    if ut.match and ut.match.status == MatchStatus.UPCOMING:
        raise HTTPException(
            status_code=403,
            detail="Team details are hidden until the match starts",
        )

    user = db.query(User).filter(User.id == ut.user_id).first()

    effective = _build_effective_xi(ut, ut.match_id, db)
    effective_ids = {p.id for p in effective}
    main_ids = {p.id for p in ut.players}
    sub_ids = {s.player_id for s in ut.substitutes}
    subbed_in_ids = effective_ids - main_ids

    def _player_detail(player, is_sub_in=False, replaces_name=None):
        perf = (
            db.query(PlayerMatchPerformance)
            .filter(
                PlayerMatchPerformance.player_id == player.id,
                PlayerMatchPerformance.match_id == ut.match_id,
            )
            .first()
        )
        is_cap = player.id == ut.captain_id
        is_vc = player.id == ut.vice_captain_id
        pts_data = {"batting": 0, "bowling": 0, "fielding": 0, "bonus": 0, "total": 0, "final": 0}

        if perf:
            pts = calculate_player_points(perf, player.role)
            final = calculate_final_points(pts["total_points"], is_cap, is_vc)
            pts_data = {
                "batting": pts["batting_points"],
                "bowling": pts["bowling_points"],
                "fielding": pts["fielding_points"],
                "bonus": pts["bonus_points"],
                "total": pts["total_points"],
                "final": final,
            }

        return {
            "player_id": player.id,
            "name": player.name,
            "role": player.role.value,
            "team_short": player.team.short_name if player.team else "",
            "is_captain": is_cap,
            "is_vice_captain": is_vc,
            "is_substitute": is_sub_in,
            "replaces": replaces_name,
            "points": pts_data,
            "stats": {
                "runs": perf.runs if perf else 0,
                "balls": perf.balls_faced if perf else 0,
                "fours": perf.fours if perf else 0,
                "sixes": perf.sixes if perf else 0,
                "wickets": perf.wickets if perf else 0,
                "overs": perf.overs_bowled if perf else 0,
                "catches": perf.catches if perf else 0,
            } if perf and perf.is_playing else None,
        }

    player_details = []
    not_playing_main = []
    for player in ut.players:
        if player.id in effective_ids:
            player_details.append(_player_detail(player))
        else:
            not_playing_main.append(player)

    sub_idx = 0
    for sub_player in effective:
        if sub_player.id in subbed_in_ids:
            replaces = not_playing_main[sub_idx].name if sub_idx < len(not_playing_main) else None
            player_details.append(_player_detail(sub_player, is_sub_in=True, replaces_name=replaces))
            sub_idx += 1

    benched_subs = []
    for s in ut.substitutes:
        if s.player_id not in subbed_in_ids:
            benched_subs.append({
                "player_id": s.player_id,
                "name": s.player.name,
                "role": s.player.role.value,
                "team_short": s.player.team.short_name if s.player.team else "",
                "priority": s.priority,
            })

    return {
        "user_team_id": ut.id,
        "user_id": ut.user_id,
        "username": user.username if user else "?",
        "match_id": ut.match_id,
        "match_name": f"{ut.match.team1.short_name} vs {ut.match.team2.short_name}" if ut.match else "?",
        "match_date": ut.match.date.isoformat() if ut.match else "",
        "match_status": ut.match.status.value if ut.match else "",
        "total_points": ut.total_points,
        "captain": ut.captain.name if ut.captain else "?",
        "vice_captain": ut.vice_captain.name if ut.vice_captain else "?",
        "players": sorted(player_details, key=lambda p: -p["points"]["final"]),
        "not_playing": [{"player_id": p.id, "name": p.name, "role": p.role.value} for p in not_playing_main],
        "bench_substitutes": benched_subs,
    }
