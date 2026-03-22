from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional
from app.models import PlayerRole, MatchStatus


# --- Auth ---

class UserCreate(BaseModel):
    username: str
    email: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    username: str
    password: str


# --- IPL Team ---

class IPLTeamResponse(BaseModel):
    id: int
    name: str
    short_name: str
    logo_url: str

    class Config:
        from_attributes = True


# --- Player ---

class PlayerResponse(BaseModel):
    id: int
    name: str
    team_id: int
    role: PlayerRole
    credits: float

    class Config:
        from_attributes = True


class PlayerWithTeam(PlayerResponse):
    team: IPLTeamResponse


# --- Match ---

class MatchResponse(BaseModel):
    id: int
    team1_id: int
    team2_id: int
    date: datetime
    venue: str
    status: MatchStatus
    lock_time: datetime
    team1: IPLTeamResponse
    team2: IPLTeamResponse

    class Config:
        from_attributes = True


# --- User Team ---

class UserTeamCreate(BaseModel):
    match_id: int
    player_ids: list[int]
    captain_id: int
    vice_captain_id: int
    substitute_ids: list[int] = []


class SubstituteResponse(BaseModel):
    player_id: int
    priority: int
    player: PlayerResponse

    class Config:
        from_attributes = True


class UserTeamResponse(BaseModel):
    id: int
    user_id: int
    match_id: int
    captain_id: int
    vice_captain_id: int
    total_points: float
    players: list[PlayerResponse]
    substitutes: list[SubstituteResponse] = []

    class Config:
        from_attributes = True


# --- Performance / Points ---

class PerformanceResponse(BaseModel):
    id: int
    player_id: int
    match_id: int
    runs: int
    balls_faced: int
    fours: int
    sixes: int
    wickets: int
    overs_bowled: float
    runs_conceded: int
    maidens: int
    catches: int
    stumpings: int
    run_outs: int
    is_playing: bool

    class Config:
        from_attributes = True


class PlayerPoints(BaseModel):
    player_id: int
    player_name: str
    role: PlayerRole
    team_short_name: str
    batting_points: float
    bowling_points: float
    fielding_points: float
    bonus_points: float
    total_points: float
    is_captain: bool
    is_vice_captain: bool
    final_points: float


class TeamPointsBreakdown(BaseModel):
    user_team_id: int
    match_id: int
    total_points: float
    player_points: list[PlayerPoints]


class LeaderboardEntry(BaseModel):
    user_id: int
    username: str
    total_points: float
    teams_count: int


# --- Rooms ---

class RoomCreate(BaseModel):
    name: str


class RoomMemberResponse(BaseModel):
    user_id: int
    username: str
    joined_at: datetime

    class Config:
        from_attributes = True


class RoomResponse(BaseModel):
    id: int
    name: str
    invite_code: str
    created_by: int
    created_at: datetime
    member_count: int

    class Config:
        from_attributes = True


class RoomDetailResponse(RoomResponse):
    members: list[RoomMemberResponse]
    creator_username: str


# --- Admin ---

class SetCricbuzzId(BaseModel):
    cricbuzz_match_id: str


class SetMatchStatus(BaseModel):
    status: MatchStatus
