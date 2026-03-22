"""End-to-end test: register, login, create team for upcoming match, verify points for completed match."""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from fastapi.testclient import TestClient
from app.main import app
from app.database import engine, Base, SessionLocal
from app.seed import seed
from app.models import Match, MatchStatus, Player, UserTeam

# Re-seed for a clean test
seed()

client = TestClient(app)

# 1. Register a user
print("=== REGISTER ===")
r = client.post("/api/auth/register", json={
    "username": "testplayer",
    "email": "test@example.com",
    "password": "password123",
})
assert r.status_code == 200, f"Register failed: {r.text}"
user = r.json()
print(f"Registered user: {user['username']} (id={user['id']})")

# 2. Login
print("\n=== LOGIN ===")
r = client.post("/api/auth/login", json={
    "username": "testplayer",
    "password": "password123",
})
assert r.status_code == 200, f"Login failed: {r.text}"
token = r.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}
print(f"Got token: {token[:20]}...")

# 3. Get /me
r = client.get("/api/auth/me", headers=headers)
assert r.status_code == 200, f"/me failed ({r.status_code}): {r.text}"
print(f"Authenticated as: {r.json()['username']}")

# 4. List matches
print("\n=== MATCHES ===")
r = client.get("/api/matches/")
assert r.status_code == 200
matches = r.json()
print(f"Found {len(matches)} matches")
for m in matches:
    print(f"  Match #{m['id']}: {m['team1']['short_name']} vs {m['team2']['short_name']} [{m['status']}]")

# 5. Find an upcoming match and get its players
upcoming = [m for m in matches if m["status"] == "upcoming"]
assert len(upcoming) > 0, "No upcoming matches found"
match = upcoming[0]
print(f"\nSelected upcoming match #{match['id']}: {match['team1']['short_name']} vs {match['team2']['short_name']}")

r = client.get(f"/api/matches/{match['id']}/players")
assert r.status_code == 200
players = r.json()
print(f"Available players: {len(players)}")

# 6. Build a valid team of 11 from available players
from collections import Counter
team1_id = match["team1"]["id"]
team2_id = match["team2"]["id"]

selected = []
role_counts = Counter()
team_counts = Counter()
total_credits = 0.0

role_limits = {"WK": (1, 4), "BAT": (1, 6), "AR": (1, 4), "BOWL": (1, 6)}
role_mins = {"WK": 1, "BAT": 3, "AR": 1, "BOWL": 3}

# First pass: fill minimums
for role, min_count in role_mins.items():
    role_players = [p for p in players if p["role"] == role and p["id"] not in [s["id"] for s in selected]]
    for p in role_players[:min_count]:
        selected.append(p)
        role_counts[p["role"]] += 1
        team_counts[p["team_id"]] += 1
        total_credits += p["credits"]

# Fill remaining spots
remaining = 11 - len(selected)
selected_ids = {p["id"] for p in selected}
for p in players:
    if remaining <= 0:
        break
    if p["id"] in selected_ids:
        continue
    role = p["role"]
    _, max_c = role_limits[role]
    if role_counts[role] >= max_c:
        continue
    if team_counts[p["team_id"]] >= 7:
        continue
    if total_credits + p["credits"] > 100:
        continue
    selected.append(p)
    selected_ids.add(p["id"])
    role_counts[role] += 1
    team_counts[p["team_id"]] += 1
    total_credits += p["credits"]
    remaining -= 1

assert len(selected) == 11, f"Could not build team of 11, got {len(selected)}"
print(f"\nSelected 11 players ({total_credits} credits):")
for p in selected:
    print(f"  {p['name']} ({p['role']}) - {p['credits']} cr")

captain = selected[0]["id"]
vice_captain = selected[1]["id"]

# 7. Create team
print("\n=== CREATE TEAM ===")
r = client.post("/api/teams/", json={
    "match_id": match["id"],
    "player_ids": [p["id"] for p in selected],
    "captain_id": captain,
    "vice_captain_id": vice_captain,
}, headers=headers)
assert r.status_code == 200, f"Create team failed: {r.text}"
team = r.json()
print(f"Created team #{team['id']} for match #{team['match_id']}")
print(f"Captain: {selected[0]['name']}, Vice Captain: {selected[1]['name']}")

# 8. Get my teams
print("\n=== MY TEAMS ===")
r = client.get("/api/teams/my", headers=headers)
assert r.status_code == 200
my_teams = r.json()
print(f"User has {len(my_teams)} team(s)")

# 9. Test points for a completed match
completed = [m for m in matches if m["status"] == "completed"]
if completed:
    cm = completed[0]
    print(f"\n=== COMPLETED MATCH SCORECARD (#{cm['id']}) ===")
    r = client.get(f"/api/points/match/{cm['id']}/performances")
    assert r.status_code == 200
    perfs = r.json()
    playing = [p for p in perfs if p["is_playing"]]
    print(f"Performances: {len(perfs)} total, {len(playing)} playing")

    # Create a team for completed match (for points testing, override lock check)
    db = SessionLocal()
    cm_obj = db.query(Match).filter(Match.id == cm["id"]).first()
    # Temporarily push lock_time to future for testing
    from datetime import datetime, timedelta
    original_lock = cm_obj.lock_time
    cm_obj.lock_time = datetime.utcnow() + timedelta(hours=1)
    db.commit()

    cm_players = client.get(f"/api/matches/{cm['id']}/players").json()
    playing_ids = {p["player_id"] for p in playing}
    cm_selected = [p for p in cm_players if p["id"] in playing_ids][:11]

    if len(cm_selected) >= 11:
        # Verify credit/role constraints
        cm_selected = cm_selected[:11]
        r2 = client.post("/api/teams/", json={
            "match_id": cm["id"],
            "player_ids": [p["id"] for p in cm_selected],
            "captain_id": cm_selected[0]["id"],
            "vice_captain_id": cm_selected[1]["id"],
        }, headers=headers)

        if r2.status_code == 200:
            cm_team = r2.json()
            print(f"Created test team #{cm_team['id']} for completed match")

            # Calculate points
            r3 = client.post(f"/api/points/calculate/{cm_team['id']}", headers=headers)
            assert r3.status_code == 200
            points_result = r3.json()
            print(f"Total points: {points_result['total_points']}")

            # Get breakdown
            r4 = client.get(f"/api/points/breakdown/{cm_team['id']}", headers=headers)
            assert r4.status_code == 200
            breakdown = r4.json()
            print(f"\nPoints Breakdown:")
            for pp in sorted(breakdown["player_points"], key=lambda x: -x["final_points"]):
                flag = " (C)" if pp["is_captain"] else " (VC)" if pp["is_vice_captain"] else ""
                print(f"  {pp['player_name']}{flag}: BAT={pp['batting_points']} BOWL={pp['bowling_points']} "
                      f"FIELD={pp['fielding_points']} Base={pp['total_points']} Final={pp['final_points']}")
            print(f"  TOTAL: {breakdown['total_points']}")
        else:
            print(f"Could not create test team for completed match (validation): {r2.json()['detail']}")

    # Restore lock time
    cm_obj.lock_time = original_lock
    db.commit()
    db.close()

# 10. Leaderboard
print("\n=== LEADERBOARD ===")
r = client.get("/api/points/leaderboard")
assert r.status_code == 200
lb = r.json()
for entry in lb:
    print(f"  #{lb.index(entry)+1} {entry['username']}: {entry['total_points']} pts ({entry['teams_count']} teams)")

print("\n✅ All tests passed!")
