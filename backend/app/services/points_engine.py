from app.models import PlayerMatchPerformance, PlayerRole


def calculate_batting_points(perf: PlayerMatchPerformance, role: PlayerRole) -> float:
    pts = 0.0
    pts += perf.runs * 1
    pts += perf.fours * 4  # boundary bonus
    pts += perf.sixes * 6  # six bonus

    # Milestone bonus (highest achieved only)
    if perf.runs >= 100:
        pts += 16
    elif perf.runs >= 75:
        pts += 12
    elif perf.runs >= 50:
        pts += 8
    elif perf.runs >= 25:
        pts += 4

    if perf.runs == 0 and perf.balls_faced > 0 and role in (PlayerRole.BAT, PlayerRole.WK, PlayerRole.AR):
        pts -= 2  # duck

    # Strike-rate points (except pure bowlers), min 10 balls
    if role != PlayerRole.BOWL and perf.balls_faced >= 10:
        sr = (perf.runs * 100.0) / perf.balls_faced if perf.balls_faced > 0 else 0.0
        if sr > 170:
            pts += 6
        elif sr >= 150:
            pts += 4
        elif sr >= 130:
            pts += 2
        elif 60 <= sr < 70:
            pts -= 2
        elif 50 <= sr < 60:
            pts -= 4
        elif sr < 50:
            pts -= 6

    return pts


def calculate_bowling_points(perf: PlayerMatchPerformance) -> float:
    pts = 0.0
    pts += perf.wickets * 30

    # Wicket milestone bonus (highest achieved only)
    if perf.wickets >= 5:
        pts += 12
    elif perf.wickets >= 4:
        pts += 8
    elif perf.wickets >= 3:
        pts += 4

    pts += perf.maidens * 12

    # Economy-rate points (min 2 overs)
    if perf.overs_bowled >= 2:
        econ = perf.runs_conceded / perf.overs_bowled if perf.overs_bowled > 0 else 99.0
        if econ < 5:
            pts += 6
        elif econ < 6:
            pts += 4
        elif econ <= 7:
            pts += 2
        elif 10 <= econ <= 11:
            pts -= 2
        elif 11 < econ <= 12:
            pts -= 4
        elif econ > 12:
            pts -= 6
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
    bonus = 4.0 if perf.is_playing else 0.0  # announced lineup / playing substitute bonus

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
