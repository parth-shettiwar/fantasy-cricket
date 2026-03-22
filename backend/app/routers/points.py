from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.database import get_db
from app.models import (
    UserTeam, PlayerMatchPerformance, Player, User, user_team_players,
)
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
    """Leaderboard for a single match: all submitted teams ranked by points."""
    teams = (
        db.query(UserTeam)
        .options(joinedload(UserTeam.players), joinedload(UserTeam.captain), joinedload(UserTeam.vice_captain))
        .join(User, User.id == UserTeam.user_id)
        .filter(UserTeam.match_id == match_id)
        .order_by(UserTeam.total_points.desc())
        .all()
    )

    result = []
    for ut in teams:
        user = db.query(User).filter(User.id == ut.user_id).first()
        result.append({
            "user_team_id": ut.id,
            "user_id": ut.user_id,
            "username": user.username if user else "?",
            "captain": ut.captain.name if ut.captain else "?",
            "vice_captain": ut.vice_captain.name if ut.vice_captain else "?",
            "total_points": ut.total_points,
            "players": [
                {"id": p.id, "name": p.name, "role": p.role.value, "team_short": p.team.short_name if p.team else ""}
                for p in ut.players
            ],
        })
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
