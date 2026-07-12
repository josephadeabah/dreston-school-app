from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str
    SUPABASE_JWT_SECRET: str

    ARKESEL_API_KEY: str = ""
    ARKESEL_SENDER_ID: str = "DrestonElit"  # max 11 chars, no spaces, for alphanumeric sender IDs
    ARKESEL_SANDBOX: bool = True  # keep true until you've registered a sender ID and bought credit

    RESEND_API_KEY: str = ""
    RESEND_FROM_EMAIL: str = "school@drestonelite.edu.gh"

    CORS_ORIGINS: str = "http://localhost:3000"
    ENVIRONMENT: str = "development"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
