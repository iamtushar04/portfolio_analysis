import asyncio
from .database import SessionLocal
from .models import schemas
from .services.kyp import fetch_classifications_batch, filter_patents_batch, trigger_scoring_batch, poll_scoring_task
from .logging_config import logger

async def process_session_kyp_batch_bg(session_id: str, patent_numbers: list[str], auth_token: str = None, kyp_user_id: str = "1"):
    """Background task to fetch KYP classifications, filter, and trigger scoring."""
    logger.info(f"[KYP BG] Starting KYP batch processing for session {session_id} with {len(patent_numbers)} patents")
    
    db = SessionLocal()
    try:
        db_session = db.query(schemas.Session).filter(schemas.Session.id == session_id).first()
        if not db_session:
            logger.info(f"[KYP BG] Session {session_id} deleted. Aborting task.")
            return

        db_session.kyp_status = "processing"
        db.commit()

        # Step 1: Upload and get classifications
        classifications = await fetch_classifications_batch(patent_numbers, user_id=kyp_user_id, auth_token=auth_token)
        # Store classifications mapped by patent number
        classification_map = {}
        all_codes = set()
        for item in classifications:
            p_num = item.get("patent_number")
            code = item.get("code")
            if p_num and code:
                if p_num not in classification_map:
                    classification_map[p_num] = []
                classification_map[p_num].append(item)
                all_codes.add(code)

        # Step 2: Filter patents by classification ids
        filtered_res = await filter_patents_batch(list(all_codes), patent_numbers, user_id=kyp_user_id, auth_token=auth_token)
        filtered_patents = filtered_res.get("patent_numbers", patent_numbers)

        if not filtered_patents:
            logger.warning(f"[KYP BG] Filter returned no patents for session {session_id}")
            db_session.kyp_status = "completed"
            db.commit()
            return

        # Step 3: Trigger Scoring
        task_id = await trigger_scoring_batch(filtered_patents, user_id=kyp_user_id, auth_token=auth_token)
        if not task_id:
            logger.error(f"[KYP BG] Failed to get task_id for session {session_id}")
            db_session.kyp_status = "error"
            db.commit()
            return

        logger.info(f"[KYP BG] Session {session_id} triggered scoring task {task_id}. Polling...")

        # Step 4: Poll Scoring Task
        result_data = await poll_scoring_task(task_id, user_id=kyp_user_id, auth_token=auth_token)
        
        # If result_data is empty (task failed or timed out), we fallback to 0
        if not result_data:
            logger.warning(f"[KYP BG] Polling failed for task {task_id}. Applying fallback score 0 to prevent blocking.")
            weighted_scores = []
        else:
            weighted_scores = result_data.get("result", {}).get("weighted_score", [])
        
        # Create a lookup for fast access
        score_map = {obj.get("patent_number"): obj for obj in weighted_scores}

        # Step 5: Save everything to DB using direct SQL updates to avoid StaleDataError
        for p_num in patent_numbers:
            score_obj = score_map.get(p_num, {})
            classifications = classification_map.get(p_num, [])
            
            # Extract top-level score for sorting (e.g. "48/100" -> 48)
            total_score_str = score_obj.get("total_score", "0/100")
            try:
                kyp_score_val = int(total_score_str.split("/")[0].strip())
            except Exception:
                kyp_score_val = 0
                
            db.query(schemas.PatentData).filter(
                schemas.PatentData.session_id == session_id,
                schemas.PatentData.patent_number == p_num
            ).update({
                schemas.PatentData.kyp_score: kyp_score_val,
                schemas.PatentData.kyp_score_data: score_obj,
                schemas.PatentData.kyp_classifications: classifications
            }, synchronize_session=False)

        db.query(schemas.Session).filter(
            schemas.Session.id == session_id
        ).update({
            schemas.Session.kyp_status: "completed"
        }, synchronize_session=False)
        
        db.commit()
        logger.info(f"[KYP BG] Session {session_id} KYP batch successfully completed and saved using robust updates.")

    except Exception as e:
        logger.error(f"[KYP BG] Unhandled exception in background task for session {session_id}: {e}")
        db.rollback()
        # In a background task, we can update status to error
        try:
            db_session = db.query(schemas.Session).filter(schemas.Session.id == session_id).first()
            if db_session:
                db_session.kyp_status = "error"
                db.commit()
        except Exception:
            pass
    finally:
        db.close()
