from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session as DBSession
from typing import List
import uuid
import pandas as pd
import io

from ..database import get_db
from ..models import schemas
from ..services.excel_export import generate_session_excel
from ..tasks import process_patent_task
from ..redis_client import redis_client
from ..auth.dependencies import get_current_user_id

router = APIRouter()

@router.post("/", response_model=dict)
def create_session(name: str = "New Session", db: DBSession = Depends(get_db), current_user_id: str = Depends(get_current_user_id)):
    session_id = str(uuid.uuid4())
    db_session = schemas.Session(id=session_id, name=name, status="pending", owner_id=current_user_id)
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return {"id": db_session.id, "name": db_session.name, "status": db_session.status}

@router.get("/", response_model=List[dict])
def list_sessions(db: DBSession = Depends(get_db), current_user_id: str = Depends(get_current_user_id)):
    sessions = db.query(schemas.Session).filter(schemas.Session.owner_id == current_user_id).order_by(schemas.Session.created_at.desc()).all()
    result = []
    for s in sessions:
        processed_count = db.query(schemas.PatentData).filter(
            schemas.PatentData.session_id == s.id,
            schemas.PatentData.status.in_(["success", "failed"])
        ).count()
        result.append({
            "id": s.id, 
            "name": s.name, 
            "status": s.status, 
            "total_patents": s.total_patents, 
            "processed_patents": processed_count, 
            "created_at": s.created_at
        })
    return result

@router.get("/{session_id}", response_model=dict)
def get_session(session_id: str, db: DBSession = Depends(get_db), current_user_id: str = Depends(get_current_user_id)):
    db_session = db.query(schemas.Session).filter(
        schemas.Session.id == session_id,
        schemas.Session.owner_id == current_user_id
    ).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    patents = db.query(schemas.PatentData).filter(schemas.PatentData.session_id == session_id).all()
    
    # Calculate processed count dynamically
    processed_count = sum(1 for p in patents if p.status in ("success", "failed"))
    
    # Self-healing: if all patents are done but session is still marked 'processing',
    # flip it to 'completed' so the frontend stops polling and shows 100%.
    # This recovers sessions that were stuck before the atomic counter fix was deployed.
    if (processed_count >= db_session.total_patents
            and db_session.total_patents > 0
            and db_session.status == "processing"):
        db_session.status = "completed"
        db.commit()
    
    return {
        "id": db_session.id,
        "name": db_session.name,
        "status": db_session.status,
        "total_patents": db_session.total_patents,
        "processed_patents": processed_count,
        "patents": [
            {
                "patent_number": p.patent_number,
                "title": p.title,
                "assignees": p.assignees if getattr(p, 'assignees', None) else ([] if not getattr(p, 'assignee', None) else [p.assignee]),
                "assignee": (p.assignees[0] if getattr(p, 'assignees', None) and len(p.assignees) > 0 else getattr(p, 'assignee', 'Unknown')),
                "abstract": p.abstract,
                "status": p.status,
                "taxonomies": p.taxonomies,
                "forward_citations": p.forward_citations,
                "backward_citations": p.backward_citations,
                "competitors": p.competitors,
                "forward_competitors": getattr(p, 'forward_competitors', []) or [],
                "backward_competitors": getattr(p, 'backward_competitors', []) or [],
                "standard": p.standard,
                "standard_links": p.standard_links,
                "error_message": p.error_message
            } for p in patents
        ]
    }

@router.get("/{session_id}/export")
def export_session_excel(session_id: str, db: DBSession = Depends(get_db), current_user_id: str = Depends(get_current_user_id)):
    session_data = get_session(session_id, db, current_user_id)
    excel_bytes = generate_session_excel(session_data)
    safe_name = "".join(c for c in session_data.get("name", "session") if c.isalnum() or c in (" ", "_", "-")).strip().replace(" ", "_")
    filename = f"{safe_name}_{session_id[:8]}.xlsx"
    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.post("/{session_id}/upload")
async def upload_excel(
    session_id: str,
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
    try:
        df = pd.read_excel(io.BytesIO(contents))
        patent_col = df.columns[0]
        raw_numbers = df[patent_col].dropna().astype(str).tolist()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading Excel file: {str(e)}")

    # Sanitize: strip whitespace, remove blanks, deduplicate while preserving order
    seen = set()
    patent_numbers = []
    for num in raw_numbers:
        cleaned = num.strip()
        if cleaned and cleaned.lower() not in ('nan', 'none', '') and cleaned not in seen:
            seen.add(cleaned)
            patent_numbers.append(cleaned)

    if not patent_numbers:
        raise HTTPException(status_code=400, detail="No valid patent numbers found in the file")

    db_session.total_patents = len(patent_numbers)
    db_session.status = "processing"

    # Pre-populate pending patent records
    for num in patent_numbers:
        patent_record = schemas.PatentData(
            session_id=session_id,
            patent_number=num,
            status="pending"
        )
        db.add(patent_record)

    db.commit()

    # Enqueue patents into session-specific Redis list for Round-Robin execution
    queue_key = f"session_patents:{session_id}"
    redis_client.rpush(queue_key, *patent_numbers)
    redis_client.sadd("active_sessions_set", session_id)

    # Trigger the round-robin dispatcher to schedule tasks across all active sessions
    from ..tasks import dispatch_round_robin_tasks
    dispatch_round_robin_tasks.delay()

    return {
        "message": f"Upload successful. {len(patent_numbers)} patents queued for background processing.",
        "total_patents": len(patent_numbers)
    }

def _delete_session_background(session_id: str):
    """Background task to delete session and halt queue processing."""
    try:
        # Instantly remove from Redis queue so Dispatcher stops feeding Celery
        redis_client.srem("active_sessions_set", session_id)
        redis_client.delete(f"session_patents:{session_id}")
        
        db = next(get_db())
        session = db.query(schemas.Session).filter(schemas.Session.id == session_id).first()
        if session:
            # Cascade delete will remove all patent_data rows automatically
            db.delete(session)
            db.commit()
    except Exception as e:
        print(f"Error in background session deletion: {e}")

@router.delete("/{session_id}", status_code=202)
def delete_session(session_id: str, background_tasks: BackgroundTasks, db: DBSession = Depends(get_db), current_user_id: str = Depends(get_current_user_id)):
    """Instantly halts processing and deletes session in background."""
    db_session = db.query(schemas.Session).filter(
        schemas.Session.id == session_id,
        schemas.Session.owner_id == current_user_id
    ).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    background_tasks.add_task(_delete_session_background, session_id)
    return {"message": "Session deletion accepted and processing in background."}
