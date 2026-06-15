# Explorador de arquivos: middleware entre o front e os buckets MinIO.
# Buckets nunca sao excluidos por aqui (sem endpoint de delete bucket).
import io
from datetime import datetime, timedelta
from pathlib import PurePosixPath
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from minio.error import S3Error
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.dependencies import require_role
from app.models.role import AppRole
from app.models.storage import BucketAccessGrant, BucketConfig
from app.models.user import User
from app.services.minio_service import (
    DEFAULT_ALLOWED_EXTENSIONS,
    DEFAULT_MAX_FILE_SIZE_MB,
    get_minio_client,
)

router = APIRouter(prefix="/storage", tags=["storage"])

BUCKET_NAME_PATTERN = r"^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$"


class BucketConfigOut(BaseModel):
    allowedExtensions: list[str]
    maxFileSizeMb: int


class BucketConfigIn(BaseModel):
    allowedExtensions: list[str] = Field(default_factory=list)
    maxFileSizeMb: int = Field(gt=0, le=2048)


class BucketAccessGrantOut(BaseModel):
    id: int
    principalType: Literal["role", "user"]
    principalValue: str
    canUpload: bool
    canDelete: bool


class BucketAccessGrantIn(BaseModel):
    principalType: Literal["role", "user"]
    principalValue: str
    canUpload: bool = False
    canDelete: bool = False


class BucketCreateIn(BaseModel):
    bucketName: str = Field(min_length=3, max_length=63, pattern=BUCKET_NAME_PATTERN)


class BucketAdminSummary(BaseModel):
    bucketName: str
    config: BucketConfigOut
    grants: list[BucketAccessGrantOut]


class BucketSummary(BaseModel):
    bucketName: str
    canUpload: bool
    canDelete: bool
    allowedExtensions: list[str]
    maxFileSizeMb: int


class StorageObject(BaseModel):
    name: str
    size: int
    lastModified: datetime | None = None


class StorageObjectsPage(BaseModel):
    objects: list[StorageObject]
    nextCursor: str | None = None


class DownloadUrl(BaseModel):
    url: str


def _config_out(config: BucketConfig) -> BucketConfigOut:
    return BucketConfigOut(allowedExtensions=config.allowed_extensions, maxFileSizeMb=config.max_file_size_mb)


def _grant_out(grant: BucketAccessGrant) -> BucketAccessGrantOut:
    return BucketAccessGrantOut(
        id=grant.id,
        principalType=grant.principal_type,  # type: ignore[arg-type]
        principalValue=grant.principal_value,
        canUpload=grant.can_upload,
        canDelete=grant.can_delete,
    )


def _get_or_create_config(bucket_name: str, db: Session) -> BucketConfig:
    config = db.execute(select(BucketConfig).where(BucketConfig.bucket_name == bucket_name)).scalar_one_or_none()
    if config is None:
        config = BucketConfig(
            bucket_name=bucket_name,
            allowed_extensions=list(DEFAULT_ALLOWED_EXTENSIONS),
            max_file_size_mb=DEFAULT_MAX_FILE_SIZE_MB,
        )
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


def _get_grants(bucket_name: str, db: Session) -> list[BucketAccessGrant]:
    return list(
        db.execute(select(BucketAccessGrant).where(BucketAccessGrant.bucket_name == bucket_name)).scalars().all()
    )


def _resolve_access(bucket_name: str, user: User, db: Session) -> tuple[bool, bool, bool]:
    """Retorna (pode_ver, pode_enviar, pode_excluir) para o usuario no bucket."""
    if user.effective_role == AppRole.admin.value:
        return True, True, True

    can_view = False
    can_upload = False
    can_delete = False
    for grant in _get_grants(bucket_name, db):
        matches = (grant.principal_type == "role" and grant.principal_value == user.effective_role) or (
            grant.principal_type == "user" and grant.principal_value == user.username
        )
        if matches:
            can_view = True
            can_upload = can_upload or grant.can_upload
            can_delete = can_delete or grant.can_delete
    return can_view, can_upload, can_delete


def _require_bucket_exists(bucket_name: str) -> None:
    try:
        exists = get_minio_client().bucket_exists(bucket_name)
    except S3Error as exc:
        raise HTTPException(status_code=502, detail="Erro ao acessar o MinIO.") from exc
    if not exists:
        raise HTTPException(status_code=404, detail="Bucket nao encontrado.")


# --- Administracao (gfr-admin): criar buckets, configurar restricoes e liberacoes ---


@router.get("/admin/buckets", response_model=list[BucketAdminSummary])
def admin_list_buckets(
    _admin: User = Depends(require_role(AppRole.admin)),
    db: Session = Depends(get_session),
) -> list[BucketAdminSummary]:
    try:
        buckets = get_minio_client().list_buckets()
    except S3Error as exc:
        raise HTTPException(status_code=502, detail="Erro ao acessar o MinIO.") from exc

    result: list[BucketAdminSummary] = []
    for bucket in buckets:
        config = _get_or_create_config(bucket.name, db)
        grants = _get_grants(bucket.name, db)
        result.append(
            BucketAdminSummary(
                bucketName=bucket.name,
                config=_config_out(config),
                grants=[_grant_out(g) for g in grants],
            )
        )
    return result


@router.post("/admin/buckets", response_model=BucketAdminSummary, status_code=201)
def admin_create_bucket(
    payload: BucketCreateIn,
    _admin: User = Depends(require_role(AppRole.admin)),
    db: Session = Depends(get_session),
) -> BucketAdminSummary:
    client = get_minio_client()
    try:
        if client.bucket_exists(payload.bucketName):
            raise HTTPException(status_code=409, detail="Bucket ja existe.")
        client.make_bucket(payload.bucketName)
    except S3Error as exc:
        raise HTTPException(status_code=502, detail="Erro ao criar bucket no MinIO.") from exc

    config = _get_or_create_config(payload.bucketName, db)
    return BucketAdminSummary(bucketName=payload.bucketName, config=_config_out(config), grants=[])


@router.put("/admin/buckets/{bucket_name}/config", response_model=BucketConfigOut)
def admin_update_bucket_config(
    bucket_name: str,
    payload: BucketConfigIn,
    _admin: User = Depends(require_role(AppRole.admin)),
    db: Session = Depends(get_session),
) -> BucketConfigOut:
    _require_bucket_exists(bucket_name)
    config = _get_or_create_config(bucket_name, db)
    config.allowed_extensions = [ext.lower() if ext.startswith(".") else f".{ext.lower()}" for ext in payload.allowedExtensions]
    config.max_file_size_mb = payload.maxFileSizeMb
    db.commit()
    db.refresh(config)
    return _config_out(config)


@router.put("/admin/buckets/{bucket_name}/grants", response_model=list[BucketAccessGrantOut])
def admin_update_bucket_grants(
    bucket_name: str,
    payload: list[BucketAccessGrantIn],
    _admin: User = Depends(require_role(AppRole.admin)),
    db: Session = Depends(get_session),
) -> list[BucketAccessGrantOut]:
    _require_bucket_exists(bucket_name)
    db.execute(delete(BucketAccessGrant).where(BucketAccessGrant.bucket_name == bucket_name))
    grants = [
        BucketAccessGrant(
            bucket_name=bucket_name,
            principal_type=item.principalType,
            principal_value=item.principalValue,
            can_upload=item.canUpload,
            can_delete=item.canDelete,
        )
        for item in payload
    ]
    db.add_all(grants)
    db.commit()
    for grant in grants:
        db.refresh(grant)
    return [_grant_out(g) for g in grants]


# --- Explorador de arquivos (qualquer usuario autenticado, conforme liberacao) ---


@router.get("/buckets", response_model=list[BucketSummary])
def list_accessible_buckets(
    user: User = Depends(require_role(AppRole.visualizador)),
    db: Session = Depends(get_session),
) -> list[BucketSummary]:
    try:
        buckets = get_minio_client().list_buckets()
    except S3Error as exc:
        raise HTTPException(status_code=502, detail="Erro ao acessar o MinIO.") from exc

    result: list[BucketSummary] = []
    for bucket in buckets:
        can_view, can_upload, can_delete = _resolve_access(bucket.name, user, db)
        if not can_view:
            continue
        config = _get_or_create_config(bucket.name, db)
        result.append(
            BucketSummary(
                bucketName=bucket.name,
                canUpload=can_upload,
                canDelete=can_delete,
                allowedExtensions=config.allowed_extensions,
                maxFileSizeMb=config.max_file_size_mb,
            )
        )
    return result


@router.get("/buckets/{bucket_name}/objects", response_model=StorageObjectsPage)
def list_objects(
    bucket_name: str,
    cursor: str | None = None,
    limit: int = Query(default=200, gt=0, le=1000),
    user: User = Depends(require_role(AppRole.visualizador)),
    db: Session = Depends(get_session),
) -> StorageObjectsPage:
    can_view, _, _ = _resolve_access(bucket_name, user, db)
    if not can_view:
        raise HTTPException(status_code=403, detail="Sem acesso a este bucket.")

    try:
        items: list[StorageObject] = []
        next_cursor: str | None = None
        for obj in get_minio_client().list_objects(bucket_name, recursive=True, start_after=cursor):
            if obj.is_dir:
                continue
            if len(items) >= limit:
                next_cursor = items[-1].name
                break
            items.append(StorageObject(name=obj.object_name, size=obj.size or 0, lastModified=obj.last_modified))
        return StorageObjectsPage(objects=items, nextCursor=next_cursor)
    except S3Error as exc:
        raise HTTPException(status_code=502, detail="Erro ao listar objetos do bucket.") from exc


@router.get("/buckets/{bucket_name}/search", response_model=StorageObjectsPage)
def search_objects(
    bucket_name: str,
    q: str = Query(min_length=1),
    limit: int = Query(default=50, gt=0, le=200),
    max_scan: int = Query(default=1000, gt=0, le=10000),
    user: User = Depends(require_role(AppRole.visualizador)),
    db: Session = Depends(get_session),
) -> StorageObjectsPage:
    """Busca por arquivos cujo nome contem `q` (case-insensitive).

    Para nao travar em buckets muito grandes, varre no maximo `max_scan`
    objetos do bucket. `nextCursor` sempre None: nao ha paginacao na busca.
    """
    can_view, _, _ = _resolve_access(bucket_name, user, db)
    if not can_view:
        raise HTTPException(status_code=403, detail="Sem acesso a este bucket.")

    needle = q.lower()
    try:
        items: list[StorageObject] = []
        scanned = 0
        for obj in get_minio_client().list_objects(bucket_name, recursive=True):
            if obj.is_dir:
                continue
            scanned += 1
            if needle in obj.object_name.lower():
                items.append(StorageObject(name=obj.object_name, size=obj.size or 0, lastModified=obj.last_modified))
                if len(items) >= limit:
                    break
            if scanned >= max_scan:
                break
        return StorageObjectsPage(objects=items, nextCursor=None)
    except S3Error as exc:
        raise HTTPException(status_code=502, detail="Erro ao buscar objetos do bucket.") from exc


@router.post("/buckets/{bucket_name}/objects", response_model=StorageObject, status_code=201)
async def upload_object(
    bucket_name: str,
    file: UploadFile = File(...),
    user: User = Depends(require_role(AppRole.visualizador)),
    db: Session = Depends(get_session),
) -> StorageObject:
    can_view, can_upload, _ = _resolve_access(bucket_name, user, db)
    if not can_view or not can_upload:
        raise HTTPException(status_code=403, detail="Sem permissao para enviar arquivos a este bucket.")

    config = _get_or_create_config(bucket_name, db)
    filename = PurePosixPath(file.filename or "").name
    if not filename:
        raise HTTPException(status_code=422, detail="Nome do arquivo invalido.")

    extension = PurePosixPath(filename).suffix.lower()
    if config.allowed_extensions and extension not in config.allowed_extensions:
        raise HTTPException(status_code=422, detail=f"Extensao '{extension}' nao permitida neste bucket.")

    content = await file.read()
    max_bytes = config.max_file_size_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(status_code=422, detail=f"Arquivo excede o limite de {config.max_file_size_mb} MB.")

    try:
        get_minio_client().put_object(
            bucket_name,
            filename,
            data=io.BytesIO(content),
            length=len(content),
            content_type=file.content_type or "application/octet-stream",
        )
    except S3Error as exc:
        raise HTTPException(status_code=502, detail="Erro ao enviar arquivo ao MinIO.") from exc

    return StorageObject(name=filename, size=len(content), lastModified=datetime.now())


@router.delete("/buckets/{bucket_name}/objects/{object_name:path}", status_code=204)
def delete_object(
    bucket_name: str,
    object_name: str,
    user: User = Depends(require_role(AppRole.visualizador)),
    db: Session = Depends(get_session),
) -> None:
    can_view, _, can_delete = _resolve_access(bucket_name, user, db)
    if not can_view or not can_delete:
        raise HTTPException(status_code=403, detail="Sem permissao para excluir arquivos deste bucket.")

    try:
        get_minio_client().remove_object(bucket_name, object_name)
    except S3Error as exc:
        raise HTTPException(status_code=502, detail="Erro ao excluir arquivo no MinIO.") from exc


@router.get("/buckets/{bucket_name}/objects/{object_name:path}/download", response_model=DownloadUrl)
def get_download_url(
    bucket_name: str,
    object_name: str,
    user: User = Depends(require_role(AppRole.visualizador)),
    db: Session = Depends(get_session),
) -> DownloadUrl:
    can_view, _, _ = _resolve_access(bucket_name, user, db)
    if not can_view:
        raise HTTPException(status_code=403, detail="Sem acesso a este bucket.")

    try:
        url = get_minio_client().presigned_get_object(bucket_name, object_name, expires=timedelta(hours=1))
    except S3Error as exc:
        raise HTTPException(status_code=502, detail="Erro ao gerar link de download.") from exc
    return DownloadUrl(url=url)
