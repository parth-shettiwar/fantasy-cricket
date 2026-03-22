"""Admin endpoints for managing matches and triggering score updates."""

import os
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Match, MatchStatus
from app.schemas import SetCricbuzzId, SetMatchStatus
from app.services.scheduler import update_match_scores

router = APIRouter()

ADMIN_KEY = os.environ.get("ADMIN_KEY", "fantasy-admin-secret")


def verify_admin(x_admin_key: str = Header(...)):
    if x_admin_key != ADMIN_KEY:
        raise HTTPException(status_code=403, detail="Invalid admin key")


@router.post("/match/{match_id}/cricbuzz")
async def set_cricbuzz_id(
    match_id: int,
    body: SetCricbuzzId,
    db: Session = Depends(get_db),
    _=Depends(verify_admin),
):
    """Link a match to its Cricbuzz match ID for live score scraping."""
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    match.cricbuzz_match_id = body.cricbuzz_match_id
    db.commit()
    return {"match_id": match_id, "cricbuzz_match_id": body.cricbuzz_match_id}


@router.post("/match/{match_id}/trigger-update")
async def trigger_score_update(
    match_id: int,
    db: Session = Depends(get_db),
    _=Depends(verify_admin),
):
    """Manually trigger a score update for a specific match."""
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    if not match.cricbuzz_match_id:
        raise HTTPException(status_code=400, detail="No Cricbuzz match ID set")

    await update_match_scores(match, db)
    return {"status": "updated", "match_id": match_id}


@router.post("/match/{match_id}/status")
async def set_match_status(
    match_id: int,
    body: SetMatchStatus,
    db: Session = Depends(get_db),
    _=Depends(verify_admin),
):
    """Manually override a match's status."""
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    match.status = body.status
    db.commit()
    return {"match_id": match_id, "status": body.status}


@router.get("/matches")
async def list_all_matches(
    db: Session = Depends(get_db),
    _=Depends(verify_admin),
):
    """List all matches with their Cricbuzz IDs and statuses."""
    matches = db.query(Match).order_by(Match.date).all()
    return [
        {
            "id": m.id,
            "team1_id": m.team1_id,
            "team2_id": m.team2_id,
            "date": m.date.isoformat(),
            "status": m.status.value,
            "cricbuzz_match_id": m.cricbuzz_match_id,
        }
        for m in matches
    ]
