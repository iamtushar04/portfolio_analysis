from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import time
import uuid

from .database import engine, Base
from .config import settings
from .routers import (
    sessions_router,
    patents_router,
    exports_router,
    infringement_router,
    claim_charts_router
)
from .logging_config import logger, correlation_id_ctx

# Create database tables
try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    logger.warning(f"Could not auto-create database tables on startup: {e}")

app = FastAPI(title="Patent Portfolio Analysis API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_process_time_header_and_log(request: Request, call_next):
    # Set correlation ID for this request
    req_id = str(uuid.uuid4())
    token = correlation_id_ctx.set(req_id)

    start_time = time.perf_counter()

    # Process the request
    response = await call_next(request)

    process_time_ms = (time.perf_counter() - start_time) * 1000
    client_host = request.client.host if request.client else "Unknown"

    # Noise Filtering Logic
    path = request.url.path
    method = request.method

    # Ignore OPTIONS (CORS preflight)
    if method == "OPTIONS":
        return response

    # Ignore fast GET requests to /api/sessions/ (frontend polling)
    if method == "GET" and "/api/sessions" in path and process_time_ms < 500:
        return response

    logger.info(
        f"[HTTP {method}] {path}",
        extra={
            "http_method": method,
            "http_path": path,
            "status_code": response.status_code,
            "duration_ms": round(process_time_ms, 2),
            "client_ip": client_host,
        },
    )

    # Clean up context var (optional but good practice)
    correlation_id_ctx.reset(token)

    return response


# 1. Static sub-paths first to prevent /{session_id} shadowing
app.include_router(infringement_router, prefix="/api/sessions", tags=["infringement"])
app.include_router(claim_charts_router, prefix="/api/sessions", tags=["claim-charts"])

# 2. Patent operations & export endpoints
app.include_router(patents_router, prefix="/api/sessions", tags=["patents"])
app.include_router(exports_router, prefix="/api/sessions", tags=["exports"])

# 3. Base session CRUD (contains /{session_id} parameter)
app.include_router(sessions_router, prefix="/api/sessions", tags=["sessions"])


@app.get("/")
def read_root():
    return {"message": "Patent Portfolio Analysis API is running"}
