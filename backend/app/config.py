
from pathlib import Path

from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
        env_ignore_empty=True,
        hide_input_in_errors=True,
    )

    mongodb_uri: SecretStr
    database_name: str = "minibiz"

    @field_validator("mongodb_uri")
    @classmethod
    def validate_mongodb_uri(cls, value: SecretStr) -> SecretStr:
        uri = value.get_secret_value().strip()

        if not uri.startswith(("mongodb://", "mongodb+srv://")):
            raise ValueError(
                "MONGODB_URI must start with mongodb:// or mongodb+srv://"
            )

        if uri in ("mongodb://", "mongodb+srv://"):
            raise ValueError("MONGODB_URI must contain a valid connection address")

        return SecretStr(uri)

    @field_validator("database_name")
    @classmethod
    def validate_database_name(cls, value: str) -> str:
        name = value.strip()

        if not name:
            raise ValueError("DATABASE_NAME cannot be empty")

        return name


settings = Settings()
