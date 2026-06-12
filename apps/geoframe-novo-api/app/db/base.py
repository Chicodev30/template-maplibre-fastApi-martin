# Base declarativa SQLAlchemy.
from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

APP_SCHEMA = get_settings().db_app_schema


class Base(DeclarativeBase):
    # Todas as tabelas do app vivem no schema dedicado (ex.: gfr_app).
    metadata = MetaData(schema=APP_SCHEMA)
