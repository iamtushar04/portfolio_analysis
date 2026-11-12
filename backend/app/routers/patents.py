from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Request
from sqlalchemy.orm import Session as DBSession
from typing import List, Optional
from pydantic import BaseModel
import pandas as pd
import io
import time

from ..database import get_db
from ..models import schemas
from ..logging_config import logger
from ..redis_client import redis_client
from ..auth.dependencies import get_current_user_id

router = APIRouter(tags=["patents"])


class IngestPatentsRequest(BaseModel):
    patent_numbers: List[str]


class RetryPatentsRequest(BaseModel):
    patent_numbers: Optional[List[str]] = None
    retry_all_failed: Optional[bool] = False


def _enqueue_patents_for_session(
    session_id: str,
    patent_numbers: List[str],
    db_session: schemas.Session,
    db: DBSession,
    background_tasks: BackgroundTasks,
    request: Request,
    current_user_id: str
) -> dict:
    """Helper to enqueue patents into a session non-destructively.
    Filters existing patents, updates counters incrementally, and queues only new patents.
    """
    seen = set()
    cleaned_numbers = []
    for num in patent_numbers:
        cleaned = str(num).strip()
        if cleaned and cleaned.lower() not in ('nan', 'none', '') and cleaned not in seen:
            seen.add(cleaned)
            cleaned_numbers.append(cleaned)

    if not cleaned_numbers:
        raise HTTPException(status_code=400, detail="No valid patent numbers provided")

    # Fetch existing patent numbers for this session to support non-destructive append
    existing_records = db.query(schemas.PatentData.patent_number).filter(
        schemas.PatentData.session_id == session_id
    ).all()
    existing_patent_numbers = set(r[0] for r in existing_records)

    # Filter out numbers already in this session
    new_numbers = [num for num in cleaned_numbers if num not in existing_patent_numbers]
    skipped_count = len(cleaned_numbers) - len(new_numbers)

    if not new_numbers:
        return {
            "message": f"All {len(cleaned_numbers)} patents are already present in this session.",
            "new_patents_queued": 0,
            "skipped_duplicates": skipped_count,
            "total_patents": len(existing_patent_numbers)
        }

    # Count how many patents have already been completed (success/failed)
    already_processed_count = db.query(schemas.PatentData).filter(
        schemas.PatentData.session_id == session_id,
        schemas.PatentData.status.in_(["success", "failed"])
    ).count()

    # Update session counters incrementally
    new_total = len(existing_patent_numbers) + len(new_numbers)
    db_session.total_patents = new_total
    db_session.processed_patents = already_processed_count
    db_session.status = "processing"
    db_session.kyp_status = "processing"
    db_session.assignee_ranking_status = "pending"

    # Pre-populate ONLY the new patent records with status='pending'
    for num in new_numbers:
        patent_record = schemas.PatentData(
            session_id=session_id,
            patent_number=num,
            status="pending"
        )
        db.add(patent_record)

    db.commit()

    # Enqueue ONLY new patents into session-specific Redis list for Round-Robin execution
    queue_key = f"session_patents:{session_id}"
    redis_client.rpush(queue_key, *new_numbers)
    redis_client.sadd("active_sessions_set", session_id)

    # Trigger the round-robin dispatcher to schedule tasks across all active sessions
    from ..tasks import dispatch_round_robin_tasks
    dispatch_round_robin_tasks.delay()
    
    # Extract JWT auth token and KYP internal user ID from the incoming request to pass to KYP APIs
    auth_token = request.headers.get("Authorization")
    if auth_token:
        redis_client.set(f"session_auth_token:{session_id}", auth_token, ex=86400)
    
    logger.info(f"[{session_id}] RECEIVED HEADERS: {dict(request.headers)}")
    kyp_user_id = request.headers.get("x-kyp-user-id", "1")
    
    # Trigger the parallel KYP background job ONLY for the newly added patents
    from ..background_jobs import process_session_kyp_batch_bg
    background_tasks.add_task(process_session_kyp_batch_bg, session_id, new_numbers, auth_token, kyp_user_id)

    msg = f"Successfully queued {len(new_numbers)} new patent(s) for background processing."
    if skipped_count > 0:
        msg += f" ({skipped_count} existing duplicate(s) skipped)."

    return {
        "message": msg,
        "new_patents_queued": len(new_numbers),
        "skipped_duplicates": skipped_count,
        "total_patents": new_total
    }


@router.post("/{session_id}/patents")
async def ingest_patents(
    session_id: str,
    payload: IngestPatentsRequest,
    background_tasks: BackgroundTasks,
    request: Request,
    db: DBSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id)
):
    """Ingest patent numbers via JSON list (pasted numbers or pre-parsed list)."""
    db_session = db.query(schemas.Session).filter(
        schemas.Session.id == session_id,
        schemas.Session.owner_id == current_user_id
    ).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")

    return _enqueue_patents_for_session(
        session_id=session_id,
        patent_numbers=payload.patent_numbers,
        db_session=db_session,
        db=db,
        background_tasks=background_tasks,
        request=request,
        current_user_id=current_user_id
    )


@router.post("/{session_id}/upload")
async def upload_excel(
    session_id: str,
    background_tasks: BackgroundTasks,
    request: Request,
    file: UploadFile = File(...),
    db: DBSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id)
):
    db_session = db.query(schemas.Session).filter(
        schemas.Session.id == session_id,
        schemas.Session.owner_id == current_user_id
    ).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")

    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files are supported")

    contents = await file.read()
    
    logger.info(f"[User {current_user_id}] [Session {session_id}] Starting Excel file processing: {file.filename} (Size: {len(contents)} bytes)")
    parse_start_time = time.perf_counter()
    
    try:
        df = pd.read_excel(io.BytesIO(contents))
        
        patent_col = None
        for col in df.columns:
            col_name = str(col).lower()
            if 'patent' in col_name or 'publication' in col_name:
                patent_col = col
                break
        
        if patent_col is None:
            patent_col = df.columns[0]
            
        raw_numbers = df[patent_col].dropna().astype(str).tolist()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading Excel file: {str(e)}")

    parse_duration = time.perf_counter() - parse_start_time
    logger.info(f"[{session_id}] Parsed {len(raw_numbers)} raw entries from Excel in {parse_duration:.2f}s")

    return _enqueue_patents_for_session(
        session_id=session_id,
        patent_numbers=raw_numbers,
        db_session=db_session,
        db=db,
        background_tasks=background_tasks,
        request=request,
        current_user_id=current_user_id
    )


@router.post("/{session_id}/retry")
async def retry_failed_patents(
    session_id: str,
    payload: RetryPatentsRequest,
    background_tasks: BackgroundTasks,
    request: Request,
    db: DBSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id)
):
    """Retry failed patents in bulk or selectively."""
    db_session = db.query(schemas.Session).filter(
        schemas.Session.id == session_id,
        schemas.Session.owner_id == current_user_id
    ).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")

    query = db.query(schemas.PatentData).filter(
        schemas.PatentData.session_id == session_id,
        schemas.PatentData.status == "failed"
    )

    if not payload.retry_all_failed:
        if not payload.patent_numbers:
            raise HTTPException(status_code=400, detail="Provide patent_numbers to retry or set retry_all_failed=true")
        query = query.filter(schemas.PatentData.patent_number.in_(payload.patent_numbers))

    failed_records = query.all()
    if not failed_records:
        return {
            "message": "No matching failed patents found to retry.",
            "retried_count": 0
        }

    retried_numbers = []
    for rec in failed_records:
        rec.status = "pending"
        rec.error_message = None
        retried_numbers.append(rec.patent_number)

    db_session.status = "processing"
    db_session.kyp_status = "processing"
    db_session.assignee_ranking_status = "pending"
    success_count = db.query(schemas.PatentData).filter(
        schemas.PatentData.session_id == session_id,
        schemas.PatentData.status == "success"
    ).count()
    db_session.processed_patents = success_count

    db.commit()

    queue_key = f"session_patents:{session_id}"
    redis_client.rpush(queue_key, *retried_numbers)
    redis_client.sadd("active_sessions_set", session_id)

    from ..tasks import dispatch_round_robin_tasks
    dispatch_round_robin_tasks.delay()

    auth_token = request.headers.get("Authorization")
    if auth_token:
        redis_client.set(f"session_auth_token:{session_id}", auth_token, ex=86400)

    kyp_user_id = request.headers.get("x-kyp-user-id", "1")
    from ..background_jobs import process_session_kyp_batch_bg
    background_tasks.add_task(process_session_kyp_batch_bg, session_id, retried_numbers, auth_token, kyp_user_id)

    logger.info(f"[User {current_user_id}] [Session {session_id}] Re-queued {len(retried_numbers)} failed patents for retry.")

    return {
        "message": f"Successfully re-queued {len(retried_numbers)} failed patents for retry.",
        "retried_count": len(retried_numbers),
        "patent_numbers": retried_numbers
    }
