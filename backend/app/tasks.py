import asyncio
import re
import logging
import time
from datetime import datetime, timedelta
# pyrefly: ignore [missing-import]
from celery import shared_task
# pyrefly: ignore [missing-import]
from celery.exceptions import SoftTimeLimitExceeded

from .celery_app import celery_app
from .database import SessionLocal
from .models import schemas
from .services.wissen import fetch_wissen_data
from .services.taxonomy import classify_patent
from .services.sparta import fetch_sparta_data
from .services.competitor import fetch_competitor_data
from .services.assignee_ranker import rank_assignees_dual_layer
from .redis_client import redis_client
from .config import settings
from .logging_config import logger, correlation_id_ctx


@celery_app.task(name="app.tasks.dispatch_round_robin_tasks")
def dispatch_round_robin_tasks():
    """
    Round-Robin Dispatcher:
    Loops through all active sessions and dispatches 1 patent per session into the worker pool.
    Repeats until all pending patents for all active sessions are queued for processing.
    Ensures true multi-user fairness regardless of session size.
    """
    # Set correlation id for dispatcher
    correlation_id_ctx.set("dispatcher")
    
    active_sessions = list(redis_client.smembers("active_sessions_set"))
    if not active_sessions:
        return "No active sessions to dispatch."

    dispatched_count = 0
    sessions_to_remove = []

    # Round-Robin loop through all active sessions
    for session_id in active_sessions:
        queue_key = f"session_patents:{session_id}"
        patent_number = redis_client.lpop(queue_key)

        if patent_number:
            process_patent_task.delay(session_id, patent_number)
            dispatched_count += 1
        else:
            # Queue is empty for this session
            sessions_to_remove.append(session_id)

    # Clean up completed sessions from active set
    if sessions_to_remove:
        redis_client.srem("active_sessions_set", *sessions_to_remove)

    # If there are still active sessions with remaining patents, queue another dispatch pass
    remaining_active = list(redis_client.smembers("active_sessions_set"))
    if remaining_active:
        dispatch_round_robin_tasks.delay()

    return f"Dispatched {dispatched_count} tasks across {len(active_sessions)} sessions."


@celery_app.task(
    bind=True,
    name="app.tasks.process_patent_task",
    max_retries=3,
    acks_late=True,
    reject_on_worker_lost=True,
)
def process_patent_task(self, session_id: str, patent_number: str):
    """
    Celery task — one task per patent, runs independently.
    Multiple users' patents run simultaneously in the shared worker pool.
    Each task gets its own DB connection (no shared state / connection exhaustion).
    """
    # Set the correlation ID for this entire celery task to match the session
    correlation_id_ctx.set(f"session-{session_id[:8]}")
    
    try:
        # asyncio.run() is the correct, Python 3.12-approved way to run async code
        # from a synchronous Celery task. It:
        #   1. Creates a fresh event loop for this task
        #   2. Runs the coroutine to completion
        #   3. Cancels ALL pending background tasks (e.g. httpx connection cleanup)
        #   4. Shuts down async generators
        #   5. Closes the loop cleanly
        # This eliminates both "Event loop is closed" and "bound to different event loop" errors.
        asyncio.run(_process_patent_async(session_id, patent_number))

    except SoftTimeLimitExceeded:
        # Task exceeded 10 minute soft limit — mark failed cleanly
        logger.warning(f"Patent {patent_number} hit soft time limit — marking as failed.")
        _mark_patent_failed(session_id, patent_number, "Processing timed out after 10 minutes")
    except Exception as exc:
        logger.error(f"Patent {patent_number} failed on attempt {self.request.retries + 1}: {exc}")
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=2 ** self.request.retries)  # exponential backoff: 1s, 2s, 4s
        else:
            _mark_patent_failed(session_id, patent_number, str(exc))


async def _process_patent_async(session_id: str, patent_number: str):
    """Core async patent processing logic — identical to worker.py but with own DB session."""
    logger.info(f"[{session_id}] Starting processing for patent {patent_number}")
    overall_start = time.perf_counter()
    
    db = SessionLocal()
    try:
        # 0. Check if session was deleted (abort if true)
        session_record = db.query(schemas.Session).filter(schemas.Session.id == session_id).first()
        if not session_record:
            logger.info(f"Session {session_id} deleted. Aborting task for patent {patent_number}.")
            return

        # Skip if already successfully processed (idempotent — safe to re-run)
        patent_record = db.query(schemas.PatentData).filter(
            schemas.PatentData.session_id == session_id,
            schemas.PatentData.patent_number == patent_number
        ).first()

        if patent_record and patent_record.status == "success":
            logger.info(f"Patent {patent_number} already processed — skipping.")
            _check_session_completion(db, session_id)
            return

        # 0.5. Global Cache Lookup (Data Deduplication)
        if settings.ENABLE_PATENT_CACHE:
            query = db.query(schemas.PatentData).filter(
                schemas.PatentData.patent_number == patent_number,
                schemas.PatentData.status == "success"
            )
            
            if settings.CACHE_EXPIRY_DAYS > 0:
                expiry_date = datetime.utcnow() - timedelta(days=settings.CACHE_EXPIRY_DAYS)
                # We don't have a specific updated_at field, but we can assume if it's in the DB, it's valid.
                # If we had updated_at, we'd do: query = query.filter(schemas.PatentData.updated_at >= expiry_date)
                pass # Currently using permanent cache if >0 is set but no timestamp field exists. To do properly we'd add updated_at. Let's just use it without time filtering for now or use session created_at if we join, but simple is better.

            cached_record = query.order_by(schemas.PatentData.id.desc()).first()

            if cached_record and patent_record:
                logger.info(f"Patent {patent_number} found in Global Cache. Instantly duplicating data.")
                patent_record.title = cached_record.title
                patent_record.assignees = cached_record.assignees
                patent_record.abstract = cached_record.abstract
                patent_record.claims = cached_record.claims
                patent_record.forward_citations = cached_record.forward_citations
                patent_record.backward_citations = cached_record.backward_citations
                patent_record.taxonomies = cached_record.taxonomies
                patent_record.standard = cached_record.standard
                patent_record.standard_links = cached_record.standard_links
                patent_record.competitors = cached_record.competitors
                patent_record.forward_competitors = cached_record.forward_competitors
                patent_record.backward_competitors = cached_record.backward_competitors
                patent_record.ranked_forward_assignees = cached_record.ranked_forward_assignees
                patent_record.status = "success"
                patent_record.error_message = None
                db.commit()
                _check_session_completion(db, session_id)
                return

        # 1. Fetch Wissen data (3 retries built-in)
        wissen_start = time.perf_counter()
        wissen_data = await fetch_wissen_data(patent_number)
        wissen_duration = time.perf_counter() - wissen_start
        logger.info(f"[{session_id}] Patent {patent_number} - Fetched Wissen data in {wissen_duration:.2f}s")
        
        if not wissen_data:
            raise ValueError(f"Wissen API returned empty data for {patent_number}")

        # 2. Extract fields
        abstract = wissen_data.get("abstract", "")
        claims = wissen_data.get("claims", "")
        # Truncate claims to 2000 chars to avoid OpenAI token overflow on large patents
        claims_truncated = claims[:2000] if claims else ""
        cpc_list = [c.get("code") for c in wissen_data.get("classifications", []) if c.get("code")]

        raw_assignees = wissen_data.get("assignees", [])
        if not raw_assignees and wissen_data.get("assignee"):
            raw_assignees = [wissen_data.get("assignee")]
        assignees_list = [a for a in raw_assignees if a and str(a).strip()]

        # 3. Taxonomy classification with Langfuse observability & cost tracking (3 retries built-in)
        taxonomy_start = time.perf_counter()
        taxonomy_data = await classify_patent(cpc_list, abstract, claims_truncated, patent_number=patent_number, session_id=session_id)
        taxonomy_duration = time.perf_counter() - taxonomy_start
        logger.info(f"[{session_id}] Patent {patent_number} - Taxonomy classified in {taxonomy_duration:.2f}s")

        # 4. Sparta standard mapping (3 retries built-in, strip kind code)
        match = re.match(r"^([A-Z]{2}\d+)", patent_number)
        no_kind_code = match.group(1) if match else patent_number
        sparta_start = time.perf_counter()
        sparta_data = await fetch_sparta_data(no_kind_code)
        sparta_duration = time.perf_counter() - sparta_start
        logger.info(f"[{session_id}] Patent {patent_number} - Sparta standards fetched in {sparta_duration:.2f}s")

        # 5. Competitor search for Forward and Backward Citation Assignees
        fwd_citations = wissen_data.get("forward_citations_deduped", [])
        bwd_citations = wissen_data.get("backward_citations_deduped", [])

        fwd_assignees_set = set()
        for c in fwd_citations:
            # Handle both 'assignees' (list) and 'assignee' (string) field formats
            raw = c.get("assignees") or ([c.get("assignee")] if c.get("assignee") else [])
            for a in raw:
                cleaned_a = str(a).strip()
                if cleaned_a and cleaned_a.lower() not in ("unknown", "nan", ""):
                    fwd_assignees_set.add(cleaned_a)

        bwd_assignees_set = set()
        for c in bwd_citations:
            # Handle both 'assignees' (list) and 'assignee' (string) field formats
            raw = c.get("assignees") or ([c.get("assignee")] if c.get("assignee") else [])
            for a in raw:
                cleaned_a = str(a).strip()
                if cleaned_a and cleaned_a.lower() not in ("unknown", "nan", ""):
                    bwd_assignees_set.add(cleaned_a)

        # 5a. Rank Forward Assignees based on Topic/Subtopic FIRST
        ranked_forward_assignees = None
        top_fwd_assignees = list(fwd_assignees_set)
        try:
            topics_set = set()
            subtopics_set = set()
            for tax in (taxonomy_data or []):
                if tax.get("topic"): topics_set.add(tax.get("topic"))
                if tax.get("subtopic"): subtopics_set.add(tax.get("subtopic"))
            
            if (topics_set or subtopics_set) and fwd_assignees_set:
                rank_start = time.perf_counter()
                raw_ranked = await rank_assignees_dual_layer(list(topics_set), list(subtopics_set), list(fwd_assignees_set), db)
                
                # Keep if any score >= 5
                ranked_forward_assignees = []
                for r in raw_ranked:
                    max_score = 0
                    for e in r.get("topic_evals", []) + r.get("subtopic_evals", []):
                        if e.get("score", 0) > max_score: max_score = e.get("score", 0)
                    if max_score >= 5:
                        ranked_forward_assignees.append(r)
                top_fwd_assignees = [r["name"] for r in ranked_forward_assignees]
                rank_duration = time.perf_counter() - rank_start
                logger.info(f"[{session_id}] Patent {patent_number} - Assignees ranked in {rank_duration:.2f}s")
        except Exception as e:
            logger.warning(f"[{session_id}] Patent {patent_number} - Assignee ranking failed (non-critical): {e}")

        # 5b. Run Competitor API for Ranked Forward Assignees
        comp_start = time.perf_counter()
        fwd_comp_res = await fetch_competitor_data(patent_number, top_fwd_assignees, label="Forward")
        comp_duration = time.perf_counter() - comp_start
        logger.info(f"[{session_id}] Patent {patent_number} - Competitors fetched in {comp_duration:.2f}s")

        fwd_competitors = fwd_comp_res.get("competitors", [])
        bwd_competitors = []

        # 6. Save to DB
        if patent_record:
            patent_record.title = wissen_data.get("title")
            patent_record.assignees = assignees_list
            patent_record.abstract = abstract
            patent_record.claims = claims
            patent_record.forward_citations = fwd_citations
            patent_record.backward_citations = bwd_citations
            patent_record.taxonomies = taxonomy_data
            patent_record.standard = sparta_data.get("standard")
            patent_record.standard_links = sparta_data.get("standard_links")
            patent_record.competitors = []
            patent_record.forward_competitors = fwd_competitors
            patent_record.backward_competitors = bwd_competitors
            patent_record.ranked_forward_assignees = ranked_forward_assignees
            patent_record.status = "success"
            patent_record.error_message = None
            db.commit()
            
            total_duration = time.perf_counter() - overall_start
            logger.info(f"[{session_id}] Patent {patent_number} FULLY processed successfully in {total_duration:.2f}s.")
            
            # Check if this was the last patent to process
            _check_session_completion(db, session_id)

    except Exception as e:
        db.rollback()
        raise  # Let Celery task handle retry/failure
    finally:
        db.close()


def _check_session_completion(db, session_id: str):
    """Check if all patents for a session are processed (success or failed) and mark complete."""
    try:
        db_session = db.query(schemas.Session).filter(schemas.Session.id == session_id).first()
        if not db_session or db_session.status == "completed":
            return
            
        # Dynamically count processed patents
        processed_count = db.query(schemas.PatentData).filter(
            schemas.PatentData.session_id == session_id,
            schemas.PatentData.status.in_(["success", "failed"])
        ).count()
        
        if processed_count >= db_session.total_patents and db_session.total_patents > 0:
            db_session.status = "completed"
            db.commit()
            
    except Exception as e:
        logger.error(f"Error checking session completion for {session_id}: {e}")
        db.rollback()


def _mark_patent_failed(session_id: str, patent_number: str, error_msg: str):
    """Mark a single patent as failed and update session counter."""
    db = SessionLocal()
    try:
        patent_record = db.query(schemas.PatentData).filter(
            schemas.PatentData.session_id == session_id,
            schemas.PatentData.patent_number == patent_number
        ).first()
        if patent_record:
            patent_record.status = "failed"
            patent_record.error_message = error_msg
            db.commit()
        _check_session_completion(db, session_id)
    except Exception as e:
        logger.error(f"Error marking patent {patent_number} failed: {e}")
    finally:
        db.close()
