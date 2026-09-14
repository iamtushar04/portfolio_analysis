from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import sessions

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Patent Portfolio Analysis API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://135.181.19.83:8511", "http://localhost:8511"], # Allow production and local frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sessions.router, prefix="/api/sessions", tags=["sessions"])

@app.get("/")
def read_root():
    return {"message": "Patent Portfolio Analysis API is running"}
