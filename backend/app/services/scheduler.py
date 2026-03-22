"""Background scheduler that polls Cricbuzz for live match scores."""

import asyncio
import logging
from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.orm import Session, joinedload

from app.database import SessionLocal
from app.models import (
    Match, MatchStatus, Player, PlayerMatchPerformance, UserTeam,
    user_team_players,
)
from app.services.cricket_scraper import (
    scrape_scorecard, build_player_name_index, match_player_name,
)
from app.services.points_engine import calculate_player_points, calculate_final_points

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def update_match_scores(match: Match, db: Session):
    """Scrape scorecard and update player performances for a single match."""
    if not match.cricbuzz_match_id:
        return

    scorecard = await scrape_scorecard(match.cricbuzz_match_id)
    if not scorecard:
        logger.warning("No scorecard data for match %d", match.id)
        return

    players = (
        db.query(Player)
        .filter(Player.team_id.in_([match.team1_id, match.team2_id]))
        .all()
    )
    name_index = build_player_name_index(players)

    playing_player_ids: set[int] = set()
    batting_by_id: dict[int, dict] = {}
    bowling_by_id: dict[int, dict] = {}
    fielding_by_id: dict[int, dict] = {}

    for entry in scorecard.batting:
        pid = match_player_name(entry.name, name_index)
        if pid is None:
            continue
        playing_player_ids.add(pid)
        batting_by_id[pid] = {
            "runs": entry.runs,
            "balls_faced": entry.balls,
            "fours": entry.fours,
            "sixes": entry.sixes,
        }

    for entry in scorecard.bowling:
        pid = match_player_name(entry.name, name_index)
        if pid is None:
            continue
        playing_player_ids.add(pid)
        bowling_by_id[pid] = {
            "overs_bowled": entry.overs,
            "maidens": entry.maidens,
            "runs_conceded": entry.runs_conceded,
            "wickets": entry.wickets,
        }

    for entry in scorecard.fielding.values():
        pid = match_player_name(entry.name, name_index)
        if pid is None:
            continue
        fielding_by_id[pid] = {
            "catches": entry.catches,
            "stumpings": entry.stumpings,
            "run_outs": entry.run_outs,
        }

    for player in players:
        perf = (
            db.query(PlayerMatchPerformance)
            .filter(
                PlayerMatchPerformance.player_id == player.id,
                PlayerMatchPerformance.match_id == match.id,
            )
            .first()
        )

        is_playing = player.id in playing_player_ids
        bat = batting_by_id.get(player.id, {})
        bowl = bowling_by_id.get(player.id, {})
        fld = fielding_by_id.get(player.id, {})

        values = {
            "is_playing": is_playing,
            "runs": bat.get("runs", 0),
            "balls_faced": bat.get("balls_faced", 0),
            "fours": bat.get("fours", 0),
            "sixes": bat.get("sixes", 0),
            "overs_bowled": bowl.get("overs_bowled", 0.0),
            "maidens": bowl.get("maidens", 0),
            "runs_conceded": bowl.get("runs_conceded", 0),
            "wickets": bowl.get("wickets", 0),
            "catches": fld.get("catches", 0),
            "stumpings": fld.get("stumpings", 0),
            "run_outs": fld.get("run_outs", 0),
        }

        if perf:
            for k, v in values.items():
                setattr(perf, k, v)
        else:
            perf = PlayerMatchPerformance(
                player_id=player.id, match_id=match.id, **values
            )
            db.add(perf)

    if scorecard.is_complete and match.status != MatchStatus.COMPLETED:
        match.status = MatchStatus.COMPLETED
        logger.info("Match %d marked as COMPLETED", match.id)
    elif not scorecard.is_complete and match.status == MatchStatus.UPCOMING:
        match.status = MatchStatus.LIVE
        logger.info("Match %d marked as LIVE", match.id)

    db.flush()
    _recalculate_match_points(match.id, db)
    db.commit()
    logger.info("Updated scores for match %d (%d players)", match.id, len(playing_player_ids))


def _recalculate_match_points(match_id: int, db: Session):
    """Recalculate total_points for every user team in a match."""
    user_teams = (
        db.query(UserTeam)
        .options(joinedload(UserTeam.players))
        .filter(UserTeam.match_id == match_id)
        .all()
    )

    for ut in user_teams:
        total = 0.0
        for player in ut.players:
            perf = (
                db.query(PlayerMatchPerformance)
                .filter(
                    PlayerMatchPerformance.player_id == player.id,
                    PlayerMatchPerformance.match_id == match_id,
                )
                .first()
            )
            if perf:
                pts = calculate_player_points(perf, player.role)
                is_cap = player.id == ut.captain_id
                is_vc = player.id == ut.vice_captain_id
                total += calculate_final_points(pts["total_points"], is_cap, is_vc)
        ut.total_points = total


async def poll_live_matches():
    """Main scheduler job: find live matches and update their scores."""
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        matches = (
            db.query(Match)
            .filter(
                Match.cricbuzz_match_id.isnot(None),
                Match.status.in_([MatchStatus.LIVE, MatchStatus.UPCOMING]),
                Match.date <= now,
            )
            .all()
        )

        if not matches:
            return

        logger.info("Polling %d live/started match(es)", len(matches))
        for match in matches:
            try:
                await update_match_scores(match, db)
            except Exception:
                logger.exception("Error updating match %d", match.id)
                db.rollback()
    finally:
        db.close()


def start_scheduler():
    """Start the background scheduler (call once at app startup)."""
    scheduler.add_job(poll_live_matches, "interval", minutes=5, id="poll_scores", replace_existing=True)
    scheduler.start()
    logger.info("Score polling scheduler started (every 5 minutes)")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
