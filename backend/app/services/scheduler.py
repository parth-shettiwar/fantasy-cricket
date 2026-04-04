"""Background scheduler that polls Cricbuzz for live match scores.

Playing-XI lock semantics
-------------------------
The first time the scraper detects players for a match (toss / start),
the set of playing player IDs is frozen into ``Match.locked_playing_ids``
(JSON array).  All subsequent substitution logic and scoring use that
snapshot so that mid-game changes (e.g. IPL Impact Player swaps) do NOT
alter fantasy teams.  Player *stats* (runs, wickets …) keep updating for
all players that appear in the scorecard, but only locked-in players
count towards ``is_playing`` for fantasy purposes.
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections import Counter
from datetime import datetime
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.orm import Session, joinedload
from passlib.context import CryptContext

from app.database import SessionLocal
from app.models import (
    Match, MatchStatus, Player, PlayerMatchPerformance, PlayerRole,
    User, UserTeam, UserTeamSubstitute, user_team_players,
)
from app.services.cricket_scraper import (
    scrape_scorecard, build_player_name_index, match_player_name,
)
from app.services.points_engine import calculate_player_points, calculate_final_points

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
AI_BOT_USERNAME = "Aladdin"
AI_BOT_EMAIL = "aladdin.bot@fantasy.local"

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


def _get_locked_ids(match: Match) -> Optional[set[int]]:
    """Return the frozen playing-XI set, or None if not yet locked."""
    if match.locked_playing_ids:
        return set(json.loads(match.locked_playing_ids))
    return None


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

    scraped_playing_ids: set[int] = set()
    batting_by_id: dict[int, dict] = {}
    bowling_by_id: dict[int, dict] = {}
    fielding_by_id: dict[int, dict] = {}

    for entry in scorecard.batting:
        pid = match_player_name(entry.name, name_index)
        if pid is None:
            continue
        scraped_playing_ids.add(pid)
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
        scraped_playing_ids.add(pid)
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

    # --- Lock / expand playing XI as innings data arrives ---
    locked_ids = _get_locked_ids(match)
    if locked_ids is None and scraped_playing_ids:
        match.locked_playing_ids = json.dumps(sorted(scraped_playing_ids))
        locked_ids = scraped_playing_ids
        logger.info(
            "Match %d: locked playing XI (%d players) at first detection",
            match.id, len(locked_ids),
        )
    elif locked_ids is not None and scraped_playing_ids - locked_ids:
        new_players = scraped_playing_ids - locked_ids
        locked_ids = locked_ids | scraped_playing_ids
        match.locked_playing_ids = json.dumps(sorted(locked_ids))
        logger.info(
            "Match %d: expanded playing XI by %d players (now %d total)",
            match.id, len(new_players), len(locked_ids),
        )

    for player in players:
        perf = (
            db.query(PlayerMatchPerformance)
            .filter(
                PlayerMatchPerformance.player_id == player.id,
                PlayerMatchPerformance.match_id == match.id,
            )
            .first()
        )

        # Stats update for ALL players seen in scorecard (including impact
        # players), but is_playing is based on the FROZEN set.
        in_scorecard = player.id in scraped_playing_ids
        is_playing = player.id in locked_ids if locked_ids else in_scorecard
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
    _recalculate_match_points(match, db)
    db.commit()
    logger.info("Updated scores for match %d (%d scraped, %s locked)",
                match.id, len(scraped_playing_ids),
                len(locked_ids) if locked_ids else "unlocked")


def _is_player_playing_locked(player_id: int, match: Match, match_id: int, db: Session) -> bool:
    """Check if a player is in the playing XI using the frozen set."""
    locked = _get_locked_ids(match)
    if locked is not None:
        return player_id in locked
    perf = (
        db.query(PlayerMatchPerformance)
        .filter(
            PlayerMatchPerformance.player_id == player_id,
            PlayerMatchPerformance.match_id == match_id,
        )
        .first()
    )
    return perf is not None and perf.is_playing


def _build_effective_xi(ut: UserTeam, match_id: int, db: Session, match: Optional[Match] = None) -> list[Player]:
    """Build the effective playing XI after auto-substitution.

    Uses the frozen playing-XI snapshot when available so that mid-match
    changes (impact player swaps) are ignored.

    Rules:
    1. If a main player is in the locked XI, keep them.
    2. If not, try to sub with the same role first (priority order).
    3. If no same-role sub, use any available playing sub.
    4. If no valid sub, that slot is simply lost.
    """
    if match is None:
        match = db.query(Match).filter(Match.id == match_id).first()

    subs = (
        db.query(UserTeamSubstitute)
        .options(joinedload(UserTeamSubstitute.player))
        .filter(UserTeamSubstitute.user_team_id == ut.id)
        .order_by(UserTeamSubstitute.priority)
        .all()
    )

    effective = []
    used_sub_ids: set[int] = set()

    playing_main = []
    not_playing_main = []
    for player in ut.players:
        if _is_player_playing_locked(player.id, match, match_id, db):
            playing_main.append(player)
        else:
            not_playing_main.append(player)

    effective.extend(playing_main)

    role_counts = Counter(p.role for p in playing_main)

    for missing_player in not_playing_main:
        replacement = None

        for sub_entry in subs:
            if sub_entry.player_id in used_sub_ids:
                continue
            sub_player = sub_entry.player
            if not _is_player_playing_locked(sub_player.id, match, match_id, db):
                continue
            if sub_player.role == missing_player.role:
                replacement = sub_entry
                break

        if not replacement:
            for sub_entry in subs:
                if sub_entry.player_id in used_sub_ids:
                    continue
                sub_player = sub_entry.player
                if not _is_player_playing_locked(sub_player.id, match, match_id, db):
                    continue
                replacement = sub_entry
                break

        if replacement:
            effective.append(replacement.player)
            used_sub_ids.add(replacement.player_id)
            role_counts[replacement.player.role] = role_counts.get(replacement.player.role, 0) + 1

    return effective


def _recalculate_match_points(match: Match, db: Session):
    """Recalculate total_points for every user team in a match."""
    user_teams = (
        db.query(UserTeam)
        .options(
            joinedload(UserTeam.players),
            joinedload(UserTeam.substitutes).joinedload(UserTeamSubstitute.player),
        )
        .filter(UserTeam.match_id == match.id)
        .all()
    )

    for ut in user_teams:
        effective_players = _build_effective_xi(ut, match.id, db, match=match)
        total = 0.0
        for player in effective_players:
            perf = (
                db.query(PlayerMatchPerformance)
                .filter(
                    PlayerMatchPerformance.player_id == player.id,
                    PlayerMatchPerformance.match_id == match.id,
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


def _get_or_create_ai_user(db: Session) -> User:
    user = db.query(User).filter(User.username == AI_BOT_USERNAME).first()
    if user:
        return user
    user = User(
        username=AI_BOT_USERNAME,
        email=AI_BOT_EMAIL,
        password_hash=pwd_context.hash("AladdinTemp@2026!"),
    )
    db.add(user)
    db.flush()
    logger.info("Created AI bot user: %s", AI_BOT_USERNAME)
    return user


def _project_player_for_match(player: Player, target_match: Match, db: Session) -> float:
    perfs = (
        db.query(PlayerMatchPerformance)
        .options(joinedload(PlayerMatchPerformance.match))
        .filter(PlayerMatchPerformance.player_id == player.id)
        .all()
    )
    hist = [
        p for p in perfs
        if p.match and p.match.date and p.match.date < target_match.date
    ]
    if not hist:
        return ROLE_BASELINE[player.role]

    hist.sort(key=lambda x: x.match.date)
    recent = hist[-20:]
    weighted = 0.0
    weight_sum = 0.0
    for i, perf in enumerate(recent):
        w = i + 1
        weight_sum += w
        weighted += calculate_player_points(perf, player.role)["total_points"] * w
    return weighted / max(weight_sum, 1.0)


def _build_ai_team(match: Match, db: Session) -> list[Player]:
    pool = (
        db.query(Player)
        .filter(Player.team_id.in_([match.team1_id, match.team2_id]))
        .all()
    )
    if len(pool) < 11:
        return []

    projected = {p.id: _project_player_for_match(p, match, db) for p in pool}
    team: list[Player] = []
    role_counts: Counter = Counter()
    team_counts: Counter = Counter()
    credits = 0.0

    # Satisfy minimum role constraints first.
    for role, (min_c, _) in ROLE_CONSTRAINTS.items():
        role_players = sorted(
            [p for p in pool if p.role == role and p.id not in {x.id for x in team}],
            key=lambda p: projected[p.id],
            reverse=True,
        )
        for p in role_players:
            if role_counts[role] >= min_c:
                break
            if credits + p.credits > MAX_CREDITS:
                continue
            if team_counts[p.team_id] >= 7:
                continue
            team.append(p)
            role_counts[p.role] += 1
            team_counts[p.team_id] += 1
            credits += p.credits

    # Fill remaining slots by best projected points while respecting max limits.
    for p in sorted(pool, key=lambda x: projected[x.id], reverse=True):
        if len(team) >= 11:
            break
        if p.id in {x.id for x in team}:
            continue
        _, max_c = ROLE_CONSTRAINTS[p.role]
        if role_counts[p.role] >= max_c:
            continue
        if team_counts[p.team_id] >= 7:
            continue
        if credits + p.credits > MAX_CREDITS:
            continue
        team.append(p)
        role_counts[p.role] += 1
        team_counts[p.team_id] += 1
        credits += p.credits

    if len(team) != 11:
        return []
    # Final hard validation.
    for role, (min_c, max_c) in ROLE_CONSTRAINTS.items():
        c = role_counts.get(role, 0)
        if c < min_c or c > max_c:
            return []
    return team


async def submit_ai_teams():
    """Auto-submit AI bot teams about 3 hours before each upcoming match."""
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        ai_user = _get_or_create_ai_user(db)
        matches = (
            db.query(Match)
            .options(joinedload(Match.team1), joinedload(Match.team2))
            .filter(Match.status == MatchStatus.UPCOMING)
            .all()
        )
        for match in matches:
            if not match.date or not match.lock_time:
                continue
            seconds_to_match = (match.date - now).total_seconds()
            # Trigger window: from 3h before match until lock time.
            if not (match.lock_time > now and seconds_to_match <= 3 * 3600):
                continue

            existing_teams = (
                db.query(UserTeam)
                .filter(UserTeam.user_id == ai_user.id, UserTeam.match_id == match.id)
                .order_by(UserTeam.id.desc())
                .all()
            )

            # Defensive cleanup: if duplicates exist, keep latest and remove extras.
            if len(existing_teams) > 1:
                keep_id = existing_teams[0].id
                for dup in existing_teams[1:]:
                    db.execute(
                        user_team_players.delete().where(user_team_players.c.user_team_id == dup.id)
                    )
                    db.query(UserTeamSubstitute).filter(
                        UserTeamSubstitute.user_team_id == dup.id
                    ).delete()
                    db.query(UserTeam).filter(UserTeam.id == dup.id).delete()
                db.commit()
                logger.warning(
                    "Cleaned duplicate AI teams for match %d, kept team %d",
                    match.id,
                    keep_id,
                )

            existing = (
                db.query(UserTeam)
                .filter(UserTeam.user_id == ai_user.id, UserTeam.match_id == match.id)
                .first()
            )
            if existing:
                continue

            team_players = _build_ai_team(match, db)
            if len(team_players) != 11:
                logger.warning("AI bot team generation failed for match %d", match.id)
                continue

            projected = sorted(
                team_players,
                key=lambda p: _project_player_for_match(p, match, db),
                reverse=True,
            )
            captain_id = projected[0].id
            vice_captain_id = projected[1].id

            ut = UserTeam(
                user_id=ai_user.id,
                match_id=match.id,
                captain_id=captain_id,
                vice_captain_id=vice_captain_id,
            )
            db.add(ut)
            db.flush()
            for p in team_players:
                db.execute(user_team_players.insert().values(user_team_id=ut.id, player_id=p.id))
            db.commit()
            logger.info("AI bot submitted team for match %d (%s vs %s)", match.id, match.team1.short_name, match.team2.short_name)
    except Exception:
        logger.exception("AI bot submission job failed")
        db.rollback()
    finally:
        db.close()


def start_scheduler():
    """Start the background scheduler (call once at app startup)."""
    scheduler.add_job(poll_live_matches, "interval", minutes=5, id="poll_scores", replace_existing=True)
    scheduler.add_job(submit_ai_teams, "interval", minutes=10, id="submit_ai_teams", replace_existing=True)
    scheduler.start()
    logger.info("Schedulers started: poll_scores(5m), submit_ai_teams(10m)")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
