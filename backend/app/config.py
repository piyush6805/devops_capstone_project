from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://stockpilot:stockpilot-local-only@localhost:5432/stockpilot"
    app_version: str = "local"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
