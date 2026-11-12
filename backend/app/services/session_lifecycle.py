from sqlalchemy.orm import Session as DBSession
from ..models import schemas
from ..logging_config import logger


def check_and_update_session_completion(db: DBSession, session_id: str) -> bool:
    """
    Canonical, idempotent state machine check to transition a session to 'completed'.

    A session is completed when:
    1. All patents are in a terminal state ('success' or 'failed') and total_patents > 0
    2. KYP processing is in a terminal state (kyp_status in ['completed', 'error'])
    3. Assignee ranking is in a terminal state (assignee_ranking_status in ['completed', 'error', 'skipped'])

    If all conditions are met and session is 'processing', marks session.status = 'completed'.
    Safe to call concurrently from patent workers, KYP background jobs, ranking tasks, or API endpoints.
    Returns True if the session is (or was transitioned to) 'completed'.
    """
    try:
        db_session = db.query(schemas.Session).filter(schemas.Session.id == session_id).first()
        if not db_session:
            return False

        if db_session.status == "completed":
            return True

        if not db_session.total_patents or db_session.total_patents <= 0:
            return False

        # Count completed patents (either success or failed)
        processed_count = db.query(schemas.PatentData).filter(
            schemas.PatentData.session_id == session_id,
            schemas.PatentData.status.in_(["success", "failed"])
        ).count()

        all_patents_done = processed_count >= db_session.total_patents
        if not all_patents_done:
            return False

        kyp_done = db_session.kyp_status in ["completed", "error"]
        ranking_status = getattr(db_session, "assignee_ranking_status", "completed")
        ranking_done = ranking_status in ["completed", "error", "skipped"]

        if all_patents_done and kyp_done and ranking_done:
            db_session.status = "completed"
            db.commit()
            logger.info(
                f"[{session_id}] All pipelines finished (patents={processed_count}/{db_session.total_patents}, "
                f"kyp={db_session.kyp_status}, ranking={ranking_status}). Session status updated to 'completed'."
            )
            return True

        return False
    except Exception as e:
        logger.error(f"Error checking session completion for {session_id}: {e}")
        try:
            db.rollback()
        except Exception:
            pass
        return False

