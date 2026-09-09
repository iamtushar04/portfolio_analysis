# pyrefly: ignore [missing-import]
from celery import Celery
from .config import settings

celery_app = Celery(
    "portfolio_analysis",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    
    # Acknowledge task ONLY after it completes — if worker crashes mid-task,
    # Redis re-queues it automatically (no data loss)
    task_acks_late=True,
    
    # Worker pre-fetches only 1 task at a time — ensures fair distribution
    # across multiple users (no one user hogs the worker)
    worker_prefetch_multiplier=1,
    
    # Retry on connection lost to Redis
    broker_connection_retry_on_startup=True,
    
    # Task result expiry (24 hours)
    result_expires=86400,
    
    # Task time limit: 10 minutes per patent (prevents infinite hangs)
    task_soft_time_limit=600,
    task_time_limit=660,
)
