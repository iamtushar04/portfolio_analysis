from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from sqlalchemy.orm import Session as DBSession
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
import uuid
import json

from ..database import get_db
from ..models import schemas
from ..redis_client import redis_client
from ..auth.dependencies import get_current_user_id

router = APIRouter(tags=["claim-charts"])


class ClaimChartStartRequest(BaseModel):
    patent_number: str
    assignees: List[str]
    products: List[dict]
    custom_instructions: Optional[str] = ""


@router.post("/claim-chart/start")
def start_claim_chart_generation(
    payload: ClaimChartStartRequest,
    background_tasks: BackgroundTasks,
    request: Request,
    current_user_id: str = Depends(get_current_user_id),
    db: DBSession = Depends(get_db)
):
    job_id = str(uuid.uuid4())
    auth_token = request.headers.get("Authorization")
    user_id = request.headers.get("x-kyp-user-id", "1")
    
    # Check cache for existing claim charts
    cached_products = []
    uncached_products = []
    
    for prod in payload.products:
        company = prod.get("company", "")
        model = prod.get("model", "")
        
        cache_entry = db.query(schemas.ClaimChartCache).filter(
            schemas.ClaimChartCache.patent_number == payload.patent_number,
            schemas.ClaimChartCache.company == company,
            schemas.ClaimChartCache.model == model
        ).first()
        
        if cache_entry:
            cached_products.append(cache_entry.result_data)
        else:
            uncached_products.append(prod)

    # If all products are cached, return immediately
    if not uncached_products:
        mock_job_id = f"cached_{job_id}"
        cached_result = {
            "analysis_date": datetime.utcnow().strftime("%Y-%m-%d"),
            "patent_number": payload.patent_number,
            "products_analysis": cached_products,
            "claim_construction": []
        }
        redis_client.set(f"claim_chart_job:{mock_job_id}", json.dumps({
            "status": "completed",
            "result": cached_result
        }), ex=86400)
        return {"job_id": mock_job_id}

    from ..services.claim_chart.claim_chart_service import generate_claim_chart_background
    background_tasks.add_task(
        generate_claim_chart_background,
        job_id,
        payload.patent_number,
        payload.assignees,
        uncached_products,
        cached_products,
        payload.custom_instructions,
        auth_token,
        user_id
    )
    return {"job_id": job_id}


@router.get("/claim-chart/{job_id}/status")
def check_claim_chart_status(
    job_id: str,
    current_user_id: str = Depends(get_current_user_id)
):
    data = redis_client.get(f"claim_chart_job:{job_id}")
    if not data:
        raise HTTPException(status_code=404, detail="Job not found")
    return json.loads(data)


@router.get("/claim-chart/cache/{patent_number}")
def get_claim_chart_cache(
    patent_number: str,
    db: DBSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id)
):
    """Fetch all cached claim charts for a given patent number."""
    cache_entries = db.query(schemas.ClaimChartCache).filter(
        schemas.ClaimChartCache.patent_number == patent_number
    ).all()
    
    return [entry.result_data for entry in cache_entries]
