import redis
from .config import settings

# Global Redis client instance
redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
