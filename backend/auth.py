from datetime import datetime
from datetime import timedelta
from datetime import timezone
from uuid import uuid4

import jwt
from fastapi import Depends
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.security import HTTPBearer
from pwdlib import PasswordHash
from sqlalchemy.orm import Session

from config.settings import settings
from database.connection import get_db
from database.models import User


password_hash = PasswordHash.recommended()

security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    try:
        return password_hash.verify(password, hashed_password)
    except Exception:
        return False


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )

    payload = {"sub": user_id, "exp": expire}

    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Please log in to continue.")

    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Your session has expired. Please log in again.",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid authentication token.")

    user_id = payload.get("sub")

    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid authentication token.")

    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=401, detail="User account not found.")

    return user


def normalize_email(email: str) -> str:
    return email.strip().lower()


def create_user(db: Session, email: str, password: str, name: str | None = None) -> User:
    normalized_email = normalize_email(email)

    if db.query(User).filter(User.email == normalized_email).first():
        raise HTTPException(
            status_code=400,
            detail="An account with this email already exists.",
        )

    user = User(
        id=str(uuid4()),
        email=normalized_email,
        name=(name or "").strip() or None,
        password_hash=hash_password(password),
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


def authenticate_user(db: Session, email: str, password: str) -> User:
    user = db.query(User).filter(User.email == normalize_email(email)).first()

    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")

    return user
