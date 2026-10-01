"""
session_assignee_ranker.py
--------------------------
Phase 2 of the two-phase assignee ranking pipeline.

Responsibilities:
  1. Read the Redis accumulator for a session (built during Phase 1).
  2. Deduplicate assignees across all patents in the session.
  3. Determine which taxonomy terms each assignee should be evaluated against
     (controlled by ASSIGNEE_RANKING_TERM_TYPES in config).
  4. Call Perplexity ONCE per unique (assignee, term) combination using the
     existing AssigneeRelevanceCache + _fetch_perplexity_evaluation machinery.
  5. Write results to SessionAssigneeMap table (one row per assignee).
  6. Write back per-patent ranked_forward_assignees from the session map so
     existing frontend / Excel export logic is not broken.
  7. Clean up the Redis accumulator key.

Redis accumulator key schema (JSON stored as a string):
    Key:   "session_assignee_acc:{session_id}"
    Value: JSON string of dict:
    {
      "<assignee_name>": {
        "cited_by":   ["US12345B2", "US67890A1"],   # input patents that cited this assignee
        "topics":     ["5G NR", "Antenna Design"],   # UNION of topics from those patents
        "subtopics":  ["Beam Mgmt", "MIMO"]          # UNION of subtopics from those patents
      },
      ...
    }
"""

from __future__ import annotations

import json
import asyncio
import logging
from typing import Any

from sqlalchemy.orm import Session as DBSession

from ..models import schemas
from ..config import settings
from ..redis_client import redis_client
from .assignee_ranker import (
    _fetch_perplexity_evaluation,
    normalize_assignee_name,
    AssigneeRelevanceCache,
)

logger = logging.getLogger(__name__)

# Redis key prefix for the Phase 1 accumulator
_ACC_KEY_PREFIX = "session_assignee_acc:"

# Minimum Perplexity score to mark an assignee as passing threshold
_PASS_THRESHOLD = 5


# ---------------------------------------------------------------------------
# Redis accumulator helpers  (called from tasks.py Phase 1)
# ---------------------------------------------------------------------------

def redis_accumulate_assignee(
    session_id: str,
    assignee_name: str,
    patent_number: str,
    topics: list[str],
    subtopics: list[str],
) -> None:
    """
    Atomically merge one assignee's data into the Redis accumulator for
    `session_id`. Safe to call concurrently from multiple Celery threads
    because we use a Redis WATCH / pipeline optimistic lock pattern.

    This function is synchronous (called from synchronous Celery task context).
    """
    key = f"{_ACC_KEY_PREFIX}{session_id}"
    max_retries = 5

    for attempt in range(max_retries):
        try:
            with redis_client.pipeline() as pipe:
                pipe.watch(key)
                raw = pipe.get(key)
                acc: dict[str, Any] = json.loads(raw) if raw else {}

                if assignee_name not in acc:
                    acc[assignee_name] = {
                        "cited_by": [],
                        "topics": [],
                        "subtopics": [],
                    }

                entry = acc[assignee_name]

                # Merge cited_by (unique)
                if patent_number not in entry["cited_by"]:
                    entry["cited_by"].append(patent_number)

                # Merge topics (unique)
                for t in topics:
                    if t and t not in entry["topics"]:
                        entry["topics"].append(t)

                # Merge subtopics (unique)
                for s in subtopics:
                    if s and s not in entry["subtopics"]:
                        entry["subtopics"].append(s)

                pipe.multi()
                # TTL: 48 hours — plenty of time for Phase 2 to consume it
                pipe.set(key, json.dumps(acc), ex=172800)
                pipe.execute()
                return  # success

        except Exception as e:
            if attempt < max_retries - 1:
                import time as _time
                _time.sleep(0.05 * (2 ** attempt))  # brief back-off
            else:
                logger.error(
                    f"[SessionAssigneeRanker] Failed to accumulate assignee "
                    f"'{assignee_name}' for session {session_id} after "
                    f"{max_retries} attempts: {e}"
                )


def redis_get_accumulator(session_id: str) -> dict[str, Any]:
    """Read the current accumulator for a session. Returns empty dict if missing."""
    key = f"{_ACC_KEY_PREFIX}{session_id}"
    raw = redis_client.get(key)
    return json.loads(raw) if raw else {}


def redis_delete_accumulator(session_id: str) -> None:
    """Clean up the accumulator after Phase 2 completes."""
    redis_client.delete(f"{_ACC_KEY_PREFIX}{session_id}")


# ---------------------------------------------------------------------------
# Phase 2 main entry point
# ---------------------------------------------------------------------------

async def run_session_assignee_ranking(session_id: str, db: DBSession) -> None:
    """
    Phase 2: Read the Redis accumulator and rank all session assignees
    against Perplexity in one deduplicated batch.

    Called from background_jobs.py after all Phase 1 patents are done.
    """
    logger.info(f"[Phase2] Starting session-level assignee ranking for {session_id}")

    # --- Mark status: processing ---
    _update_session_ranking_status(db, session_id, "processing")

    accumulator = redis_get_accumulator(session_id)
    if not accumulator:
        logger.info(f"[Phase2] No accumulator data found for {session_id}. Marking skipped.")
        _update_session_ranking_status(db, session_id, "skipped")
        return

    term_types = settings.ASSIGNEE_RANKING_TERM_TYPES  # e.g. ["subtopic"]

    # 1. Collect all term requirements.
    # We want a map of: (term_type, term) -> set[assignee_name]
    term_to_assignees: dict[tuple[str, str], set[str]] = {}

    for assignee_name, entry in accumulator.items():
        if "subtopic" in term_types:
            for s in entry.get("subtopics", []):
                if s:
                    term_to_assignees.setdefault(("subtopic", s), set()).add(assignee_name)
        if "topic" in term_types:
            for t in entry.get("topics", []):
                if t:
                    term_to_assignees.setdefault(("topic", t), set()).add(assignee_name)

    semaphore = asyncio.Semaphore(2)  # Limit concurrent Perplexity requests

    # 2. Evaluate all terms concurrently
    tasks = []
    for (term_type, term), assignees in term_to_assignees.items():
        tasks.append(_evaluate_term_for_assignees(
            term_type=term_type,
            term=term,
            assignees=list(assignees),
            semaphore=semaphore,
            db=db,
        ))

    if tasks:
        results = await asyncio.gather(*tasks, return_exceptions=True)
        all_new_records = []
        for r in results:
            if isinstance(r, Exception):
                logger.error(f"[Phase2] Exception in term evaluation task: {r}")
            elif isinstance(r, list):
                all_new_records.extend(r)
                
        if all_new_records and settings.ENABLE_ASSIGNEE_RANKING_CACHE:
            try:
                db.bulk_save_objects(all_new_records)
                db.commit()
            except Exception as e:
                logger.error(f"[Phase2] Exception saving new records to cache: {e}")
                db.rollback()

    # 3. Build SessionAssigneeMap rows from Cache
    _build_session_assignee_maps(db, session_id, accumulator)

    # 4. Write back per-patent ranked_forward_assignees
    _writeback_per_patent(db, session_id, accumulator)

    # --- Clean up Redis ---
    redis_delete_accumulator(session_id)

    _update_session_ranking_status(db, session_id, "completed")
    logger.info(f"[Phase2] Session assignee ranking completed for {session_id}")


# ---------------------------------------------------------------------------
# Term evaluation (called concurrently via gather)
# ---------------------------------------------------------------------------

async def _evaluate_term_for_assignees(
    term_type: str,
    term: str,
    assignees: list[str],
    semaphore: asyncio.Semaphore,
    db: DBSession,
) -> list[AssigneeRelevanceCache]:
    """
    Evaluates a specific term against multiple assignees, utilizing caching and batching.
    """
    if not assignees:
        return []

    # Normalize names
    norm_to_orig = {}
    for a in assignees:
        norm = normalize_assignee_name(a)
        norm_to_orig.setdefault(norm, []).append(a)

    normalized_assignees = list(norm_to_orig.keys())

    # Check cache
    cached_records = []
    if settings.ENABLE_ASSIGNEE_RANKING_CACHE:
        cached_records = db.query(AssigneeRelevanceCache).filter(
            AssigneeRelevanceCache.technology_term == term,
            AssigneeRelevanceCache.term_type == term_type,
            AssigneeRelevanceCache.assignee_name.in_(normalized_assignees)
        ).all()

    cached_names = {r.assignee_name for r in cached_records}
    missing_normalized = [n for n in normalized_assignees if n not in cached_names]

    if missing_normalized:
        logger.info(f"[Phase2] Perplexity call: Term '{term}' ({term_type}) for {len(missing_normalized)} missing assignees.")
        
        BATCH_SIZE = 5
        new_records = []

        for i in range(0, len(missing_normalized), BATCH_SIZE):
            batch = missing_normalized[i:i + BATCH_SIZE]
            api_results = await _fetch_perplexity_evaluation(
                term=term,
                assignees=batch,
                semaphore=semaphore,
            )

            for item in api_results:
                name_from_api = item.get("name", "")
                
                # Match back to our batch
                norm_name = None
                if name_from_api in batch:
                    norm_name = name_from_api
                else:
                    norm_api = normalize_assignee_name(name_from_api)
                    if norm_api in batch:
                        norm_name = norm_api

                if not norm_name:
                    continue

                new_records.append(
                    AssigneeRelevanceCache(
                        assignee_name=norm_name,
                        technology_term=term,
                        term_type=term_type,
                        relevance_score=item.get("relevance_score", 0),
                        reason=item.get("reason", ""),
                        source=item.get("source", "")
                    )
                )

        return new_records
    return []


# ---------------------------------------------------------------------------
# Session map construction
# ---------------------------------------------------------------------------

def _build_session_assignee_maps(db: DBSession, session_id: str, accumulator: dict) -> None:
    """
    After all terms are evaluated and cached, this reads the cache and builds 
    the SessionAssigneeMap rows for the UI/Writeback.
    """
    for assignee_name, entry in accumulator.items():
        normalized = normalize_assignee_name(assignee_name)
        cited_by = entry.get("cited_by", [])
        topics = [t for t in entry.get("topics", []) if t]
        subtopics = [s for s in entry.get("subtopics", []) if s]

        # Fetch cached records for this assignee's terms
        all_terms = topics + subtopics
        cached_records = []
        if all_terms:
            cached_records = db.query(AssigneeRelevanceCache).filter(
                AssigneeRelevanceCache.assignee_name == normalized,
                AssigneeRelevanceCache.technology_term.in_(all_terms)
            ).all()

        perplexity_scores = {}
        for r in cached_records:
            perplexity_scores[r.technology_term] = {
                "score": r.relevance_score,
                "reason": r.reason,
                "source": r.source,
                "term_type": r.term_type,
            }

        topic_scores    = [v["score"] for v in perplexity_scores.values() if v.get("term_type") == "topic"]
        subtopic_scores = [v["score"] for v in perplexity_scores.values() if v.get("term_type") == "subtopic"]

        topic_avg    = (sum(topic_scores) / len(topic_scores)) if topic_scores else None
        subtopic_avg = (sum(subtopic_scores) / len(subtopic_scores)) if subtopic_scores else None

        all_scores = topic_scores + subtopic_scores
        passes = bool(all_scores) and max(all_scores) >= _PASS_THRESHOLD

        existing = db.query(schemas.SessionAssigneeMap).filter(
            schemas.SessionAssigneeMap.session_id == session_id,
            schemas.SessionAssigneeMap.assignee_name == assignee_name,
        ).first()

        if existing:
            existing.perplexity_scores    = perplexity_scores
            existing.cited_by_patents     = cited_by
            existing.topics_collected     = topics
            existing.subtopics_collected  = subtopics
            existing.topic_avg            = topic_avg
            existing.subtopic_avg         = subtopic_avg
            existing.passes_threshold     = passes
        else:
            db.add(schemas.SessionAssigneeMap(
                session_id           = session_id,
                assignee_name        = assignee_name,
                normalized_name      = normalized,
                cited_by_patents     = cited_by,
                topics_collected     = topics,
                subtopics_collected  = subtopics,
                perplexity_scores    = perplexity_scores,
                topic_avg            = topic_avg,
                subtopic_avg         = subtopic_avg,
                passes_threshold     = passes,
            ))

    db.commit()
    logger.info(f"[Phase2] Built session assignee maps for {len(accumulator)} assignees.")


# ---------------------------------------------------------------------------
# Per-patent writeback  (preserves backward compatibility)
# ---------------------------------------------------------------------------

def _writeback_per_patent(
    db: DBSession,
    session_id: str,
    accumulator: dict[str, Any],
) -> None:
    """
    After Phase 2 scoring is done, push ranked_forward_assignees back to
    each PatentData row so the existing frontend / Excel export is unchanged.

    Each patent only gets scores for terms from ITS OWN taxonomy — sliced
    from the session-level scores stored in SessionAssigneeMap.
    """
    # Load all session assignee map rows (already committed above)
    sam_rows = db.query(schemas.SessionAssigneeMap).filter(
        schemas.SessionAssigneeMap.session_id == session_id
    ).all()

    # Build a lookup: assignee_name -> SAM row
    sam_lookup: dict[str, schemas.SessionAssigneeMap] = {
        row.assignee_name: row for row in sam_rows
    }

    # Load all patent records for this session
    patents = db.query(schemas.PatentData).filter(
        schemas.PatentData.session_id == session_id,
        schemas.PatentData.status == "success",
    ).all()

    for patent in patents:
        # Collect which assignees cited this specific patent
        # (any accumulator entry whose cited_by includes this patent_number)
        patent_assignees = [
            name for name, entry in accumulator.items()
            if patent.patent_number in entry.get("cited_by", [])
        ]

        # Get this patent's own taxonomy terms
        patent_topics: set[str] = set()
        patent_subtopics: set[str] = set()
        for tax in (patent.taxonomies or []):
            if tax.get("topic"):    patent_topics.add(tax["topic"])
            if tax.get("subtopic"): patent_subtopics.add(tax["subtopic"])

        ranked: list[dict] = []
        for name in patent_assignees:
            row = sam_lookup.get(name)
            if not row or not row.passes_threshold:
                continue

            scores = row.perplexity_scores or {}

            # Slice only this patent's own terms from the session-level scores
            t_evals = [
                {"term": k, **v}
                for k, v in scores.items()
                if v.get("term_type") == "topic" and k in patent_topics
            ]
            s_evals = [
                {"term": k, **v}
                for k, v in scores.items()
                if v.get("term_type") == "subtopic" and k in patent_subtopics
            ]

            t_scores = [e["score"] for e in t_evals]
            s_scores = [e["score"] for e in s_evals]

            ranked.append({
                "name":          name,
                "topic_avg":     (sum(t_scores) / len(t_scores)) if t_scores else 0,
                "subtopic_avg":  (sum(s_scores) / len(s_scores)) if s_scores else 0,
                "topic_evals":   t_evals,
                "subtopic_evals": s_evals,
            })

        # Sort by subtopic_avg desc (primary), topic_avg desc (secondary)
        ranked.sort(key=lambda x: (x["subtopic_avg"], x["topic_avg"]), reverse=True)
        patent.ranked_forward_assignees = ranked

    db.commit()
    logger.info(f"[Phase2] Writeback complete for {len(patents)} patents in session {session_id}")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _update_session_ranking_status(db: DBSession, session_id: str, status: str) -> None:
    try:
        db.query(schemas.Session).filter(
            schemas.Session.id == session_id
        ).update(
            {schemas.Session.assignee_ranking_status: status},
            synchronize_session=False,
        )
        db.commit()
    except Exception as e:
        logger.error(f"[Phase2] Could not update ranking status for {session_id}: {e}")
        db.rollback()


def _group_by_type(
    terms: list[tuple[str, str]]
) -> list[tuple[str, list[tuple[str, str]]]]:
    """
    Group a list of (term, term_type) tuples by term_type.
    Returns: [("subtopic", [(term, "subtopic"), ...]), ("topic", [...])]
    """
    groups: dict[str, list[tuple[str, str]]] = {}
    for t, tt in terms:
        groups.setdefault(tt, []).append((t, tt))
    return list(groups.items())
