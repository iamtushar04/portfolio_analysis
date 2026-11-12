from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session as DBSession
from typing import List
import uuid

from ..database import get_db
from ..models import schemas
from ..redis_client import redis_client
from ..logging_config import logger
from ..auth.dependencies import get_current_user_id
from ..services.session_lifecycle import check_and_update_session_completion

router = APIRouter(tags=["sessions"])

@router.post("/", response_model=dict)
def create_session(
    name: str = "New Session",
    db: DBSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id)
):
    session_id = str(uuid.uuid4())
    db_session = schemas.Session(id=session_id, name=name, status="pending", owner_id=current_user_id)
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return {"id": db_session.id, "name": db_session.name, "status": db_session.status}

@router.get("/", response_model=List[dict])
def list_sessions(
    db: DBSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id)
):
    sessions = db.query(schemas.Session).filter(schemas.Session.owner_id == current_user_id).order_by(schemas.Session.created_at.desc()).all()
    result = []
    for s in sessions:
        if s.status == "processing":
            if check_and_update_session_completion(db, s.id):
                db.refresh(s)
        processed_count = db.query(schemas.PatentData).filter(
            schemas.PatentData.session_id == s.id,
            schemas.PatentData.status.in_(["success", "failed"])
        ).count()
        result.append({
            "id": s.id, 
            "name": s.name, 
            "status": s.status, 
            "kyp_status": s.kyp_status,
            "assignee_ranking_status": getattr(s, 'assignee_ranking_status', 'pending'),
            "total_patents": s.total_patents, 
            "processed_patents": processed_count, 
            "created_at": s.created_at
        })
    return result

@router.get("/{session_id}", response_model=dict)
def get_session(
    session_id: str,
    db: DBSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id)
):
    db_session = db.query(schemas.Session).filter(
        schemas.Session.id == session_id,
        schemas.Session.owner_id == current_user_id
    ).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")

    if db_session.status == "processing":
        if check_and_update_session_completion(db, session_id):
            db.refresh(db_session)

    import json

    patents = []
    processed_count = 0
    for p in db_session.patents:
        if p.status in ["success", "failed"]:
            processed_count += 1
            
        patent_dict = {
            "id": p.id,
            "patent_number": p.patent_number,
            "title": p.title,
            "assignees": p.assignees,
            "assignee": p.assignees[0] if p.assignees else None,
            "abstract": p.abstract,
            "claims": p.claims,
            "forward_citations": p.forward_citations,
            "backward_citations": p.backward_citations,
            "taxonomies": p.taxonomies,
            "standard": p.standard,
            "standard_links": p.standard_links,
            "competitors": p.competitors,
            "forward_competitors": p.forward_competitors,
            "backward_competitors": p.backward_competitors,
            "ranked_forward_assignees": getattr(p, "ranked_forward_assignees", None),
            "kyp_score": p.kyp_score,
            "kyp_score_data": p.kyp_score_data,
            "kyp_classifications": p.kyp_classifications,
            "status": p.status,
            "error_message": p.error_message
        }

        # Check if an infringement analysis is already cached in the DB for this patent
        cached_infringement = db.query(schemas.InfringementAnalysisCache).filter(
            schemas.InfringementAnalysisCache.patent_number == p.patent_number
        ).first()
        patent_dict["has_cached_infringement"] = cached_infringement is not None

        # Check if an active infringement job is currently running in Redis
        try:
            running_job_id = (
                redis_client.get(f"infringement_running:{p.patent_number}") or
                redis_client.get(f"active_infringement_job:{p.patent_number}")
            )
            if running_job_id:
                if isinstance(running_job_id, bytes):
                    running_job_id = running_job_id.decode("utf-8")
                job_status_raw = redis_client.get(f"infringement_job:{running_job_id}")
                if job_status_raw:
                    try:
                        if isinstance(job_status_raw, bytes):
                            job_status_raw = job_status_raw.decode("utf-8")
                        job_data = json.loads(job_status_raw)
                        if job_data.get("status") == "running":
                            patent_dict["running_infringement_job_id"] = running_job_id
                    except Exception:
                        pass
        except Exception:
            pass

        patents.append(patent_dict)

    return {
        "id": db_session.id,
        "name": db_session.name,
        "status": db_session.status,
        "kyp_status": db_session.kyp_status,
        "assignee_ranking_status": getattr(db_session, 'assignee_ranking_status', 'pending'),
        "total_patents": db_session.total_patents,
        "processed_patents": processed_count,
        "patents": patents
    }

@router.get("/{session_id}/status", response_model=dict)
def get_session_status(
    session_id: str,
    db: DBSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id)
):
    db_session = db.query(schemas.Session).filter(
        schemas.Session.id == session_id,
        schemas.Session.owner_id == current_user_id
    ).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")

    if db_session.status == "processing":
        if check_and_update_session_completion(db, session_id):
            db.refresh(db_session)

    processed_count = db.query(schemas.PatentData).filter(
        schemas.PatentData.session_id == session_id,
        schemas.PatentData.status.in_(["success", "failed"])
    ).count()

    return {
        "status": db_session.status,
        "kyp_status": db_session.kyp_status,
        "assignee_ranking_status": getattr(db_session, 'assignee_ranking_status', 'pending'),
        "total_patents": db_session.total_patents,
        "processed_patents": processed_count
    }

def _delete_session_background(session_id: str):
    """Background task to delete session and halt queue processing."""
    try:
        redis_client.srem("active_sessions_set", session_id)
        redis_client.delete(f"session_patents:{session_id}")
        
        db = next(get_db())
        session = db.query(schemas.Session).filter(schemas.Session.id == session_id).first()
        if session:
            db.delete(session)
            db.commit()
            logger.info(f"Session {session_id} deleted successfully.")
    except Exception as e:
        logger.error(f"Error deleting session {session_id} in background: {e}")

@router.delete("/{session_id}", status_code=202)
def delete_session(
    session_id: str,
    background_tasks: BackgroundTasks,
    db: DBSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id)
):
    """Instantly halts processing and deletes session in background."""
    db_session = db.query(schemas.Session).filter(
        schemas.Session.id == session_id,
        schemas.Session.owner_id == current_user_id
    ).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    background_tasks.add_task(_delete_session_background, session_id)
    return {"message": "Session deletion accepted and processing in background."}
