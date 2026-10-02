from pydantic import BaseModel, EmailStr, Field
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth import (
    authenticate_user,
    create_access_token,
    create_user,
    get_current_user,
)
from database.connection import get_db
from database.models import User


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(
        min_length=6,
        max_length=128,
    )


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str
    user_id: str
    email: str


class MeResponse(BaseModel):
    user_id: str
    email: str


@router.post(
    "/signup",
    response_model=AuthResponse,
)
def signup(
    request: SignupRequest,
    db: Session = Depends(get_db),
):
    user = create_user(
        db=db,
        email=request.email,
        password=request.password,
    )

    token = create_access_token(
        user_id=user.id,
    )

    return AuthResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        email=user.email,
    )


@router.post(
    "/login",
    response_model=AuthResponse,
)
def login(
    request: LoginRequest,
    db: Session = Depends(get_db),
):
    user = authenticate_user(
        db=db,
        email=request.email,
        password=request.password,
    )

    token = create_access_token(
        user_id=user.id,
    )

    return AuthResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        email=user.email,
    )


@router.get(
    "/me",
    response_model=MeResponse,
)
def get_me(
    current_user: User = Depends(
        get_current_user
    ),
):
    return MeResponse(
        user_id=current_user.id,
        email=current_user.email,
    )