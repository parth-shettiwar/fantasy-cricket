"""Scrape live cricket scorecard data from Cricbuzz."""

import re
import logging
from dataclasses import dataclass, field

import httpx
from bs4 import BeautifulSoup
from thefuzz import process as fuzz_process

logger = logging.getLogger(__name__)

CRICBUZZ_BASE = "https://www.cricbuzz.com"
SCORECARD_URL = f"{CRICBUZZ_BASE}/live-cricket-scorecard/{{match_id}}"
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
    dismissal: str = ""


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


def _safe_int(val: str) -> int:
    try:
        return int(val.strip().replace("*", ""))
    except (ValueError, AttributeError):
        return 0


def _safe_float(val: str) -> float:
    try:
        return float(val.strip())
    except (ValueError, AttributeError):
        return 0.0


def _normalize_name(name: str) -> str:
    """Strip annotations like (c), (wk), *, leading/trailing whitespace."""
    name = re.sub(r"\s*\(.*?\)", "", name)
    name = name.replace("*", "").replace("†", "").strip()
    return name


def _parse_fielding_from_dismissal(dismissal: str, fielding: dict[str, FieldingEntry]):
    """Extract fielder names from dismissal descriptions like 'c Smith b Jones'."""
    dismissal = dismissal.strip()

    caught = re.match(r"c\s+(.+?)\s+b\s+", dismissal)
    if caught:
        name = _normalize_name(caught.group(1))
        if name and name.lower() not in ("sub", "†"):
            fielding.setdefault(name, FieldingEntry(name=name))
            fielding[name].catches += 1

    if "st " in dismissal.lower():
        st = re.match(r"st\s+(.+?)\s+b\s+", dismissal)
        if st:
            name = _normalize_name(st.group(1))
            if name:
                fielding.setdefault(name, FieldingEntry(name=name))
                fielding[name].stumpings += 1

    if "run out" in dismissal.lower():
        ro = re.search(r"run out\s*\((.+?)\)", dismissal)
        if ro:
            names = [_normalize_name(n) for n in ro.group(1).split("/")]
            for name in names:
                if name:
                    fielding.setdefault(name, FieldingEntry(name=name))
                    fielding[name].run_outs += 1


async def scrape_scorecard(cricbuzz_match_id: str) -> ScorecardData | None:
    """Scrape full scorecard from Cricbuzz for a given match ID."""
    url = SCORECARD_URL.format(match_id=cricbuzz_match_id)
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

    status_el = soup.select_one(".cb-col.cb-col-100.cb-min-stts")
    if status_el:
        data.match_status = status_el.get_text(strip=True)
        if any(kw in data.match_status.lower() for kw in ("won", "tied", "draw", "no result")):
            data.is_complete = True

    batting_tables = soup.select("div.cb-col.cb-col-100.cb-ltst-wgt")

    for section in batting_tables:
        rows = section.select("div.cb-col.cb-col-100.cb-scrd-itms")
        for row in rows:
            cols = row.select("div.cb-col")
            if len(cols) < 7:
                continue

            name_el = cols[0].select_one("a")
            if not name_el:
                continue

            name = _normalize_name(name_el.get_text(strip=True))
            if not name or name.lower() in ("extras", "total", "did not bat"):
                continue

            dismissal_text = ""
            dismissal_el = cols[1] if len(cols) > 1 else None
            if dismissal_el:
                dismissal_text = dismissal_el.get_text(strip=True)

            entry = BattingEntry(
                name=name,
                runs=_safe_int(cols[2].get_text()) if len(cols) > 2 else 0,
                balls=_safe_int(cols[3].get_text()) if len(cols) > 3 else 0,
                fours=_safe_int(cols[4].get_text()) if len(cols) > 4 else 0,
                sixes=_safe_int(cols[5].get_text()) if len(cols) > 5 else 0,
                dismissal=dismissal_text,
            )
            data.batting.append(entry)

            _parse_fielding_from_dismissal(dismissal_text, data.fielding)

    bowling_sections = soup.select("div.cb-col.cb-col-100.cb-ltst-wgt")
    for section in bowling_sections:
        header = section.select_one("div.cb-col.cb-col-100.cb-scrd-hdr")
        if not header:
            continue
        header_text = header.get_text(strip=True).lower()
        if "bowling" not in header_text:
            continue

        rows = section.select("div.cb-col.cb-col-100.cb-scrd-itms")
        for row in rows:
            cols = row.select("div.cb-col")
            if len(cols) < 5:
                continue

            name_el = cols[0].select_one("a")
            if not name_el:
                continue

            name = _normalize_name(name_el.get_text(strip=True))
            if not name:
                continue

            entry = BowlingEntry(
                name=name,
                overs=_safe_float(cols[1].get_text()) if len(cols) > 1 else 0,
                maidens=_safe_int(cols[2].get_text()) if len(cols) > 2 else 0,
                runs_conceded=_safe_int(cols[3].get_text()) if len(cols) > 3 else 0,
                wickets=_safe_int(cols[4].get_text()) if len(cols) > 4 else 0,
            )
            data.bowling.append(entry)

    return data


def build_player_name_index(players: list) -> dict[str, int]:
    """Build a lookup from normalized player name -> player.id."""
    index = {}
    for p in players:
        normalized = _normalize_name(p.name).lower()
        index[normalized] = p.id
    return index


def match_player_name(scraped_name: str, name_index: dict[str, int]) -> int | None:
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
