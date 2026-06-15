# Cliente MinIO para o Explorador de arquivos (gerenciamento de buckets/objetos).
from functools import lru_cache

from minio import Minio

from app.config import get_settings

# Extensoes e limite de tamanho aplicados por padrao a um bucket novo.
DEFAULT_ALLOWED_EXTENSIONS: list[str] = [
    ".zip", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg", ".tif", ".tiff",
    ".pdf", ".txt", ".log", ".md", ".csv", ".tsv", ".json", ".xml", ".yaml", ".yml",
    ".ini", ".cfg", ".conf", ".rtf", ".doc", ".docx", ".odt", ".xls", ".xlsx", ".ods",
    ".ppt", ".pptx",
]
DEFAULT_MAX_FILE_SIZE_MB = 200


@lru_cache
def get_minio_client() -> Minio:
    settings = get_settings()
    return Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_secure,
    )
