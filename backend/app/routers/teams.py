from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from collections import Counter

from app.database import get_db
from app.models import (
    Match, MatchStatus, Player, UserTeam, user_team_players, PlayerRole, User,
)
from app.schemas import UserTeamCreate, UserTeamResponse
from app.routers.auth import get_current_user

router = APIRouter()

MAX_CREDITS = 100.0
ROLE_CONSTRAINTS = {
    PlayerRole.WK: (1, 4),
    PlayerRole.BAT: (1, 6),
    PlayerRole.AR: (1, 4),
    PlayerRole.BOWL: (1, 6),
}


def validate_team(players: list[Player], match: Match):
    if len(players) != 11:
        raise HTTPException(status_code=400, detail="Must select exactly 11 players")

    total_credits = sum(p.credits for p in players)
    if total_credits > MAX_CREDITS:
        raise HTTPException(
            status_code=400,
            detail=f"Total credits ({total_credits}) exceed budget ({MAX_CREDITS})"
        )

    role_counts = Counter(p.role for p in players)
    for role, (min_c, max_c) in ROLE_CONSTRAINTS.items():
        count = role_counts.get(role, 0)
        if count < min_c:
            raise HTTPException(status_code=400, detail=f"Need at least {min_c} {role.value}")
        if count > max_c:
            raise HTTPException(status_code=400, detail=f"Max {max_c} {role.value} allowed")

    team_counts = Counter(p.team_id for p in players)
    for team_id, count in team_counts.items():
        if count > 7:
            raise HTTPException(status_code=400, detail="Max 7 players from one team")

    valid_team_ids = {match.team1_id, match.team2_id}
    for p in players:
        if p.team_id not in valid_team_ids:
            raise HTTPException(status_code=400, detail=f"Player {p.name} is not in either team for this match")


def _validate_inputs(team_in: UserTeamCreate, match: Match, db: Session):
    """Shared validation for create and update."""
    if match.status != MatchStatus.UPCOMING:
        raise HTTPException(status_code=400, detail="Cannot modify team after match has started")

    if datetime.utcnow() > match.lock_time:
        raise HTTPException(status_code=400, detail="Team selection is locked for this match")

    if team_in.captain_id not in team_in.player_ids:
        raise HTTPException(status_code=400, detail="Captain must be in selected players")
    if team_in.vice_captain_id not in team_in.player_ids:
        raise HTTPException(status_code=400, detail="Vice Captain must be in selected players")
    if team_in.captain_id == team_in.vice_captain_id:
        raise HTTPException(status_code=400, detail="Captain and Vice Captain must be different")

    players = db.query(Player).filter(Player.id.in_(team_in.player_ids)).all()
    if len(players) != len(team_in.player_ids):
        raise HTTPException(status_code=400, detail="One or more player IDs are invalid")

    validate_team(players, match)
    return players


@router.post("/", response_model=UserTeamResponse)
def create_team(
    team_in: UserTeamCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    match = db.query(Match).filter(Match.id == team_in.match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    existing = (
        db.query(UserTeam)
        .filter(UserTeam.user_id == current_user.id, UserTeam.match_id == team_in.match_id)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail="You already have a team for this match. Use edit instead.",
        )

    _validate_inputs(team_in, match, db)

    user_team = UserTeam(
        user_id=current_user.id,
        match_id=team_in.match_id,
        captain_id=team_in.captain_id,
        vice_captain_id=team_in.vice_captain_id,
    )
    db.add(user_team)
    db.flush()

    for pid in team_in.player_ids:
        db.execute(user_team_players.insert().values(
            user_team_id=user_team.id, player_id=pid
        ))

    db.commit()
    db.refresh(user_team)

    user_team = (
        db.query(UserTeam)
        .options(joinedload(UserTeam.players))
        .filter(UserTeam.id == user_team.id)
        .first()
    )
    return user_team


@router.put("/{team_id}", response_model=UserTeamResponse)
def update_team(
    team_id: int,
    team_in: UserTeamCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_team = (
        db.query(UserTeam)
        .filter(UserTeam.id == team_id, UserTeam.user_id == current_user.id)
        .first()
    )
    if not user_team:
        raise HTTPException(status_code=404, detail="Team not found")

    match = db.query(Match).filter(Match.id == user_team.match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    _validate_inputs(team_in, match, db)

    db.execute(
        user_team_players.delete().where(user_team_players.c.user_team_id == team_id)
    )

    user_team.captain_id = team_in.captain_id
    user_team.vice_captain_id = team_in.vice_captain_id

    for pid in team_in.player_ids:
        db.execute(user_team_players.insert().values(
            user_team_id=user_team.id, player_id=pid
        ))

    db.commit()

    user_team = (
        db.query(UserTeam)
        .options(joinedload(UserTeam.players))
        .filter(UserTeam.id == team_id)
        .first()
    )
    return user_team


@router.get("/my/match/{match_id}", response_model=None)
def my_team_for_match(
    match_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the current user's team for a specific match, or null."""
    team = (
        db.query(UserTeam)
        .options(joinedload(UserTeam.players))
        .filter(UserTeam.user_id == current_user.id, UserTeam.match_id == match_id)
        .first()
    )
    if not team:
        return None
    return UserTeamResponse.model_validate(team)


@router.get("/my", response_model=list[UserTeamResponse])
def my_teams(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    teams = (
        db.query(UserTeam)
        .options(joinedload(UserTeam.players))
        .filter(UserTeam.user_id == current_user.id)
        .order_by(UserTeam.id.desc())
        .all()
    )
    return teams


@router.get("/{team_id}", response_model=UserTeamResponse)
def get_team(
    team_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    team = (
        db.query(UserTeam)
        .options(joinedload(UserTeam.players))
        .filter(UserTeam.id == team_id, UserTeam.user_id == current_user.id)
        .first()
    )
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return team
