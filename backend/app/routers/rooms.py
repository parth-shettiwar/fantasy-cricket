"""Room endpoints for private leagues among friends."""

import secrets
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import Room, RoomMember, User, UserTeam
from app.schemas import (
    RoomCreate, RoomResponse, RoomDetailResponse, RoomMemberResponse,
    LeaderboardEntry,
)
from app.routers.auth import get_current_user

router = APIRouter()


def _generate_invite_code() -> str:
    return secrets.token_urlsafe(6)[:6].upper()


@router.post("/", response_model=RoomResponse)
def create_room(
    body: RoomCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    code = _generate_invite_code()
    while db.query(Room).filter(Room.invite_code == code).first():
        code = _generate_invite_code()

    room = Room(
        name=body.name,
        invite_code=code,
        created_by=current_user.id,
    )
    db.add(room)
    db.flush()

    membership = RoomMember(room_id=room.id, user_id=current_user.id)
    db.add(membership)
    db.commit()
    db.refresh(room)

    return RoomResponse(
        id=room.id,
        name=room.name,
        invite_code=room.invite_code,
        created_by=room.created_by,
        created_at=room.created_at,
        member_count=1,
    )


@router.get("/", response_model=list[RoomResponse])
def list_my_rooms(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    memberships = (
        db.query(RoomMember)
        .filter(RoomMember.user_id == current_user.id)
        .all()
    )
    room_ids = [m.room_id for m in memberships]
    if not room_ids:
        return []

    rooms = db.query(Room).filter(Room.id.in_(room_ids)).all()
    result = []
    for room in rooms:
        count = db.query(RoomMember).filter(RoomMember.room_id == room.id).count()
        result.append(RoomResponse(
            id=room.id,
            name=room.name,
            invite_code=room.invite_code,
            created_by=room.created_by,
            created_at=room.created_at,
            member_count=count,
        ))
    return result


@router.get("/join/{invite_code}", response_model=RoomDetailResponse)
def get_room_by_code(invite_code: str, db: Session = Depends(get_db)):
    room = db.query(Room).filter(Room.invite_code == invite_code).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    members = (
        db.query(RoomMember)
        .filter(RoomMember.room_id == room.id)
        .all()
    )
    member_count = len(members)

    creator = db.query(User).filter(User.id == room.created_by).first()

    member_responses = []
    for m in members:
        user = db.query(User).filter(User.id == m.user_id).first()
        if user:
            member_responses.append(RoomMemberResponse(
                user_id=user.id,
                username=user.username,
                joined_at=m.joined_at,
            ))

    return RoomDetailResponse(
        id=room.id,
        name=room.name,
        invite_code=room.invite_code,
        created_by=room.created_by,
        created_at=room.created_at,
        member_count=member_count,
        members=member_responses,
        creator_username=creator.username if creator else "Unknown",
    )


@router.post("/join/{invite_code}")
def join_room(
    invite_code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    room = db.query(Room).filter(Room.invite_code == invite_code).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    existing = (
        db.query(RoomMember)
        .filter(RoomMember.room_id == room.id, RoomMember.user_id == current_user.id)
        .first()
    )
    if existing:
        return {"message": "Already a member", "room_id": room.id}

    membership = RoomMember(room_id=room.id, user_id=current_user.id)
    db.add(membership)
    db.commit()
    return {"message": "Joined successfully", "room_id": room.id}


@router.delete("/{room_id}/leave")
def leave_room(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    membership = (
        db.query(RoomMember)
        .filter(RoomMember.room_id == room_id, RoomMember.user_id == current_user.id)
        .first()
    )
    if not membership:
        raise HTTPException(status_code=404, detail="Not a member of this room")

    db.delete(membership)
    db.commit()
    return {"message": "Left room"}


@router.get("/{room_id}", response_model=RoomDetailResponse)
def get_room(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    membership = (
        db.query(RoomMember)
        .filter(RoomMember.room_id == room_id, RoomMember.user_id == current_user.id)
        .first()
    )
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this room")

    members = db.query(RoomMember).filter(RoomMember.room_id == room.id).all()
    creator = db.query(User).filter(User.id == room.created_by).first()

    member_responses = []
    for m in members:
        user = db.query(User).filter(User.id == m.user_id).first()
        if user:
            member_responses.append(RoomMemberResponse(
                user_id=user.id,
                username=user.username,
                joined_at=m.joined_at,
            ))

    return RoomDetailResponse(
        id=room.id,
        name=room.name,
        invite_code=room.invite_code,
        created_by=room.created_by,
        created_at=room.created_at,
        member_count=len(members),
        members=member_responses,
        creator_username=creator.username if creator else "Unknown",
    )


@router.get("/{room_id}/leaderboard", response_model=list[LeaderboardEntry])
def room_leaderboard(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    membership = (
        db.query(RoomMember)
        .filter(RoomMember.room_id == room_id, RoomMember.user_id == current_user.id)
        .first()
    )
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this room")

    member_ids = [
        m.user_id
        for m in db.query(RoomMember).filter(RoomMember.room_id == room_id).all()
    ]

    results = (
        db.query(
            User.id,
            User.username,
            func.coalesce(func.sum(UserTeam.total_points), 0).label("total_points"),
            func.count(UserTeam.id).label("teams_count"),
        )
        .outerjoin(UserTeam, User.id == UserTeam.user_id)
        .filter(User.id.in_(member_ids))
        .group_by(User.id)
        .order_by(func.coalesce(func.sum(UserTeam.total_points), 0).desc())
        .all()
    )

    return [
        LeaderboardEntry(
            user_id=r.id,
            username=r.username,
            total_points=float(r.total_points),
            teams_count=r.teams_count,
        )
        for r in results
    ]
