from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session as DBSession
from typing import List
import uuid
import pandas as pd
import io

from ..database import get_db
from ..models import schemas
from ..services.worker import process_patents_background
from ..services.excel_export import generate_session_excel

router = APIRouter()

@router.post("/", response_model=dict)
def create_session(name: str = "New Session", db: DBSession = Depends(get_db)):
    session_id = str(uuid.uuid4())
    db_session = schemas.Session(id=session_id, name=name, status="pending")
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return {"id": db_session.id, "name": db_session.name, "status": db_session.status}

@router.get("/", response_model=List[dict])
def list_sessions(db: DBSession = Depends(get_db)):
    sessions = db.query(schemas.Session).order_by(schemas.Session.created_at.desc()).all()
    return [{"id": s.id, "name": s.name, "status": s.status, "total_patents": s.total_patents, "processed_patents": s.processed_patents, "created_at": s.created_at} for s in sessions]

@router.get("/{session_id}", response_model=dict)
def get_session(session_id: str, db: DBSession = Depends(get_db)):
    db_session = db.query(schemas.Session).filter(schemas.Session.id == session_id).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    patents = db.query(schemas.PatentData).filter(schemas.PatentData.session_id == session_id).all()
    
    return {
        "id": db_session.id,
        "name": db_session.name,
        "status": db_session.status,
        "total_patents": db_session.total_patents,
        "processed_patents": db_session.processed_patents,
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
                "standard": p.standard,
                "standard_links": p.standard_links,
                "error_message": p.error_message
            } for p in patents
        ]
    }

@router.get("/{session_id}/export")
def export_session_excel(session_id: str, db: DBSession = Depends(get_db)):
    session_data = get_session(session_id, db)
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
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...), 
    db: DBSession = Depends(get_db)
):
    db_session = db.query(schemas.Session).filter(schemas.Session.id == session_id).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files are supported")
        
    contents = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(contents))
        # Find the first column that looks like patent numbers, or just assume the first column
        patent_col = df.columns[0]
        patent_numbers = df[patent_col].dropna().astype(str).tolist()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading Excel file: {str(e)}")
        
    if not patent_numbers:
        raise HTTPException(status_code=400, detail="No patent numbers found in the file")
        
    db_session.total_patents = len(patent_numbers)
    db_session.status = "processing"
    
    # Pre-populate pending patent records
    for num in patent_numbers:
        patent_record = schemas.PatentData(
            session_id=session_id,
            patent_number=num.strip(),
            status="pending"
        )
        db.add(patent_record)
        
    db.commit()
    
    # Start background processing
    background_tasks.add_task(process_patents_background, session_id, patent_numbers)
    
    return {"message": "Upload successful. Processing started in background.", "total_patents": len(patent_numbers)}
