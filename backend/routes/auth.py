from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import Request
from pydantic import BaseModel
from pydantic import EmailStr
from pydantic import Field
from sqlalchemy.orm import Session

from auth import authenticate_user
from auth import create_access_token
from auth import create_guest
from auth import create_user
from auth import is_guest
from auth import get_current_user
from auth import hash_password
from auth import verify_password
from config.settings import settings
from database.connection import get_db
from database.models import User
from rate_limit import client_ip
from rate_limit import limiter
from serializers import conversation_detail


router = APIRouter(prefix="/auth", tags=["Authentication"])


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str | None = Field(default=None, max_length=80)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(max_length=128)


class AuthResponse(BaseModel):
    access_token: str
    token_type: str
    user_id: str
    email: str
    name: str | None = None
    is_guest: bool = False


class MeResponse(BaseModel):
    user_id: str
    email: str
    name: str | None = None
    custom_instructions: str | None = None
    is_guest: bool = False


class UpdateProfileRequest(BaseModel):
    name: str | None = Field(default=None, max_length=80)
    custom_instructions: str | None = Field(default=None, max_length=4000)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class DeleteAccountRequest(BaseModel):
    password: str = Field(max_length=128)


def _auth_response(user: User) -> AuthResponse:
    return AuthResponse(
        access_token=create_access_token(user_id=user.id),
        token_type="bearer",
        user_id=user.id,
        email=user.email,
        name=user.name,
        is_guest=is_guest(user),
    )


def _me(user: User) -> MeResponse:
    return MeResponse(
        user_id=user.id,
        email=user.email,
        name=user.name,
        custom_instructions=user.custom_instructions,
        is_guest=is_guest(user),
    )


@router.post("/signup", response_model=AuthResponse)
def signup(body: SignupRequest, request: Request, db: Session = Depends(get_db)):
    limiter.check(f"auth:{client_ip(request)}", settings.AUTH_LIMIT_PER_MINUTE, 60)
    user = create_user(db=db, email=body.email, password=body.password, name=body.name)
    return _auth_response(user)


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    limiter.check(f"auth:{client_ip(request)}", settings.AUTH_LIMIT_PER_MINUTE, 60)
    user = authenticate_user(db=db, email=body.email, password=body.password)
    return _auth_response(user)


@router.post("/guest", response_model=AuthResponse)
def guest(request: Request, db: Session = Depends(get_db)):
    if not settings.GUEST_ENABLED:
        raise HTTPException(status_code=403, detail="The demo is currently disabled.")

    limiter.check(f"guest:{client_ip(request)}", settings.GUEST_SIGNUPS_PER_HOUR, 3600)
    return _auth_response(create_guest(db))


@router.get("/me", response_model=MeResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return _me(current_user)


@router.patch("/me", response_model=MeResponse)
def update_me(
    body: UpdateProfileRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    fields = body.model_dump(exclude_unset=True)

    if "name" in fields:
        current_user.name = (fields["name"] or "").strip() or None

    if "custom_instructions" in fields:
        current_user.custom_instructions = (
            (fields["custom_instructions"] or "").strip() or None
        )

    db.commit()
    db.refresh(current_user)
    return _me(current_user)


@router.post("/change-password")
def change_password(
    body: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Your current password is incorrect.")

    current_user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"message": "Password updated."}


@router.get("/export")
def export_data(current_user: User = Depends(get_current_user)):
    return {
        "user": {
            "email": current_user.email,
            "name": current_user.name,
            "custom_instructions": current_user.custom_instructions,
            "created_at": current_user.created_at.isoformat()
            if current_user.created_at
            else None,
        },
        "conversations": [conversation_detail(c) for c in current_user.conversations],
    }


@router.delete("/me")
def delete_account(
    body: DeleteAccountRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not is_guest(current_user) and not verify_password(body.password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Password is incorrect.")

    db.delete(current_user)
    db.commit()
    return {"message": "Account deleted."}
