from app.models import PlayerMatchPerformance, PlayerRole


def calculate_batting_points(perf: PlayerMatchPerformance, role: PlayerRole) -> float:
    pts = 0.0
    pts += perf.runs * 1
    pts += perf.fours * 1  # boundary bonus
    pts += perf.sixes * 2  # six bonus

    if perf.runs >= 100:
        pts += 16
    elif perf.runs >= 50:
        pts += 8

    if perf.runs == 0 and perf.balls_faced > 0 and role in (PlayerRole.BAT, PlayerRole.WK, PlayerRole.AR):
        pts -= 2  # duck

    return pts


def calculate_bowling_points(perf: PlayerMatchPerformance) -> float:
    pts = 0.0
    pts += perf.wickets * 25

    if perf.wickets >= 5:
        pts += 16
    elif perf.wickets >= 4:
        pts += 8

    pts += perf.maidens * 8
    return pts


def calculate_fielding_points(perf: PlayerMatchPerformance) -> float:
    pts = 0.0
    pts += perf.catches * 8
    pts += perf.stumpings * 12
    pts += perf.run_outs * 12

    if perf.catches >= 3:
        pts += 4  # 3-catch bonus

    return pts


def calculate_player_points(perf: PlayerMatchPerformance, role: PlayerRole) -> dict:
    batting = calculate_batting_points(perf, role)
    bowling = calculate_bowling_points(perf)
    fielding = calculate_fielding_points(perf)
    bonus = 4.0 if perf.is_playing else 0.0  # playing XI bonus

    return {
        "batting_points": batting,
        "bowling_points": bowling,
        "fielding_points": fielding,
        "bonus_points": bonus,
        "total_points": batting + bowling + fielding + bonus,
    }


def calculate_final_points(base_points: float, is_captain: bool, is_vice_captain: bool) -> float:
    if is_captain:
        return base_points * 2.0
    if is_vice_captain:
        return base_points * 1.5
    return base_points
