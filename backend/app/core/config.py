from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")

    APP_NAME: str = "FinanceTrace — Personal Banking API"
    APP_ENV: str = "development"
    DATABASE_URL: str = "postgresql+asyncpg://finance_user:finance_dev_pass@localhost:5432/finance_tracker"
    REDIS_URL: str = "redis://localhost:6379/0"
    CACHE_TTL_SECONDS: int = 60
    ENABLE_REDIS_CACHE: bool = True

    SECRET_KEY: str = "dev_secret_key_change_in_production_0123456789abcdef0123456789ab"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    SESSION_TTL_SECONDS: int = 86400
    COOKIE_SECURE: bool = False
    COOKIE_NAME: str = "ft_access_token"
    REFRESH_COOKIE_NAME: str = "ft_refresh_token"

    CORS_ORIGINS: str = "http://localhost,http://localhost:3000,http://localhost:5173"
    REPORTS_DIR: str = str(Path(__file__).resolve().parents[2] / "generated_reports")

    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@financetrace.local"

    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
