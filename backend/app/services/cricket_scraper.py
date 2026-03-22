"""Scrape live cricket scorecard data from Cricbuzz embedded JSON."""
from __future__ import annotations

import json
import re
import logging
from dataclasses import dataclass, field
from typing import Optional

import httpx
from bs4 import BeautifulSoup
from thefuzz import process as fuzz_process

logger = logging.getLogger(__name__)

CRICBUZZ_SCORECARD_URL = "https://www.cricbuzz.com/live-cricket-scorecard/{match_id}"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
}

FUZZY_THRESHOLD = 80


@dataclass
class BattingEntry:
    name: str
    runs: int = 0
    balls: int = 0
    fours: int = 0
    sixes: int = 0
    out_desc: str = ""
    wicket_code: str = ""
    fielder_name: str = ""


@dataclass
class BowlingEntry:
    name: str
    overs: float = 0.0
    maidens: int = 0
    runs_conceded: int = 0
    wickets: int = 0


@dataclass
class FieldingEntry:
    name: str
    catches: int = 0
    stumpings: int = 0
    run_outs: int = 0


@dataclass
class ScorecardData:
    match_status: str = ""
    batting: list[BattingEntry] = field(default_factory=list)
    bowling: list[BowlingEntry] = field(default_factory=list)
    fielding: dict[str, FieldingEntry] = field(default_factory=dict)
    is_complete: bool = False


def _extract_innings_json(html: str) -> list[dict]:
    """Extract innings data from Cricbuzz Next.js embedded JSON."""
    innings_list = []

    pattern = re.compile(
        r'\\"matchId\\":\d+,\\"inningsId\\":(\d+),\\"timeScore\\":\d+,'
        r'\\"batTeamDetails\\":(.*?),\\"bowlTeamDetails\\":(.*?)(?:,\\"partnershipsData|,\\"ppData|\\"extras)'
    )

    # The data is double-escaped JSON inside script tags. Let's find all innings blocks.
    # Strategy: find all "inningsId" occurrences and extract the surrounding JSON
    bat_team_pattern = re.compile(
        r'\"batsmenData\":\{((?:\"bat_\d+\":\{[^}]+\},?)+)\}'
    )
    bowl_team_pattern = re.compile(
        r'\"bowlersData\":\{((?:\"bowl_\d+\":\{[^}]+\},?)+)\}'
    )

    # First, unescape the double-escaped JSON
    unescaped = html.replace('\\"', '"').replace('\\\\', '\\')

    # Find all innings blocks by looking for inningsId pattern
    innings_pattern = re.compile(
        r'"inningsId":(\d+),"timeScore":\d+,"batTeamDetails":\{[^}]*"batsmenData":\{(.*?)\},"bowlTeamDetails":\{[^}]*"bowlersData":\{(.*?)\}'
    )

    # Simpler approach: find individual batsman and bowler entries
    bat_entries = re.findall(
        r'"bat_\d+":\{"batId":\d+,"batName":"([^"]+)"[^}]*"runs":(\d+),"balls":(\d+),'
        r'[^}]*"fours":(\d+),"sixes":(\d+),[^}]*"outDesc":"([^"]*)"[^}]*'
        r'"wicketCode":"([^"]*)"',
        unescaped,
    )

    bowl_entries = re.findall(
        r'"bowl_\d+":\{"bowlerId":\d+,"bowlName":"([^"]+)"[^}]*'
        r'"overs":([\d.]+),"maidens":(\d+),"runs":(\d+),"wickets":(\d+)',
        unescaped,
    )

    # Find match status
    status_match = re.search(r'"status":"([^"]+)"', unescaped)
    result_match = re.search(r'"resultType":"([^"]+)"', unescaped)

    return {
        "batting": bat_entries,
        "bowling": bowl_entries,
        "status": status_match.group(1) if status_match else "",
        "result_type": result_match.group(1) if result_match else "",
    }


def _extract_fielding_from_dismissal(out_desc: str, fielding: dict):
    """Parse fielding contributions from dismissal descriptions like 'c Shaheen Afridi b Salman Agha'."""
    if not out_desc:
        return

    caught = re.match(r"c\s+(.+?)\s+b\s+", out_desc)
    if caught:
        name = caught.group(1).strip()
        if name and name.lower() not in ("sub",):
            fielding.setdefault(name, FieldingEntry(name=name))
            fielding[name].catches += 1

    if out_desc.startswith("st "):
        st = re.match(r"st\s+(.+?)\s+b\s+", out_desc)
        if st:
            name = st.group(1).strip()
            if name:
                fielding.setdefault(name, FieldingEntry(name=name))
                fielding[name].stumpings += 1

    if "run out" in out_desc.lower():
        ro = re.search(r"run out\s*\((.+?)\)", out_desc)
        if ro:
            names = [n.strip() for n in ro.group(1).split("/")]
            for name in names:
                if name:
                    fielding.setdefault(name, FieldingEntry(name=name))
                    fielding[name].run_outs += 1


async def scrape_scorecard(cricbuzz_match_id: str) -> Optional[ScorecardData]:
    """Scrape full scorecard from Cricbuzz for a given match ID."""
    url = CRICBUZZ_SCORECARD_URL.format(match_id=cricbuzz_match_id)
    logger.info("Scraping scorecard from %s", url)

    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(url, headers=HEADERS)
            resp.raise_for_status()
    except httpx.HTTPError as exc:
        logger.error("Failed to fetch scorecard: %s", exc)
        return None

    soup = BeautifulSoup(resp.text, "html.parser")
    data = ScorecardData()

    # Find the large script tag with embedded match data
    raw_json_text = ""
    for script in soup.find_all("script"):
        text = script.string or ""
        if "batName" in text and len(text) > 10000:
            raw_json_text = text
            break

    if not raw_json_text:
        logger.warning("No embedded match data found for match %s", cricbuzz_match_id)
        return None

    extracted = _extract_innings_json(raw_json_text)

    data.match_status = extracted["status"]
    if extracted["result_type"] in ("win", "tie", "draw", "no_result"):
        data.is_complete = True

    seen_batters = set()
    for name, runs, balls, fours, sixes, out_desc, wicket_code in extracted["batting"]:
        if name in seen_batters:
            continue
        seen_batters.add(name)
        data.batting.append(BattingEntry(
            name=name,
            runs=int(runs),
            balls=int(balls),
            fours=int(fours),
            sixes=int(sixes),
            out_desc=out_desc,
            wicket_code=wicket_code,
        ))
        _extract_fielding_from_dismissal(out_desc, data.fielding)

    seen_bowlers = set()
    for name, overs, maidens, runs, wickets in extracted["bowling"]:
        if name in seen_bowlers:
            continue
        seen_bowlers.add(name)
        data.bowling.append(BowlingEntry(
            name=name,
            overs=float(overs),
            maidens=int(maidens),
            runs_conceded=int(runs),
            wickets=int(wickets),
        ))

    logger.info(
        "Scraped match %s: %d batters, %d bowlers, %d fielders, complete=%s",
        cricbuzz_match_id, len(data.batting), len(data.bowling),
        len(data.fielding), data.is_complete,
    )
    return data


def _normalize_name(name: str) -> str:
    """Strip annotations like (c), (wk), *, leading/trailing whitespace."""
    name = re.sub(r"\s*\(.*?\)", "", name)
    name = name.replace("*", "").replace("†", "").strip()
    return name


def build_player_name_index(players: list) -> dict[str, int]:
    """Build a lookup from normalized player name -> player.id."""
    index = {}
    for p in players:
        normalized = _normalize_name(p.name).lower()
        index[normalized] = p.id
    return index


def match_player_name(scraped_name: str, name_index: dict[str, int]) -> Optional[int]:
    """Fuzzy-match a scraped player name to our DB player ID."""
    normalized = _normalize_name(scraped_name).lower()

    if normalized in name_index:
        return name_index[normalized]

    result = fuzz_process.extractOne(normalized, name_index.keys(), score_cutoff=FUZZY_THRESHOLD)
    if result:
        matched_name, score, *_ = result
        logger.info("Fuzzy matched '%s' -> '%s' (score=%d)", scraped_name, matched_name, score)
        return name_index[matched_name]

    logger.warning("Could not match player: '%s'", scraped_name)
    return None
