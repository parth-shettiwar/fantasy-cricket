from sqlalchemy import (
    Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Table, Enum as SAEnum
)
from sqlalchemy.orm import relationship
import enum
from app.database import Base


class PlayerRole(str, enum.Enum):
    BAT = "BAT"
    BOWL = "BOWL"
    AR = "AR"
    WK = "WK"


class MatchStatus(str, enum.Enum):
    UPCOMING = "upcoming"
    LIVE = "live"
    COMPLETED = "completed"


user_team_players = Table(
    "user_team_players",
    Base.metadata,
    Column("user_team_id", Integer, ForeignKey("user_teams.id"), primary_key=True),
    Column("player_id", Integer, ForeignKey("players.id"), primary_key=True),
)


class IPLTeam(Base):
    __tablename__ = "ipl_teams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    short_name = Column(String(5), unique=True, nullable=False)
    logo_url = Column(String, default="")

    players = relationship("Player", back_populates="team")


class Player(Base):
    __tablename__ = "players"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    team_id = Column(Integer, ForeignKey("ipl_teams.id"), nullable=False)
    role = Column(SAEnum(PlayerRole), nullable=False)
    credits = Column(Float, nullable=False, default=7.0)

    team = relationship("IPLTeam", back_populates="players")
    performances = relationship("PlayerMatchPerformance", back_populates="player")


class Match(Base):
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True, index=True)
    team1_id = Column(Integer, ForeignKey("ipl_teams.id"), nullable=False)
    team2_id = Column(Integer, ForeignKey("ipl_teams.id"), nullable=False)
    date = Column(DateTime, nullable=False)
    venue = Column(String, nullable=False)
    status = Column(SAEnum(MatchStatus), default=MatchStatus.UPCOMING)
    lock_time = Column(DateTime, nullable=False)

    team1 = relationship("IPLTeam", foreign_keys=[team1_id])
    team2 = relationship("IPLTeam", foreign_keys=[team2_id])
    performances = relationship("PlayerMatchPerformance", back_populates="match")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)

    teams = relationship("UserTeam", back_populates="user")


class UserTeam(Base):
    __tablename__ = "user_teams"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False)
    captain_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    vice_captain_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    total_points = Column(Float, default=0.0)

    user = relationship("User", back_populates="teams")
    match = relationship("Match")
    captain = relationship("Player", foreign_keys=[captain_id])
    vice_captain = relationship("Player", foreign_keys=[vice_captain_id])
    players = relationship("Player", secondary=user_team_players)


class PlayerMatchPerformance(Base):
    __tablename__ = "player_match_performances"

    id = Column(Integer, primary_key=True, index=True)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False)
    runs = Column(Integer, default=0)
    balls_faced = Column(Integer, default=0)
    fours = Column(Integer, default=0)
    sixes = Column(Integer, default=0)
    wickets = Column(Integer, default=0)
    overs_bowled = Column(Float, default=0.0)
    runs_conceded = Column(Integer, default=0)
    maidens = Column(Integer, default=0)
    catches = Column(Integer, default=0)
    stumpings = Column(Integer, default=0)
    run_outs = Column(Integer, default=0)
    is_playing = Column(Boolean, default=False)

    player = relationship("Player", back_populates="performances")
    match = relationship("Match", back_populates="performances")
