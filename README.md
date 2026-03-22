# Fantasy Cricket - IPL 2026

A Dream11-style fantasy cricket app for IPL. Pick your best XI, choose a Captain (2x points) and Vice Captain (1.5x points), and compete on the leaderboard.

## Quick Start

### Backend (Python FastAPI)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Seed the database with IPL teams, players, and sample matches
python -m app.seed

# Start the API server
uvicorn app.main:app --reload --port 8000
```

API docs available at http://localhost:8000/docs

### Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

### Run Tests

```bash
cd backend
source venv/bin/activate
python test_e2e.py
```

## Features

- 10 IPL 2026 teams with ~200 players
- Match schedule with live countdown timers
- Team selection with role constraints (WK/BAT/AR/BOWL), 100-credit budget, max 7 per team
- Captain (2x) and Vice Captain (1.5x) selection
- Dream11 points system (batting, bowling, fielding, bonuses)
- Points breakdown per player per match
- Global leaderboard

## Points System

| Category | Event | Points |
|----------|-------|--------|
| Batting | Per run | +1 |
| Batting | Boundary bonus | +1 |
| Batting | Six bonus | +2 |
| Batting | Half-century | +8 |
| Batting | Century | +16 |
| Batting | Duck (BAT/WK/AR) | -2 |
| Bowling | Per wicket | +25 |
| Bowling | 4-wicket bonus | +8 |
| Bowling | 5-wicket bonus | +16 |
| Bowling | Maiden over | +8 |
| Fielding | Catch | +8 |
| Fielding | Stumping/Run out | +12 |
| Other | Playing XI | +4 |
| Other | Captain | 2x |
| Other | Vice Captain | 1.5x |

## Tech Stack

- **Backend**: Python, FastAPI, SQLAlchemy, SQLite, JWT auth
- **Frontend**: React 18, Vite, Tailwind CSS, React Router, Axios
