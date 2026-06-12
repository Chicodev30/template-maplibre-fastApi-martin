# Rotas admin usuários.
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.routes.auth import UserOut
from app.db.session import get_session
from app.dependencies import require_role
from app.models.role import AppRole
from app.models.user import User

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(
    _admin: User = Depends(require_role(AppRole.admin)),
    db: Session = Depends(get_session),
) -> list[User]:
    return list(db.execute(select(User).order_by(User.created_at)).scalars().all())


@router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: int,
    _admin: User = Depends(require_role(AppRole.admin)),
    db: Session = Depends(get_session),
) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado")
    return user
