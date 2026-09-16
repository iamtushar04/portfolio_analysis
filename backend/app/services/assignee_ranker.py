import json
import logging
import asyncio
import httpx
import re
from sqlalchemy.orm import Session
from ..models.schemas import AssigneeRelevanceCache
from ..config import settings
from langfuse import observe

logger = logging.getLogger(__name__)

@observe(name="Assignee Ranker (Perplexity)", as_type="generation")
async def _fetch_perplexity_evaluation(term: str, assignees: list[str], semaphore: asyncio.Semaphore) -> list[dict]:
    """
    Calls Perplexity API to evaluate a list of assignees against a specific technology term.
    """
    if not settings.PERPLEXITY_API_KEY:
        logger.warning("PERPLEXITY_API_KEY not set. Cannot run assignee ranking.")
        return []

    prompt = (
        "You are a Market Intelligence Analyst. I will provide a technology area (either a Topic or Subtopic) and a list of companies. "
        "Evaluate how actively involved EACH company is in that technology area specifically.\n\n"
        "EVIDENCE RULES:\n"
        "1. Do NOT use patent filings as evidence.\n"
        "2. Search for real-world commercial signals: products/services, official website content, press releases/news, tech blogs/papers, job postings, or acquisitions.\n"
        "3. Prioritize evidence from the last 2-3 years. If older, score conservatively.\n"
        "4. If a company name is a subsidiary, try to resolve it to the parent brand.\n\n"
        "SCORING (1-10):\n"
        "1-2: no evidence found for this technology\n"
        "3-4: only passing/adjacent mentions, not this specific technology\n"
        "5-6: some products or content, but not a core focus\n"
        "7-8: dedicated product line or repeated press coverage\n"
        "9-10: this technology is a core, current business focus\n\n"
        "If no evidence is found, give score 1-2 and set 'source' to null. Do not guess or fabricate a URL.\n\n"
        "Return ONLY a JSON array of objects, one for each company provided. No markdown, no code fences.\n"
        "[\n"
        "  {\n"
        "    \"name\": \"<exact input name>\",\n"
        "    \"relevance_score\": <integer 1-10>,\n"
        "    \"reason\": \"<1 sentence starting with company name, optionally noting evidence date>\",\n"
        "    \"source\": \"<URL or null>\"\n"
        "  }\n"
        "]"
    )

    user_content = (
        f"Technology Area: '{term}'\n\n"
        f"Companies to evaluate:\n{json.dumps(assignees)}"
    )

    headers = {
        "Authorization": f"Bearer {settings.PERPLEXITY_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }

    payload = {
        "model": "sonar",
        "messages": [
            {"role": "system", "content": prompt},
            {"role": "user", "content": user_content}
        ],
        "temperature": 0.1
    }

    async with semaphore:
        async with httpx.AsyncClient() as client:
            # Implement basic exponential backoff
            for attempt in range(1, 4):
                try:
                    response = await client.post(
                        "https://api.perplexity.ai/chat/completions",
                        headers=headers,
                        json=payload,
                        timeout=60.0
                    )
                    response.raise_for_status()
                    data = response.json()
                    
                    content = data["choices"][0]["message"]["content"]
                    
                    # Strip potential markdown code blocks
                    if content.startswith("```json"):
                        content = content[7:]
                    if content.startswith("```"):
                        content = content[3:]
                    if content.endswith("```"):
                        content = content[:-3]
                        
                    results = json.loads(content.strip())
                    return results
                except Exception as e:
                    logger.error(f"Perplexity API attempt {attempt} failed for term '{term}': {e}")
                    if attempt < 3:
                        await asyncio.sleep(2 ** attempt)
    return []


def normalize_assignee_name(name: str) -> str:
    """
    Normalizes company names to increase cache hits by removing punctuation,
    common corporate suffixes, and excess whitespace.
    """
    if not name:
        return ""
    
    # Lowercase
    norm = name.lower()
    
    # Remove punctuation
    norm = re.sub(r'[.,;\'"-]', ' ', norm)
    
    # Remove common corporate suffixes with word boundaries
    suffixes = r'\b(inc|incorporated|corp|corporation|co|company|ltd|limited|llc|gmbh)\b'
    norm = re.sub(suffixes, '', norm)
    
    # Remove extra whitespace
    norm = re.sub(r'\s+', ' ', norm).strip()
    
    return norm if norm else name.lower()


async def evaluate_assignees_for_term(term: str, term_type: str, assignees: list[str], db: Session, semaphore: asyncio.Semaphore) -> dict:
    """
    Evaluates assignees for a specific term, checking cache first.
    Returns { "OriginalAssigneeName": {"score": X, "reason": "...", "source": "..."} }
    """
    if not term or not assignees:
        return {}

    # 0. Normalize names and create a mapping back to the original
    norm_to_orig = {}
    for a in assignees:
        norm = normalize_assignee_name(a)
        if norm not in norm_to_orig:
            norm_to_orig[norm] = []
        norm_to_orig[norm].append(a)
        
    normalized_assignees = list(norm_to_orig.keys())

    # 1. Check Cache using normalized names
    cached_records = []
    if settings.ENABLE_ASSIGNEE_RANKING_CACHE:
        cached_records = db.query(AssigneeRelevanceCache).filter(
            AssigneeRelevanceCache.technology_term == term,
            AssigneeRelevanceCache.term_type == term_type,
            AssigneeRelevanceCache.assignee_name.in_(normalized_assignees)
        ).all()

    results_map = {}
    cached_names = set()

    for record in cached_records:
        cached_names.add(record.assignee_name)
        # Map back to all original names that share this normalized name
        for orig_name in norm_to_orig.get(record.assignee_name, []):
            results_map[orig_name] = {
                "score": record.relevance_score,
                "reason": record.reason,
                "source": record.source
            }

    # 2. Identify missing normalized ones
    missing_normalized = [n for n in normalized_assignees if n not in cached_names]

    # 3. Call API for missing ones
    if missing_normalized:
        logger.info(f"Evaluating {len(missing_normalized)} normalized assignees for {term_type}: '{term}'")
        # Batching logic: Chunk assignees to avoid cross-contamination and token limits.
        BATCH_SIZE = 10
        new_records = []
        
        for i in range(0, len(missing_normalized), BATCH_SIZE):
            batch = missing_normalized[i:i + BATCH_SIZE]
            api_results = await _fetch_perplexity_evaluation(term, batch, semaphore)
            
            for item in api_results:
                name_from_api = item.get("name", "")
                
                # Match API response back to our batch (fallback to re-normalize if API altered it)
                norm_name = None
                if name_from_api in batch:
                    norm_name = name_from_api
                else:
                    norm_api = normalize_assignee_name(name_from_api)
                    if norm_api in batch:
                        norm_name = norm_api
                        
                if not norm_name:
                    continue
                    
                # Save to results_map for all original names
                for orig_name in norm_to_orig.get(norm_name, []):
                    results_map[orig_name] = {
                        "score": item.get("relevance_score", 0),
                        "reason": item.get("reason", ""),
                        "source": item.get("source", "")
                    }
                    
                # Create DB model (store the NORMALIZED name in cache)
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
        
        # 4. Save to cache
        if new_records and settings.ENABLE_ASSIGNEE_RANKING_CACHE:
            db.bulk_save_objects(new_records)
            db.commit()

    return results_map


async def rank_assignees_dual_layer(topics: list[str], subtopics: list[str], assignees: list[str], db: Session) -> list[dict]:
    """
    Evaluates list of assignees against all Topics and Subtopics concurrently.
    """
    if not assignees:
        return []

    tasks = []
    valid_topics = [t for t in topics if t]
    valid_subtopics = [s for s in subtopics if s]
    
    # Create the semaphore in the current running event loop natively
    semaphore = asyncio.Semaphore(2)
    
    for t in valid_topics:
        tasks.append(evaluate_assignees_for_term(t, "topic", assignees, db, semaphore))
    for s in valid_subtopics:
        tasks.append(evaluate_assignees_for_term(s, "subtopic", assignees, db, semaphore))
        
    results = await asyncio.gather(*tasks) if tasks else []
    
    topic_results = results[:len(valid_topics)]
    subtopic_results = results[len(valid_topics):]

    final_list = []
    for a in assignees:
        t_evals = []
        for i, t in enumerate(valid_topics):
            eval_map = topic_results[i] if isinstance(topic_results[i], dict) else {}
            eval_data = eval_map.get(a, {"score": 0, "reason": "No data", "source": ""})
            t_evals.append({**eval_data, "term": t})
            
        s_evals = []
        for i, s in enumerate(valid_subtopics):
            eval_map = subtopic_results[i] if isinstance(subtopic_results[i], dict) else {}
            eval_data = eval_map.get(a, {"score": 0, "reason": "No data", "source": ""})
            s_evals.append({**eval_data, "term": s})
            
        t_scores = [e.get("score", 0) for e in t_evals]
        s_scores = [e.get("score", 0) for e in s_evals]
        topic_avg = (sum(t_scores) / len(t_scores)) if t_scores else 0
        subtopic_avg = (sum(s_scores) / len(s_scores)) if s_scores else 0

        final_list.append({
            "name": a,
            "topic_avg": topic_avg,
            "subtopic_avg": subtopic_avg,
            "topic_evals": t_evals,
            "subtopic_evals": s_evals
        })
        
    # Sort by topic average score by default
    final_list.sort(key=lambda x: x["topic_avg"], reverse=True)
    return final_list
