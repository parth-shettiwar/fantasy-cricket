import hashlib
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi.security import OAuth2PasswordBearer

import os

from app.database import get_db
from app.models import User, PasswordResetToken
from app.schemas import (
    UserCreate,
    UserResponse,
    Token,
    LoginRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    MessageResponse,
    ForgotPasswordResponse,
)
from app.services.mail import send_password_reset_email

router = APIRouter()

SECRET_KEY = os.environ.get("SECRET_KEY", "fantasy-cricket-secret-key-change-in-prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours
PASSWORD_RESET_TOKEN_EXPIRE_HOURS = 1

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def _hash_reset_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == int(user_id_str)).first()
    if user is None:
        raise credentials_exception
    return user


@router.post("/register", response_model=UserResponse)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    email_norm = (user_in.email or "").strip().lower()
    if db.query(User).filter(User.username == user_in.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    if db.query(User).filter(func.lower(User.email) == email_norm).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        username=user_in.username,
        email=email_norm,
        password_hash=pwd_context.hash(user_in.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(login_req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == login_req.username).first()
    if not user or not pwd_context.verify(login_req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user


_FORGOT_PASSWORD_MSG = (
    "If an account exists for that email, we have sent a link to reset your password."
)
_MSG_NO_SMTP = (
    "Email is not configured on this server. Use the link below to set a new password."
)


def _smtp_configured() -> bool:
    return bool(os.environ.get("SMTP_HOST", "").strip())


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    email = (body.email or "").strip().lower()
    if not email or "@" not in email:
        return ForgotPasswordResponse(message=_FORGOT_PASSWORD_MSG)

    user = db.query(User).filter(func.lower(User.email) == email).first()
    if not user:
        return ForgotPasswordResponse(message=_FORGOT_PASSWORD_MSG)

    db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user.id).delete()
    raw_token = secrets.token_urlsafe(32)
    token_hash = _hash_reset_token(raw_token)
    expires = datetime.utcnow() + timedelta(hours=PASSWORD_RESET_TOKEN_EXPIRE_HOURS)
    db.add(PasswordResetToken(user_id=user.id, token_hash=token_hash, expires_at=expires))
    db.commit()

    frontend = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173").rstrip("/")
    reset_link = f"{frontend}/reset-password?token={raw_token}"

    if not _smtp_configured():
        return ForgotPasswordResponse(message=_MSG_NO_SMTP, reset_link=reset_link)

    try:
        send_password_reset_email(user.email, reset_link)
    except Exception:
        db.query(PasswordResetToken).filter(PasswordResetToken.token_hash == token_hash).delete()
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not send email. Try again later or contact support.",
        )

    return ForgotPasswordResponse(message=_FORGOT_PASSWORD_MSG)


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    token_hash = _hash_reset_token(body.token.strip())
    now = datetime.utcnow()
    prt = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.token_hash == token_hash)
        .first()
    )
    if not prt or prt.expires_at < now:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")

    user = db.query(User).filter(User.id == prt.user_id).first()
    if not user:
        db.delete(prt)
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")

    user.password_hash = pwd_context.hash(body.new_password)
    db.delete(prt)
    db.commit()
    return MessageResponse(message="Your password has been reset. You can sign in now.")
