from langfuse import Langfuse
import logging
from ..config import settings

logger = logging.getLogger(__name__)

# Initialize Langfuse client
if settings.LANGFUSE_PUBLIC_KEY and settings.LANGFUSE_SECRET_KEY:
    langfuse_client = Langfuse(
        public_key=settings.LANGFUSE_PUBLIC_KEY,
        secret_key=settings.LANGFUSE_SECRET_KEY,
        host=settings.LANGFUSE_HOST
    )
    logger.info("Langfuse client initialized successfully.")
else:
    langfuse_client = None
    logger.warning("Langfuse keys not found. Tracing will be disabled.")
