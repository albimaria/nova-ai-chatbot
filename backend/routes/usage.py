from fastapi import APIRouter
from fastapi import Depends
from fastapi import Query
from sqlalchemy.orm import Session

from auth import get_current_user
from database.connection import get_db
from database.models import User
from services import usage_service


router = APIRouter(prefix="/api/v1/usage", tags=["Usage"])


@router.get("")
def get_usage(
    days: int = Query(default=30, ge=1, le=90),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return usage_service.summary(db, user, days=days)
