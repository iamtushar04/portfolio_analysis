import os
from dotenv import load_dotenv

# Load environment variables from .env file
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
load_dotenv(dotenv_path=env_path)

class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY")
    PERPLEXITY_API_KEY: str = os.getenv("PERPLEXITY_API_KEY")
    
    WISSEN_API_BASE_URL: str = os.getenv("WISSEN_API_BASE_URL")
    WISSEN_AI_API_BASE_URL: str = os.getenv("WISSEN_AI_API_BASE_URL")
    SPARTA_API_BASE_URL: str = os.getenv("SPARTA_API_BASE_URL")
    COMPETITOR_API_URL: str = os.getenv("COMPETITOR_API_URL")
    AGENT_API_BASE_URL: str = os.getenv("AGENT_API_BASE_URL")
    KYP_BASE_URL: str = os.getenv("KYP_BASE_URL")
    
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    CELERY_CONCURRENCY: int = int(os.getenv("CELERY_CONCURRENCY", "4"))

    LANGFUSE_SECRET_KEY: str = os.getenv("LANGFUSE_SECRET_KEY", "")
    LANGFUSE_PUBLIC_KEY: str = os.getenv("LANGFUSE_PUBLIC_KEY", "")
    LANGFUSE_HOST: str = os.getenv("LANGFUSE_HOST", "https://us.cloud.langfuse.com")

    # Global patent caching controls
    ENABLE_PATENT_CACHE: bool = os.getenv("ENABLE_PATENT_CACHE", "true").lower() == "true"
    ENABLE_ASSIGNEE_RANKING_CACHE: bool = os.getenv("ENABLE_ASSIGNEE_RANKING_CACHE", "true").lower() == "true"
    CACHE_EXPIRY_DAYS: int = int(os.getenv("CACHE_EXPIRY_DAYS", "0"))

    # -----------------------------------------------------------------------
    # Session-level assignee ranking optimisation (two-phase pipeline)
    # -----------------------------------------------------------------------

    # Which taxonomy term types to send to Perplexity.
    # Options: "subtopic" | "topic" | "topic,subtopic"
    # Change to "topic,subtopic" to evaluate both layers.
    ASSIGNEE_RANKING_TERM_TYPES: list = [
        t.strip()
        for t in os.getenv("ASSIGNEE_RANKING_TERM_TYPES", "subtopic").split(",")
        if t.strip()
    ]

    # Assignee pre-filters (applied in Phase 1, before Redis accumulation)
    ENABLE_JURISDICTION_FILTER: bool = os.getenv("ENABLE_JURISDICTION_FILTER", "true").lower() == "true"
    ENABLE_OC_FILTER: bool = os.getenv("ENABLE_OC_FILTER", "true").lower() == "true"

settings = Settings()
