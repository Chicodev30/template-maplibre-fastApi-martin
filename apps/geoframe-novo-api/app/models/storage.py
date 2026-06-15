# Configuracao e permissoes de acesso aos buckets MinIO (Explorador de arquivos).
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class BucketConfig(Base):
    # Restricoes aplicadas a um bucket: extensoes aceitas e tamanho maximo por arquivo.
    __tablename__ = "bucket_configs"

    id: Mapped[int] = mapped_column(primary_key=True)
    bucket_name: Mapped[str] = mapped_column(String(63), unique=True, index=True)
    allowed_extensions: Mapped[list[str]] = mapped_column(JSON, default=list)
    max_file_size_mb: Mapped[int] = mapped_column(Integer, default=200)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class BucketAccessGrant(Base):
    # Liberacao de acesso a um bucket para um papel do app ou um usuario especifico.
    __tablename__ = "bucket_access_grants"

    id: Mapped[int] = mapped_column(primary_key=True)
    bucket_name: Mapped[str] = mapped_column(String(63), index=True)
    # "role" -> principal_value e um AppRole (admin|contribuidor|visualizador)
    # "user" -> principal_value e o username
    principal_type: Mapped[str] = mapped_column(String(20))
    principal_value: Mapped[str] = mapped_column(String(255))
    can_upload: Mapped[bool] = mapped_column(Boolean, default=False)
    can_delete: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
