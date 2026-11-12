from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from sqlalchemy.orm import Session as DBSession
from typing import Optional
from pydantic import BaseModel
import uuid

from ..database import get_db
from ..models import schemas
from ..auth.dependencies import get_current_user_id

router = APIRouter(tags=["infringement"])


class InfringementStartRequest(BaseModel):
    patent_number: str
    custom_instruction: Optional[str] = None


@router.post("/infringement/start")
def start_infringement_analysis(
    payload: InfringementStartRequest,
    background_tasks: BackgroundTasks,
    request: Request,
    db: DBSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id)
):
    job_id = str(uuid.uuid4())
    
    # Check cache for existing infringement analysis
    cache_entry = db.query(schemas.InfringementAnalysisCache).filter(
        schemas.InfringementAnalysisCache.patent_number == payload.patent_number
    ).first()
    
    if cache_entry:
        return {
            "job_id": job_id,
            "status": "completed",
            "result": cache_entry.result_data
        }
        
    from ..services.infringement_service import run_infringement_job
    auth_token = request.headers.get("Authorization")
    background_tasks.add_task(
        run_infringement_job,
        job_id,
        payload.patent_number,
        auth_token,
        payload.custom_instruction
    )
    return {"job_id": job_id}


@router.get("/infringement/{job_id}/status")
def check_infringement_status(
    job_id: str,
    current_user_id: str = Depends(get_current_user_id)
):
    from ..services.infringement_service import get_infringement_job_status
    status_data = get_infringement_job_status(job_id)
    if not status_data:
        raise HTTPException(status_code=404, detail="Job not found")
    return status_data
