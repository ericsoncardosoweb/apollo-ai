"""
Apollo A.I. Advanced - Application Configuration

Uses Pydantic Settings for type-safe configuration management.
"""

from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with environment variable support."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ===========================================
    # General
    # ===========================================
    environment: str = "development"
    debug: bool = True
    secret_key: str = "change-me-in-production"
    
    # ===========================================
    # API
    # ===========================================
    api_prefix: str = "/api/v1"
    cors_origins_raw: str = "*"  # Raw string, parsed by property
    
    @property
    def cors_origins(self) -> List[str]:
        """Parse CORS origins from raw string."""
        v = self.cors_origins_raw
        if not v or not v.strip():
            return ["*"]
        # Try JSON parse first
        if v.startswith("["):
            import json
            try:
                return json.loads(v)
            except Exception:
                pass
        # Fall back to comma-separated
        return [origin.strip() for origin in v.split(",") if origin.strip()]


    # ===========================================
    # Supabase
    # ===========================================
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    # ===========================================
    # Redis & Celery
    # ===========================================
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    # ===========================================
    # OpenAI
    # ===========================================
    openai_api_key: str = ""
    openai_default_model: str = "gpt-4o-mini"
    openai_embedding_model: str = "text-embedding-ada-002"

    # ===========================================
    # WhatsApp Gateways
    # ===========================================
    # Evolution API
    evolution_api_url: str = ""
    evolution_api_key: str = ""
    
    # Z-API
    zapi_url: str = ""
    zapi_instance_id: str = ""
    zapi_token: str = ""
    
    # UAZAPI
    uazapi_url: str = ""
    uazapi_token: str = ""
    
    # Meta Cloud API
    meta_waba_id: str = ""
    meta_phone_number_id: str = ""
    meta_access_token: str = ""

    # ===========================================
    # AI Configuration
    # ===========================================
    ai_max_tokens: int = 1000
    ai_temperature: float = 0.7
    ai_memory_window: int = 10  # Last N messages
    
    # RAG Configuration
    rag_chunk_size: int = 1000
    rag_chunk_overlap: int = 200
    rag_top_k: int = 5

    # ===========================================
    # Rate Limiting
    # ===========================================
    rate_limit_requests: int = 100
    rate_limit_window: int = 60  # seconds

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Global settings instance
settings = get_settings()
