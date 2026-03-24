"""Admin endpoints for managing matches and triggering score updates."""
from __future__ import annotations

import os
import re
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session

from bs4 import BeautifulSoup
from app.database import get_db
from app.models import (
    Match, MatchStatus, IPLTeam, Player, PlayerRole,
    PlayerMatchPerformance, UserTeam, UserTeamSubstitute, user_team_players,
)
from app.schemas import SetCricbuzzId, SetMatchStatus
from app.services.scheduler import update_match_scores
from app.services.cricket_scraper import HEADERS

router = APIRouter()

ADMIN_KEY = os.environ.get("ADMIN_KEY", "fantasy-admin-secret")

CB_SERIES_URL = "https://www.cricbuzz.com/cricket-series/{series_id}/x/matches"
IPL_SQUAD_URL = "https://www.iplt20.com/teams/{slug}/squad"

TEAM_SLUGS = {
    "MI": ("Mumbai Indians", "mumbai-indians"),
    "CSK": ("Chennai Super Kings", "chennai-super-kings"),
    "RCB": ("Royal Challengers Bengaluru", "royal-challengers-bengaluru"),
    "KKR": ("Kolkata Knight Riders", "kolkata-knight-riders"),
    "DC": ("Delhi Capitals", "delhi-capitals"),
    "RR": ("Rajasthan Royals", "rajasthan-royals"),
    "SRH": ("Sunrisers Hyderabad", "sunrisers-hyderabad"),
    "PBKS": ("Punjab Kings", "punjab-kings"),
    "LSG": ("Lucknow Super Giants", "lucknow-super-giants"),
    "GT": ("Gujarat Titans", "gujarat-titans"),
}

ROLE_MAP = {
    "Batter": PlayerRole.BAT,
    "WK-Batter": PlayerRole.WK,
    "All-Rounder": PlayerRole.AR,
    "Bowler": PlayerRole.BOWL,
}

DEFAULT_CREDITS = {
    PlayerRole.BAT: 8.0,
    PlayerRole.WK: 8.0,
    PlayerRole.AR: 8.5,
    PlayerRole.BOWL: 8.0,
}


def verify_admin(x_admin_key: str = Header(...)):
    if x_admin_key != ADMIN_KEY:
        raise HTTPException(status_code=403, detail="Invalid admin key")


# ── helpers ──────────────────────────────────────────────────────────


def _get_or_create_team(db: Session, name: str, short: str) -> IPLTeam:
    team = db.query(IPLTeam).filter(IPLTeam.short_name == short).first()
    if not team:
        team = IPLTeam(name=name, short_name=short, logo_url=f"/logos/{short.lower()}.png")
        db.add(team)
        db.flush()
    return team


# ── endpoints ────────────────────────────────────────────────────────


@router.post("/import-series/{series_id}")
async def import_series_schedule(
    series_id: int,
    db: Session = Depends(get_db),
    _=Depends(verify_admin),
):
    """Import full series schedule from Cricbuzz (e.g. IPL 2026 = 9241).

    Scrapes the series matches page, extracts every match with date/venue/teams,
    creates teams if needed, and inserts matches as UPCOMING.
    """
    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
        resp = await client.get(
            CB_SERIES_URL.format(series_id=series_id), headers=HEADERS
        )
        resp.raise_for_status()

    html = resp.text
    unesc = html.replace('\\"', '"').replace('\\\\', '\\')

    # Find all matchIds belonging to this series
    match_ids = re.findall(
        rf'"matchId":(\d+),[^}}]*?"seriesId":{series_id}', unesc
    )
    if not match_ids:
        raise HTTPException(status_code=502, detail="No matches found for this series")

    # Deduplicate while keeping order
    seen_ids: set[str] = set()
    unique_ids: list[str] = []
    for mid in match_ids:
        if mid not in seen_ids:
            seen_ids.add(mid)
            unique_ids.append(mid)

    imported = []
    skipped = 0

    for mid in unique_ids:
        if db.query(Match).filter(Match.cricbuzz_match_id == mid).first():
            skipped += 1
            continue

        pos = unesc.find(f'"matchId":{mid},')
        if pos < 0:
            continue
        chunk = unesc[pos : pos + 3000]

        desc = re.search(r'"matchDesc":"([^"]*)"', chunk)
        start_ts = re.search(r'"startDate":"(\d+)"', chunk)
        t1_short = re.search(r'"team1":\{[^}]*"teamSName":"([^"]*)"', chunk)
        t1_name = re.search(r'"team1":\{[^}]*"teamName":"([^"]*)"', chunk)
        t2_short = re.search(r'"team2":\{[^}]*"teamSName":"([^"]*)"', chunk)
        t2_name = re.search(r'"team2":\{[^}]*"teamName":"([^"]*)"', chunk)
        ground = re.search(r'"ground":"([^"]*)"', chunk)
        city = re.search(r'"city":"([^"]*)"', chunk)

        if not (t1_short and t2_short and start_ts):
            continue

        match_date = datetime.fromtimestamp(
            int(start_ts.group(1)) / 1000, tz=timezone.utc
        )
        venue_str = (
            f"{ground.group(1)}, {city.group(1)}"
            if ground and city
            else "TBD"
        )

        team1 = _get_or_create_team(
            db, t1_name.group(1) if t1_name else t1_short.group(1), t1_short.group(1)
        )
        team2 = _get_or_create_team(
            db, t2_name.group(1) if t2_name else t2_short.group(1), t2_short.group(1)
        )

        match = Match(
            team1_id=team1.id,
            team2_id=team2.id,
            date=match_date,
            venue=venue_str,
            status=MatchStatus.UPCOMING,
            lock_time=match_date - timedelta(minutes=30),
            cricbuzz_match_id=mid,
        )
        db.add(match)
        db.flush()

        imported.append({
            "match_id": match.id,
            "cricbuzz_id": mid,
            "teams": f"{t1_short.group(1)} vs {t2_short.group(1)}",
            "date": match_date.isoformat(),
            "venue": venue_str,
            "desc": desc.group(1) if desc else "",
        })

    db.commit()
    return {
        "imported": len(imported),
        "skipped_existing": skipped,
        "total_in_series": len(unique_ids),
        "matches": imported,
    }


@router.post("/refresh-squads")
async def refresh_squads(
    db: Session = Depends(get_db),
    _=Depends(verify_admin),
):
    """Scrape latest IPL squads from iplt20.com and update the database.

    For each team: creates the team if missing, then adds any new players
    and removes players no longer in the squad. Existing player IDs are
    preserved so team selections remain valid.
    """
    ua = (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
    summary: list[dict] = []

    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
        for short, (full_name, slug) in TEAM_SLUGS.items():
            url = IPL_SQUAD_URL.format(slug=slug)
            try:
                resp = await client.get(url, headers={"User-Agent": ua})
                resp.raise_for_status()
            except Exception as exc:
                summary.append({"team": short, "error": str(exc)})
                continue

            soup = BeautifulSoup(resp.text, "html.parser")
            scraped: list[dict] = []
            for a_tag in soup.find_all("a", attrs={"data-player_name": True}):
                pname = a_tag["data-player_name"]
                role_span = a_tag.find("span", class_="d-block")
                role_text = role_span.get_text(strip=True) if role_span else "Batter"
                role = ROLE_MAP.get(role_text, PlayerRole.BAT)
                scraped.append({"name": pname, "role": role})

            if not scraped:
                summary.append({"team": short, "error": "No players found on page"})
                continue

            team = _get_or_create_team(db, full_name, short)

            existing = db.query(Player).filter(Player.team_id == team.id).all()
            existing_by_name = {p.name.lower(): p for p in existing}

            added, updated, unchanged = 0, 0, 0
            scraped_names_lower: set[str] = set()

            for sp in scraped:
                key = sp["name"].lower()
                scraped_names_lower.add(key)

                if key in existing_by_name:
                    player = existing_by_name[key]
                    if player.role != sp["role"]:
                        player.role = sp["role"]
                        updated += 1
                    else:
                        unchanged += 1
                else:
                    p = Player(
                        name=sp["name"],
                        team_id=team.id,
                        role=sp["role"],
                        credits=DEFAULT_CREDITS.get(sp["role"], 8.0),
                    )
                    db.add(p)
                    added += 1

            removed_names = [
                p.name for p in existing
                if p.name.lower() not in scraped_names_lower
            ]

            summary.append({
                "team": short,
                "total_scraped": len(scraped),
                "added": added,
                "updated": updated,
                "unchanged": unchanged,
                "no_longer_in_squad": removed_names,
            })

    db.commit()
    return {"teams_processed": len(summary), "details": summary}


@router.delete("/clear-matches")
async def clear_all_matches(
    db: Session = Depends(get_db),
    _=Depends(verify_admin),
):
    """Delete ALL matches, performances, and user teams. Use to wipe fake data."""
    db.execute(user_team_players.delete())
    db.query(PlayerMatchPerformance).delete()
    db.query(UserTeam).delete()
    db.query(Match).delete()
    db.commit()
    return {"status": "cleared", "detail": "All matches, performances, and user teams deleted"}


@router.delete("/clear-all")
async def clear_everything(
    db: Session = Depends(get_db),
    _=Depends(verify_admin),
):
    """Nuclear option: delete ALL data (matches, players, teams). Fresh start."""
    db.query(UserTeamSubstitute).delete()
    db.execute(user_team_players.delete())
    db.query(PlayerMatchPerformance).delete()
    db.query(UserTeam).delete()
    db.query(Match).delete()
    db.query(Player).delete()
    db.query(IPLTeam).delete()
    db.commit()
    return {"status": "cleared", "detail": "All data wiped"}


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
            "venue": m.venue,
        }
        for m in matches
    ]
