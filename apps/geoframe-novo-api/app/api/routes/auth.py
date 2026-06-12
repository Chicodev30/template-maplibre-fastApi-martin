# /api/auth/me.
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict

from app.dependencies import get_current_user
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    keycloak_sub: str | None
    username: str
    email: str | None
    full_name: str | None
    effective_role: str
    is_active: bool
    created_at: datetime
    last_login_at: datetime | None


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    # Autentica, resolve papel efetivo e registra/atualiza o usuario (1o login).
    return user
