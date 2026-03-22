"""Seed the database with IPL 2026 teams, players, and sample matches."""
import random
from datetime import datetime, timedelta
from app.database import engine, SessionLocal, Base
from app.models import (
    IPLTeam, Player, Match, PlayerMatchPerformance,
    PlayerRole, MatchStatus,
)

TEAMS = [
    ("Mumbai Indians", "MI"),
    ("Chennai Super Kings", "CSK"),
    ("Royal Challengers Bengaluru", "RCB"),
    ("Kolkata Knight Riders", "KKR"),
    ("Delhi Capitals", "DC"),
    ("Rajasthan Royals", "RR"),
    ("Sunrisers Hyderabad", "SRH"),
    ("Punjab Kings", "PBKS"),
    ("Lucknow Super Giants", "LSG"),
    ("Gujarat Titans", "GT"),
]

PLAYERS = {
    "MI": [
        ("Rohit Sharma", PlayerRole.BAT, 10.0),
        ("Suryakumar Yadav", PlayerRole.BAT, 9.5),
        ("Ishan Kishan", PlayerRole.WK, 9.0),
        ("Tilak Varma", PlayerRole.BAT, 8.5),
        ("Tim David", PlayerRole.AR, 8.5),
        ("Hardik Pandya", PlayerRole.AR, 10.0),
        ("Dewald Brevis", PlayerRole.BAT, 7.5),
        ("Jasprit Bumrah", PlayerRole.BOWL, 10.0),
        ("Piyush Chawla", PlayerRole.BOWL, 7.0),
        ("Akash Madhwal", PlayerRole.BOWL, 7.0),
        ("Arjun Tendulkar", PlayerRole.BOWL, 6.0),
        ("Nuwan Thushara", PlayerRole.BOWL, 7.0),
        ("Naman Dhir", PlayerRole.BAT, 6.5),
        ("Deepak Chahar", PlayerRole.BOWL, 8.0),
        ("Gerald Coetzee", PlayerRole.BOWL, 7.5),
        ("Shams Mulani", PlayerRole.AR, 6.5),
        ("Bevon Jacobs", PlayerRole.BAT, 6.0),
        ("Reece Topley", PlayerRole.BOWL, 7.0),
        ("Will Jacks", PlayerRole.AR, 8.0),
        ("Trent Boult", PlayerRole.BOWL, 9.0),
    ],
    "CSK": [
        ("Ruturaj Gaikwad", PlayerRole.BAT, 9.5),
        ("Devon Conway", PlayerRole.BAT, 8.5),
        ("Shivam Dube", PlayerRole.AR, 8.5),
        ("Moeen Ali", PlayerRole.AR, 8.0),
        ("Ravindra Jadeja", PlayerRole.AR, 9.5),
        ("MS Dhoni", PlayerRole.WK, 8.0),
        ("Matheesha Pathirana", PlayerRole.BOWL, 8.5),
        ("Tushar Deshpande", PlayerRole.BOWL, 7.5),
        ("Deepak Chahar", PlayerRole.BOWL, 8.0),
        ("Maheesh Theekshana", PlayerRole.BOWL, 7.5),
        ("Rajvardhan Hangargekar", PlayerRole.AR, 6.5),
        ("Sameer Rizvi", PlayerRole.BAT, 6.5),
        ("Avanish Rao Aravelly", PlayerRole.WK, 6.0),
        ("Shaik Rasheed", PlayerRole.BAT, 6.5),
        ("Nishant Sindhu", PlayerRole.AR, 6.0),
        ("Mukesh Choudhary", PlayerRole.BOWL, 6.5),
        ("Simarjeet Singh", PlayerRole.BOWL, 6.0),
        ("Rachin Ravindra", PlayerRole.AR, 8.5),
        ("Khaleel Ahmed", PlayerRole.BOWL, 7.5),
        ("Vijay Shankar", PlayerRole.AR, 7.0),
    ],
    "RCB": [
        ("Virat Kohli", PlayerRole.BAT, 10.5),
        ("Faf du Plessis", PlayerRole.BAT, 9.0),
        ("Glenn Maxwell", PlayerRole.AR, 9.0),
        ("Rajat Patidar", PlayerRole.BAT, 8.0),
        ("Dinesh Karthik", PlayerRole.WK, 7.5),
        ("Anuj Rawat", PlayerRole.WK, 6.5),
        ("Wanindu Hasaranga", PlayerRole.AR, 8.5),
        ("Mohammed Siraj", PlayerRole.BOWL, 8.5),
        ("Yash Dayal", PlayerRole.BOWL, 7.0),
        ("Karn Sharma", PlayerRole.BOWL, 6.5),
        ("Akash Deep", PlayerRole.BOWL, 7.0),
        ("Suyash Prabhudessai", PlayerRole.BAT, 6.5),
        ("Mahipal Lomror", PlayerRole.AR, 6.5),
        ("Himanshu Sharma", PlayerRole.BOWL, 6.0),
        ("Rajan Kumar", PlayerRole.BOWL, 6.0),
        ("Liam Livingstone", PlayerRole.AR, 8.5),
        ("Josh Hazlewood", PlayerRole.BOWL, 9.0),
        ("Phil Salt", PlayerRole.WK, 9.0),
        ("Krunal Pandya", PlayerRole.AR, 7.5),
        ("Bhuvneshwar Kumar", PlayerRole.BOWL, 8.0),
    ],
    "KKR": [
        ("Shreyas Iyer", PlayerRole.BAT, 9.0),
        ("Venkatesh Iyer", PlayerRole.AR, 8.0),
        ("Nitish Rana", PlayerRole.BAT, 8.0),
        ("Andre Russell", PlayerRole.AR, 9.5),
        ("Sunil Narine", PlayerRole.AR, 9.0),
        ("Rinku Singh", PlayerRole.BAT, 8.5),
        ("Phil Salt", PlayerRole.WK, 9.0),
        ("Varun Chakravarthy", PlayerRole.BOWL, 8.0),
        ("Mitchell Starc", PlayerRole.BOWL, 9.5),
        ("Harshit Rana", PlayerRole.BOWL, 7.5),
        ("Ramandeep Singh", PlayerRole.AR, 7.0),
        ("Anukul Roy", PlayerRole.AR, 6.0),
        ("Suyash Sharma", PlayerRole.BOWL, 6.0),
        ("Vaibhav Arora", PlayerRole.BOWL, 6.5),
        ("Manish Pandey", PlayerRole.BAT, 7.0),
        ("Angkrish Raghuvanshi", PlayerRole.BAT, 6.5),
        ("Rahmanullah Gurbaz", PlayerRole.WK, 8.5),
        ("Quinton de Kock", PlayerRole.WK, 9.0),
        ("Ajinkya Rahane", PlayerRole.BAT, 7.0),
        ("Moeen Ali", PlayerRole.AR, 8.0),
    ],
    "DC": [
        ("David Warner", PlayerRole.BAT, 9.5),
        ("Abishek Porel", PlayerRole.WK, 7.0),
        ("Axar Patel", PlayerRole.AR, 8.5),
        ("Tristan Stubbs", PlayerRole.BAT, 7.5),
        ("Jake Fraser-McGurk", PlayerRole.BAT, 8.0),
        ("Kuldeep Yadav", PlayerRole.BOWL, 8.5),
        ("Anrich Nortje", PlayerRole.BOWL, 8.5),
        ("Ishant Sharma", PlayerRole.BOWL, 7.0),
        ("Khaleel Ahmed", PlayerRole.BOWL, 7.5),
        ("Mukesh Kumar", PlayerRole.BOWL, 7.0),
        ("Lalit Yadav", PlayerRole.AR, 6.5),
        ("Pravin Dubey", PlayerRole.BOWL, 6.0),
        ("Ricky Bhui", PlayerRole.BAT, 6.5),
        ("Kumar Kushagra", PlayerRole.WK, 6.0),
        ("Shai Hope", PlayerRole.WK, 8.0),
        ("Mitchell Marsh", PlayerRole.AR, 9.0),
        ("KL Rahul", PlayerRole.WK, 9.5),
        ("Harry Brook", PlayerRole.BAT, 9.0),
        ("Faf du Plessis", PlayerRole.BAT, 8.5),
        ("Rasikh Salam", PlayerRole.BOWL, 6.5),
    ],
    "RR": [
        ("Sanju Samson", PlayerRole.WK, 9.5),
        ("Jos Buttler", PlayerRole.WK, 9.5),
        ("Yashasvi Jaiswal", PlayerRole.BAT, 10.0),
        ("Shimron Hetmyer", PlayerRole.BAT, 8.0),
        ("Riyan Parag", PlayerRole.AR, 8.0),
        ("Dhruv Jurel", PlayerRole.WK, 7.5),
        ("Ravichandran Ashwin", PlayerRole.BOWL, 8.0),
        ("Trent Boult", PlayerRole.BOWL, 9.0),
        ("Yuzvendra Chahal", PlayerRole.BOWL, 8.0),
        ("Sandeep Sharma", PlayerRole.BOWL, 7.0),
        ("Obed McCoy", PlayerRole.BOWL, 7.0),
        ("Navdeep Saini", PlayerRole.BOWL, 7.0),
        ("Kuldeep Sen", PlayerRole.BOWL, 6.5),
        ("Kunal Rathore", PlayerRole.BAT, 6.0),
        ("Abdul Basith", PlayerRole.AR, 6.0),
        ("Jofra Archer", PlayerRole.BOWL, 9.0),
        ("Wanindu Hasaranga", PlayerRole.AR, 8.5),
        ("Shubman Gill", PlayerRole.BAT, 9.5),
        ("Tushar Deshpande", PlayerRole.BOWL, 7.0),
        ("Maheesh Theekshana", PlayerRole.BOWL, 7.5),
    ],
    "SRH": [
        ("Travis Head", PlayerRole.BAT, 9.5),
        ("Abhishek Sharma", PlayerRole.AR, 8.5),
        ("Heinrich Klaasen", PlayerRole.WK, 9.5),
        ("Aiden Markram", PlayerRole.AR, 8.0),
        ("Abdul Samad", PlayerRole.BAT, 7.0),
        ("Rahul Tripathi", PlayerRole.BAT, 7.5),
        ("Pat Cummins", PlayerRole.BOWL, 9.5),
        ("Bhuvneshwar Kumar", PlayerRole.BOWL, 8.0),
        ("T Natarajan", PlayerRole.BOWL, 7.5),
        ("Umran Malik", PlayerRole.BOWL, 7.5),
        ("Marco Jansen", PlayerRole.AR, 8.0),
        ("Washington Sundar", PlayerRole.AR, 7.5),
        ("Mayank Agarwal", PlayerRole.BAT, 7.0),
        ("Glenn Phillips", PlayerRole.WK, 7.5),
        ("Jaydev Unadkat", PlayerRole.BOWL, 7.0),
        ("Shahbaz Ahmed", PlayerRole.AR, 6.5),
        ("Nitish Reddy", PlayerRole.AR, 7.5),
        ("Sanvir Singh", PlayerRole.BAT, 6.0),
        ("Upendra Yadav", PlayerRole.WK, 6.0),
        ("Fazalhaq Farooqi", PlayerRole.BOWL, 8.0),
    ],
    "PBKS": [
        ("Shikhar Dhawan", PlayerRole.BAT, 8.5),
        ("Prabhsimran Singh", PlayerRole.WK, 7.0),
        ("Liam Livingstone", PlayerRole.AR, 8.5),
        ("Jonny Bairstow", PlayerRole.WK, 8.5),
        ("Sam Curran", PlayerRole.AR, 9.0),
        ("Jitesh Sharma", PlayerRole.WK, 7.0),
        ("Kagiso Rabada", PlayerRole.BOWL, 9.5),
        ("Arshdeep Singh", PlayerRole.BOWL, 8.5),
        ("Rahul Chahar", PlayerRole.BOWL, 7.5),
        ("Nathan Ellis", PlayerRole.BOWL, 7.0),
        ("Harpreet Brar", PlayerRole.AR, 7.0),
        ("Ashutosh Sharma", PlayerRole.BAT, 6.5),
        ("Shashank Singh", PlayerRole.BAT, 7.0),
        ("Rishi Dhawan", PlayerRole.AR, 6.5),
        ("Vidwath Kaverappa", PlayerRole.BOWL, 6.0),
        ("Chris Woakes", PlayerRole.AR, 8.0),
        ("Shreyas Iyer", PlayerRole.BAT, 9.0),
        ("Yuzvendra Chahal", PlayerRole.BOWL, 8.0),
        ("Marcus Stoinis", PlayerRole.AR, 8.5),
        ("Lockie Ferguson", PlayerRole.BOWL, 8.0),
    ],
    "LSG": [
        ("KL Rahul", PlayerRole.WK, 10.0),
        ("Quinton de Kock", PlayerRole.WK, 9.0),
        ("Nicholas Pooran", PlayerRole.WK, 9.0),
        ("Devdutt Padikkal", PlayerRole.BAT, 7.5),
        ("Ayush Badoni", PlayerRole.BAT, 7.5),
        ("Deepak Hooda", PlayerRole.AR, 7.5),
        ("Krunal Pandya", PlayerRole.AR, 7.5),
        ("Marcus Stoinis", PlayerRole.AR, 8.5),
        ("Mark Wood", PlayerRole.BOWL, 8.5),
        ("Ravi Bishnoi", PlayerRole.BOWL, 8.0),
        ("Avesh Khan", PlayerRole.BOWL, 7.5),
        ("Mohsin Khan", PlayerRole.BOWL, 7.0),
        ("Naveen-ul-Haq", PlayerRole.BOWL, 7.5),
        ("Yash Thakur", PlayerRole.BOWL, 7.0),
        ("Manan Vohra", PlayerRole.BAT, 6.0),
        ("Rishabh Pant", PlayerRole.WK, 9.5),
        ("David Miller", PlayerRole.BAT, 8.5),
        ("Mitchell Marsh", PlayerRole.AR, 9.0),
        ("Mayank Yadav", PlayerRole.BOWL, 8.0),
        ("Arshad Khan", PlayerRole.BOWL, 6.5),
    ],
    "GT": [
        ("Shubman Gill", PlayerRole.BAT, 9.5),
        ("Wriddhiman Saha", PlayerRole.WK, 7.0),
        ("Sai Sudharsan", PlayerRole.BAT, 8.0),
        ("David Miller", PlayerRole.BAT, 8.5),
        ("Vijay Shankar", PlayerRole.AR, 7.0),
        ("Rahul Tewatia", PlayerRole.AR, 7.5),
        ("Rashid Khan", PlayerRole.BOWL, 9.5),
        ("Mohammed Shami", PlayerRole.BOWL, 9.0),
        ("Alzarri Joseph", PlayerRole.BOWL, 7.5),
        ("Noor Ahmad", PlayerRole.BOWL, 7.0),
        ("Joshua Little", PlayerRole.BOWL, 7.0),
        ("Darshan Nalkande", PlayerRole.AR, 6.0),
        ("Sai Kishore", PlayerRole.BOWL, 7.0),
        ("Kane Williamson", PlayerRole.BAT, 8.0),
        ("Matthew Wade", PlayerRole.WK, 7.0),
        ("Jos Buttler", PlayerRole.WK, 9.5),
        ("Kagiso Rabada", PlayerRole.BOWL, 9.5),
        ("Prasidh Krishna", PlayerRole.BOWL, 7.5),
        ("Shahrukh Khan", PlayerRole.BAT, 7.0),
        ("Abhinav Manohar", PlayerRole.BAT, 6.5),
    ],
}

VENUES = [
    "Wankhede Stadium, Mumbai",
    "M. A. Chidambaram Stadium, Chennai",
    "M. Chinnaswamy Stadium, Bengaluru",
    "Eden Gardens, Kolkata",
    "Arun Jaitley Stadium, Delhi",
    "Sawai Mansingh Stadium, Jaipur",
    "Rajiv Gandhi Intl Stadium, Hyderabad",
    "IS Bindra Stadium, Mohali",
    "BRSABV Ekana Stadium, Lucknow",
    "Narendra Modi Stadium, Ahmedabad",
]


def generate_mock_performance(player: Player, match, is_playing: bool) -> dict:
    """Generate realistic-ish random performance stats."""
    if not is_playing:
        return {
            "player_id": player.id,
            "match_id": match.id,
            "is_playing": False,
        }

    role = player.role
    perf = {
        "player_id": player.id,
        "match_id": match.id,
        "is_playing": True,
        "runs": 0, "balls_faced": 0, "fours": 0, "sixes": 0,
        "wickets": 0, "overs_bowled": 0.0, "runs_conceded": 0, "maidens": 0,
        "catches": 0, "stumpings": 0, "run_outs": 0,
    }

    # Batting
    if role in (PlayerRole.BAT, PlayerRole.WK, PlayerRole.AR):
        runs = random.choices(
            [0, random.randint(1, 15), random.randint(16, 35),
             random.randint(36, 60), random.randint(61, 110)],
            weights=[10, 30, 30, 20, 10],
        )[0]
        perf["runs"] = runs
        perf["balls_faced"] = max(runs, random.randint(max(1, runs - 10), runs + 20)) if runs > 0 else random.randint(1, 5)
        perf["fours"] = min(runs // 4, random.randint(0, max(1, runs // 8)))
        perf["sixes"] = min((runs - perf["fours"] * 4) // 6, random.randint(0, max(1, runs // 15)))
    elif role == PlayerRole.BOWL:
        runs = random.choices([0, random.randint(1, 20)], weights=[40, 60])[0]
        perf["runs"] = runs
        perf["balls_faced"] = max(1, runs + random.randint(-3, 5)) if runs > 0 else random.randint(0, 3)
        perf["fours"] = random.randint(0, max(1, runs // 10))
        perf["sixes"] = random.randint(0, max(1, runs // 20))

    # Bowling
    if role in (PlayerRole.BOWL, PlayerRole.AR):
        overs = random.choices([0, 1, 2, 3, 4], weights=[5, 15, 25, 30, 25])[0]
        perf["overs_bowled"] = float(overs)
        perf["runs_conceded"] = random.randint(overs * 4, overs * 12) if overs > 0 else 0
        perf["wickets"] = random.choices([0, 1, 2, 3, 4], weights=[35, 35, 20, 8, 2])[0] if overs > 0 else 0
        perf["maidens"] = 1 if overs >= 2 and random.random() < 0.1 else 0

    # Fielding (anyone can catch/run out)
    perf["catches"] = random.choices([0, 1, 2], weights=[70, 25, 5])[0]
    if role == PlayerRole.WK:
        perf["stumpings"] = random.choices([0, 1], weights=[80, 20])[0]
    perf["run_outs"] = random.choices([0, 1], weights=[90, 10])[0]

    return perf


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        existing = db.query(IPLTeam).first()
        if existing:
            print("Database already seeded, skipping.")
            return

        # Create teams
        team_objects = {}
        for name, short in TEAMS:
            t = IPLTeam(name=name, short_name=short, logo_url=f"/logos/{short.lower()}.png")
            db.add(t)
            db.flush()
            team_objects[short] = t

        # Create players
        player_objects = {}
        for short, roster in PLAYERS.items():
            team = team_objects[short]
            for pname, role, credits in roster:
                p = Player(name=pname, team_id=team.id, role=role, credits=credits)
                db.add(p)
                db.flush()
                player_objects.setdefault(short, []).append(p)

        # Create matches (8 matches spread over next 2 weeks + 2 completed)
        now = datetime.utcnow()
        match_objects = []

        team_shorts = list(team_objects.keys())
        match_pairs = [
            (team_shorts[0], team_shorts[1]),  # MI vs CSK
            (team_shorts[2], team_shorts[3]),  # RCB vs KKR
            (team_shorts[4], team_shorts[5]),  # DC vs RR
            (team_shorts[6], team_shorts[7]),  # SRH vs PBKS
            (team_shorts[8], team_shorts[9]),  # LSG vs GT
            (team_shorts[0], team_shorts[3]),  # MI vs KKR
            (team_shorts[1], team_shorts[2]),  # CSK vs RCB
            (team_shorts[5], team_shorts[6]),  # RR vs SRH
            (team_shorts[7], team_shorts[8]),  # PBKS vs LSG
            (team_shorts[9], team_shorts[4]),  # GT vs DC
        ]

        for i, (t1_short, t2_short) in enumerate(match_pairs):
            if i < 2:
                # Completed matches (yesterday and day before)
                match_date = now - timedelta(days=2 - i, hours=random.randint(0, 4))
                status = MatchStatus.COMPLETED
            else:
                # Upcoming matches
                match_date = now + timedelta(days=i - 1, hours=random.randint(14, 20))
                status = MatchStatus.UPCOMING

            lock_time = match_date - timedelta(minutes=30)
            venue = VENUES[i % len(VENUES)]

            m = Match(
                team1_id=team_objects[t1_short].id,
                team2_id=team_objects[t2_short].id,
                date=match_date,
                venue=venue,
                status=status,
                lock_time=lock_time,
            )
            db.add(m)
            db.flush()
            match_objects.append((m, t1_short, t2_short))

        # Generate performances for completed matches
        for m, t1_short, t2_short in match_objects:
            if m.status != MatchStatus.COMPLETED:
                continue

            for short in (t1_short, t2_short):
                squad = player_objects[short]
                playing_xi = random.sample(squad, min(11, len(squad)))
                playing_ids = {p.id for p in playing_xi}

                for p in squad:
                    is_playing = p.id in playing_ids
                    perf_data = generate_mock_performance(p, m, is_playing)
                    perf = PlayerMatchPerformance(**perf_data)
                    db.add(perf)

        db.commit()
        print(f"Seeded {len(team_objects)} teams, "
              f"{sum(len(v) for v in player_objects.values())} players, "
              f"{len(match_objects)} matches")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
