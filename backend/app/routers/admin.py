"""Admin endpoints for managing matches and triggering score updates."""
from __future__ import annotations

import os
import re
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Match, MatchStatus, IPLTeam, Player, PlayerRole
from app.schemas import SetCricbuzzId, SetMatchStatus
from app.services.scheduler import update_match_scores
from app.services.cricket_scraper import scrape_scorecard, CRICBUZZ_SCORECARD_URL, HEADERS

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


@router.post("/import-match/{cricbuzz_match_id}")
async def import_match_from_cricbuzz(
    cricbuzz_match_id: str,
    db: Session = Depends(get_db),
    _=Depends(verify_admin),
):
    """Auto-import a match from Cricbuzz: creates teams, players, match, and pulls scores."""
    import httpx
    from bs4 import BeautifulSoup

    existing = db.query(Match).filter(Match.cricbuzz_match_id == cricbuzz_match_id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Match already imported as match_id={existing.id}")

    url = CRICBUZZ_SCORECARD_URL.format(match_id=cricbuzz_match_id)
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(url, headers=HEADERS)
            resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch Cricbuzz page: {exc}")

    soup = BeautifulSoup(resp.text, "html.parser")
    raw = ""
    for script in soup.find_all("script"):
        text = script.string or ""
        if "batName" in text and len(text) > 10000:
            raw = text.replace('\\"', '"').replace('\\\\', '\\')
            break

    if not raw:
        raise HTTPException(status_code=502, detail="Could not parse Cricbuzz page data")

    # Extract team info
    team_names = re.findall(r'"batTeamName":"([^"]+)"', raw)
    team_shorts = re.findall(r'"batTeamShortName":"([^"]+)"', raw)
    if len(set(team_names)) < 2 or len(set(team_shorts)) < 2:
        raise HTTPException(status_code=502, detail="Could not find two teams in match data")

    unique_teams = []
    seen = set()
    for name, short in zip(team_names, team_shorts):
        if short not in seen:
            unique_teams.append((name, short))
            seen.add(short)

    # Create or get teams
    db_teams = {}
    for name, short in unique_teams:
        team = db.query(IPLTeam).filter(IPLTeam.short_name == short).first()
        if not team:
            team = IPLTeam(name=name, short_name=short, logo_url=f"/logos/{short.lower()}.png")
            db.add(team)
            db.flush()
        db_teams[short] = team

    # Extract players by team
    # Pattern: batTeamShortName tells us which team is batting in each innings
    innings_blocks = re.findall(
        r'"batTeamShortName":"([^"]+)".*?"batsmenData":\{(.*?)\},"bowlTeamDetails"',
        raw,
    )

    players_by_team = {}
    for team_short, bat_data in innings_blocks:
        if team_short not in players_by_team:
            players_by_team[team_short] = set()
        names = re.findall(r'"batName":"([^"]+)"', bat_data)
        keepers = re.findall(r'"batName":"([^"]+)"[^}]*"isKeeper":true', bat_data)
        for n in names:
            players_by_team[team_short].add(n)
        # Also get bowlers (they belong to the OTHER team)
    
    # Get bowlers from each innings
    bowl_blocks = re.findall(
        r'"bowlTeamShortName":"([^"]+)".*?"bowlersData":\{(.*?)\}',
        raw,
    )
    for team_short, bowl_data in bowl_blocks:
        if team_short not in players_by_team:
            players_by_team[team_short] = set()
        names = re.findall(r'"bowlName":"([^"]+)"', bowl_data)
        for n in names:
            players_by_team[team_short].add(n)

    # Determine player roles from batting/bowling data
    keepers_set = set(re.findall(r'"batName":"([^"]+)"[^}]*"isKeeper":true', raw))
    bowlers_set = set()
    for _, bowl_data in bowl_blocks:
        bowlers_set.update(re.findall(r'"bowlName":"([^"]+)"', bowl_data))
    batters_set = set()
    for _, bat_data in innings_blocks:
        batters_set.update(re.findall(r'"batName":"([^"]+)"', bat_data))

    def guess_role(name):
        if name in keepers_set:
            return PlayerRole.WK
        is_bat = name in batters_set
        is_bowl = name in bowlers_set
        if is_bat and is_bowl:
            return PlayerRole.AR
        if is_bowl:
            return PlayerRole.BOWL
        return PlayerRole.BAT

    # Create players
    created_players = 0
    for team_short, names in players_by_team.items():
        team = db_teams.get(team_short)
        if not team:
            continue
        for name in names:
            existing_player = (
                db.query(Player)
                .filter(Player.name == name, Player.team_id == team.id)
                .first()
            )
            if not existing_player:
                p = Player(
                    name=name,
                    team_id=team.id,
                    role=guess_role(name),
                    credits=8.0,
                )
                db.add(p)
                created_players += 1

    db.flush()

    # Create the match
    team_list = list(db_teams.values())
    now = datetime.utcnow()
    match = Match(
        team1_id=team_list[0].id,
        team2_id=team_list[1].id,
        date=now - timedelta(hours=4),
        venue="Imported from Cricbuzz",
        status=MatchStatus.UPCOMING,
        lock_time=now - timedelta(hours=5),
        cricbuzz_match_id=cricbuzz_match_id,
    )
    db.add(match)
    db.flush()

    db.commit()

    # Now trigger the score update
    await update_match_scores(match, db)

    return {
        "match_id": match.id,
        "team1": {"id": team_list[0].id, "name": team_list[0].name, "short": team_list[0].short_name},
        "team2": {"id": team_list[1].id, "name": team_list[1].name, "short": team_list[1].short_name},
        "players_created": created_players,
        "cricbuzz_match_id": cricbuzz_match_id,
        "status": match.status.value,
    }


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
