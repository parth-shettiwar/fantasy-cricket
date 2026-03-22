from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Match, Player, IPLTeam
from app.schemas import MatchResponse, PlayerResponse, IPLTeamResponse

router = APIRouter()


@router.get("/", response_model=list[MatchResponse])
def list_matches(db: Session = Depends(get_db)):
    matches = (
        db.query(Match)
        .options(joinedload(Match.team1), joinedload(Match.team2))
        .order_by(Match.date)
        .all()
    )
    return matches


@router.get("/{match_id}", response_model=MatchResponse)
def get_match(match_id: int, db: Session = Depends(get_db)):
    match = (
        db.query(Match)
        .options(joinedload(Match.team1), joinedload(Match.team2))
        .filter(Match.id == match_id)
        .first()
    )
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    return match


@router.get("/{match_id}/players", response_model=list[PlayerResponse])
def get_match_players(match_id: int, db: Session = Depends(get_db)):
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    players = (
        db.query(Player)
        .filter(Player.team_id.in_([match.team1_id, match.team2_id]))
        .order_by(Player.role, Player.credits.desc())
        .all()
    )
    return players


@router.get("/teams/all", response_model=list[IPLTeamResponse])
def list_teams(db: Session = Depends(get_db)):
    return db.query(IPLTeam).all()
