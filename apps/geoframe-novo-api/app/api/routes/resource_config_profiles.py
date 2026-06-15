# Rotas de perfis de configuracao (presets de campos/seguranca/zoom por recurso).
# Cada perfil e um subconjunto alternativo da config de um recurso, reutilizavel
# em qualquer no de camada de um group-layer que use esse recurso. Sem perfil,
# o no usa o comportamento default (todos os campos em tabela/popup, sem
# restricao, sem limite de zoom).
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.routes.resources import ResourceFieldConfig, ResourceSecurityRule
from app.db.session import get_session
from app.dependencies import require_role
from app.models.resource import ResourceConfigProfile
from app.models.role import AppRole
from app.models.user import User

router = APIRouter(prefix="/catalog/config-profiles", tags=["resource-config-profiles"])


class ResourceConfigProfileIn(BaseModel):
    resourceId: str
    name: str
    fields: dict[str, ResourceFieldConfig] = Field(default_factory=dict)
    securityRules: list[ResourceSecurityRule] = Field(default_factory=list)
    minZoom: int | None = None
    maxZoom: int | None = None


class ResourceConfigProfileSummary(BaseModel):
    id: int
    resourceId: str
    name: str
    updatedAt: datetime


class ResourceConfigProfileDetail(ResourceConfigProfileSummary):
    fields: dict[str, ResourceFieldConfig]
    securityRules: list[ResourceSecurityRule]
    minZoom: int | None = None
    maxZoom: int | None = None


def _summary(profile: ResourceConfigProfile) -> ResourceConfigProfileSummary:
    return ResourceConfigProfileSummary(
        id=profile.id,
        resourceId=profile.resource_id,
        name=profile.name,
        updatedAt=profile.updated_at,
    )


def _detail(profile: ResourceConfigProfile) -> ResourceConfigProfileDetail:
    return ResourceConfigProfileDetail(
        id=profile.id,
        resourceId=profile.resource_id,
        name=profile.name,
        updatedAt=profile.updated_at,
        fields=profile.fields,
        securityRules=profile.security_rules,
        minZoom=profile.min_zoom,
        maxZoom=profile.max_zoom,
    )


def _get_or_404(profile_id: int, db: Session) -> ResourceConfigProfile:
    profile = db.get(ResourceConfigProfile, profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Perfil de configuracao nao encontrado")
    return profile


@router.get("", response_model=list[ResourceConfigProfileSummary])
def list_profiles(
    resource_id: str | None = Query(default=None),
    db: Session = Depends(get_session),
) -> list[ResourceConfigProfileSummary]:
    stmt = select(ResourceConfigProfile).order_by(ResourceConfigProfile.name)
    if resource_id:
        stmt = stmt.where(ResourceConfigProfile.resource_id == resource_id)
    profiles = db.execute(stmt).scalars().all()
    return [_summary(profile) for profile in profiles]


@router.post("", response_model=ResourceConfigProfileDetail, status_code=201)
def create_profile(
    payload: ResourceConfigProfileIn,
    _admin: User = Depends(require_role(AppRole.admin)),
    db: Session = Depends(get_session),
) -> ResourceConfigProfileDetail:
    profile = ResourceConfigProfile(
        resource_id=payload.resourceId,
        name=payload.name,
        fields={name: field.model_dump() for name, field in payload.fields.items()},
        security_rules=[rule.model_dump() for rule in payload.securityRules],
        min_zoom=payload.minZoom,
        max_zoom=payload.maxZoom,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return _detail(profile)


@router.get("/{profile_id}", response_model=ResourceConfigProfileDetail)
def get_profile(profile_id: int, db: Session = Depends(get_session)) -> ResourceConfigProfileDetail:
    return _detail(_get_or_404(profile_id, db))


@router.put("/{profile_id}", response_model=ResourceConfigProfileDetail)
def update_profile(
    profile_id: int,
    payload: ResourceConfigProfileIn,
    _admin: User = Depends(require_role(AppRole.admin)),
    db: Session = Depends(get_session),
) -> ResourceConfigProfileDetail:
    profile = _get_or_404(profile_id, db)
    profile.resource_id = payload.resourceId
    profile.name = payload.name
    profile.fields = {name: field.model_dump() for name, field in payload.fields.items()}
    profile.security_rules = [rule.model_dump() for rule in payload.securityRules]
    profile.min_zoom = payload.minZoom
    profile.max_zoom = payload.maxZoom
    db.commit()
    db.refresh(profile)
    return _detail(profile)


@router.delete("/{profile_id}", status_code=204)
def delete_profile(
    profile_id: int,
    _admin: User = Depends(require_role(AppRole.admin)),
    db: Session = Depends(get_session),
) -> None:
    profile = _get_or_404(profile_id, db)
    db.delete(profile)
    db.commit()
