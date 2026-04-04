from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Table, Text,
    Enum as SAEnum, UniqueConstraint,
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
    cricbuzz_match_id = Column(String, nullable=True)
    locked_playing_ids = Column(Text, nullable=True)

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
    password_reset_tokens = relationship(
        "PasswordResetToken",
        back_populates="user",
        cascade="all, delete-orphan",
    )


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)

    user = relationship("User", back_populates="password_reset_tokens")


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
    substitutes = relationship(
        "UserTeamSubstitute",
        back_populates="user_team",
        cascade="all, delete-orphan",
        order_by="UserTeamSubstitute.priority",
    )


class UserTeamSubstitute(Base):
    __tablename__ = "user_team_substitutes"
    __table_args__ = (
        UniqueConstraint("user_team_id", "player_id", name="uq_sub_team_player"),
        UniqueConstraint("user_team_id", "priority", name="uq_sub_team_priority"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_team_id = Column(Integer, ForeignKey("user_teams.id", ondelete="CASCADE"), nullable=False)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    priority = Column(Integer, nullable=False)

    user_team = relationship("UserTeam", back_populates="substitutes")
    player = relationship("Player")


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


class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    invite_code = Column(String(8), unique=True, nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    creator = relationship("User")
    members = relationship("RoomMember", back_populates="room", cascade="all, delete-orphan")


class RoomMember(Base):
    __tablename__ = "room_members"
    __table_args__ = (
        UniqueConstraint("room_id", "user_id", name="uq_room_user"),
    )

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow)

    room = relationship("Room", back_populates="members")
    user = relationship("User")


class MatchCondition(Base):
    __tablename__ = "match_conditions"

    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("matches.id"), unique=True, nullable=False, index=True)
    pitch_type = Column(String, default="balanced")  # batting, spin, pace, balanced
    dew_factor = Column(Float, default=0.0)  # 0..1
    notes = Column(String, default="")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    match = relationship("Match")


class PlayerFeatureSnapshot(Base):
    __tablename__ = "player_feature_snapshots"
    __table_args__ = (
        UniqueConstraint("player_id", "season", name="uq_player_feature_season"),
    )

    id = Column(Integer, primary_key=True, index=True)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False, index=True)
    season = Column(Integer, nullable=False, index=True)
    matches = Column(Integer, default=0)
    fantasy_avg = Column(Float, default=0.0)
    batting_avg = Column(Float, default=0.0)
    bowling_avg = Column(Float, default=0.0)
    fielding_avg = Column(Float, default=0.0)
    vs_spin_index = Column(Float, default=1.0)
    vs_pace_index = Column(Float, default=1.0)
    venue_index = Column(Float, default=1.0)
    consistency_index = Column(Float, default=1.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    player = relationship("Player")


class AIRecommendationFeedback(Base):
    __tablename__ = "ai_recommendation_feedback"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False, index=True)
    recommendation_type = Column(String, nullable=False)  # swap, vc_change
    accepted = Column(Boolean, nullable=False)
    payload_json = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
    match = relationship("Match")
