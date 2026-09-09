import os
from dotenv import load_dotenv

# Load environment variables from .env file
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
load_dotenv(dotenv_path=env_path)

class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY")
    
    WISSEN_API_BASE_URL: str = os.getenv("WISSEN_API_BASE_URL")
    SPARTA_API_BASE_URL: str = os.getenv("SPARTA_API_BASE_URL")
    COMPETITOR_API_URL: str = os.getenv("COMPETITOR_API_URL")
    
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    CELERY_CONCURRENCY: int = int(os.getenv("CELERY_CONCURRENCY", "4"))

    LANGFUSE_SECRET_KEY: str = os.getenv("LANGFUSE_SECRET_KEY", "")
    LANGFUSE_PUBLIC_KEY: str = os.getenv("LANGFUSE_PUBLIC_KEY", "")
    LANGFUSE_HOST: str = os.getenv("LANGFUSE_HOST", "https://us.cloud.langfuse.com")

settings = Settings()
