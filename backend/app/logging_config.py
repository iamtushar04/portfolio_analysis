import logging
import sys
import os
from logging.handlers import RotatingFileHandler
from contextvars import ContextVar
from pythonjsonlogger import jsonlogger
import uuid

# Global context variable for correlation ID
correlation_id_ctx: ContextVar[str] = ContextVar("correlation_id", default="")

class CorrelationIdFilter(logging.Filter):
    """Injects correlation_id into all logs"""
    def filter(self, record):
        record.correlation_id = correlation_id_ctx.get()
        return True

def setup_logging():
    log_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "logs")
    os.makedirs(log_dir, exist_ok=True)
    log_file = os.path.join(log_dir, "app.log")
    
    # Create JSON formatter
    formatter = jsonlogger.JsonFormatter(
        '%(asctime)s %(name)s %(levelname)s %(correlation_id)s %(message)s',
        rename_fields={"asctime": "timestamp", "levelname": "level"}
    )
    
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    
    file_handler = RotatingFileHandler(
        log_file, maxBytes=10*1024*1024, backupCount=5
    )
    file_handler.setFormatter(formatter)
    
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    
    if not root_logger.handlers:
        root_logger.addHandler(console_handler)
        root_logger.addHandler(file_handler)
        
    # Apply filter to all handlers
    for handler in root_logger.handlers:
        handler.addFilter(CorrelationIdFilter())
        
    return root_logger

logger = setup_logging()
