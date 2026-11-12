from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session as DBSession
from typing import List, Optional
from pydantic import BaseModel
import io

from ..database import get_db
from ..services.excel_export import generate_session_excel
from ..auth.dependencies import get_current_user_id
from .sessions import get_session

router = APIRouter(tags=["exports"])


class CustomExportRequest(BaseModel):
    patent_ids: Optional[List[str]] = None
    patent_numbers: Optional[List[str]] = None
    sort_by: Optional[str] = "subtopic"


@router.get("/{session_id}/export")
def export_session_excel(
    session_id: str, 
    translate: bool = False,
    sort_by: Optional[str] = "subtopic",
    db: DBSession = Depends(get_db), 
    current_user_id: str = Depends(get_current_user_id)
):
    session_data = get_session(session_id, db, current_user_id)
    excel_bytes = generate_session_excel(
        session_data,
        db=db,
        translate=translate,
        sort_by=sort_by
    )
    safe_name = "".join(
        c for c in session_data.get("name", "session") if c.isalnum() or c in (" ", "_", "-")
    ).strip().replace(" ", "_")
    filename = f"{safe_name}_{session_id[:8]}.xlsx"
    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/{session_id}/export_custom")
def export_session_excel_custom(
    session_id: str, 
    payload: CustomExportRequest,
    translate: bool = False,
    db: DBSession = Depends(get_db), 
    current_user_id: str = Depends(get_current_user_id)
):
    target_ids = payload.patent_ids or payload.patent_numbers
    if not target_ids:
        raise HTTPException(status_code=400, detail="No patent numbers provided for export")

    session_data = get_session(session_id, db, current_user_id)
    excel_bytes = generate_session_excel(
        session_data, 
        db=db, 
        translate=translate, 
        patent_ids=target_ids, 
        sort_by=payload.sort_by
    )
    safe_name = "".join(
        c for c in session_data.get("name", "session") if c.isalnum() or c in (" ", "_", "-")
    ).strip().replace(" ", "_")
    filename = f"{safe_name}_{session_id[:8]}_custom.xlsx"
    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

