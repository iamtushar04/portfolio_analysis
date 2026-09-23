import asyncio
import httpx
import json
import logging
from typing import List, Dict, Any
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from ...config import settings
from ...redis_client import redis_client
from ...database import SessionLocal
from ...models import schemas
from ..wissen import fetch_wissen_data

logger = logging.getLogger(__name__)


class NetworkError(Exception):
    """Raised only on transient errors worth retrying (network, 5xx)."""
    pass


def _should_retry(exc: BaseException) -> bool:
    """Return True only for network errors or 5xx HTTP responses - NOT 4xx."""
    if isinstance(exc, httpx.RequestError):
        return True
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code >= 500
    return isinstance(exc, NetworkError)


# ── Shared retry decorator for all external agent calls ─────────────────────
_agent_retry = retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=2, min=3, max=30),
    retry=retry_if_exception_type((httpx.RequestError, NetworkError)),
    reraise=True,
)


async def _post_with_retry(client: httpx.AsyncClient, url: str, payload: dict, timeout: float, headers: dict = None) -> dict:
    """Generic POST with smart retry: retries on network errors / 5xx, fails fast on 4xx."""
    _headers = headers or {}
    for attempt in range(1, 6):
        try:
            response = await client.post(url, json=payload, headers=_headers, timeout=timeout)
            if response.status_code >= 500:
                logger.warning(f"[Attempt {attempt}/5] Server error {response.status_code} from {url}. Retrying...")
                await asyncio.sleep(2 ** attempt)
                continue
            response.raise_for_status()  # Raises immediately for 4xx — no retry
            return response.json()
        except httpx.RequestError as e:
            logger.warning(f"[Attempt {attempt}/5] Network error calling {url}: {e}. Retrying...")
            if attempt == 5:
                raise
            await asyncio.sleep(2 ** attempt)

    raise NetworkError(f"All 5 attempts failed for {url}")


async def fetch_novelty_summary(client: httpx.AsyncClient, patent_number: str, auth_token: str) -> str:
    # Correct URL from live API spec: /agents/novelty-agent-new (hyphens!)
    url = f"{settings.AGENT_API_BASE_URL}/agents/novelty-agent-new"
    payload = {"patent_number": patent_number}
    headers = {"Authorization": auth_token} if auth_token else {}
    data = await _post_with_retry(client, url, payload, timeout=None, headers=headers)
    return data.get("novelty_summary", str(data))


async def fetch_key_features(client: httpx.AsyncClient, independent_claims: List[str], description: str) -> List[str]:
    url = f"{settings.WISSEN_AI_API_BASE_URL}/batch_key_feature_breakage"
    payload = {
        "independent_claims": independent_claims,
        "description": description
    }
    data = await _post_with_retry(client, url, payload, timeout=None)
    if isinstance(data, dict) and "key_features_list" in data:
        features = []
        for item in data.get("key_features_list", []):
            features.extend(item.get("keyfeature_list", []))
        return features
    elif isinstance(data, list):
        return data
    return data.get("keyfeature_list", [])


async def fetch_spec_support(client: httpx.AsyncClient, independent_claims: List[str], description: str) -> List[Dict[str, str]]:
    url = f"{settings.WISSEN_AI_API_BASE_URL}/spec_support"
    payload = {
        "keyfeature": independent_claims,
        "description": description
    }
    data = await _post_with_retry(client, url, payload, timeout=None)
    if isinstance(data, dict) and "data" in data:
        return data.get("data", [])
    elif isinstance(data, list):
        return data
    return data.get("spec_support", [])


async def fetch_claim_chart(client: httpx.AsyncClient, payload: dict, auth_token: str, user_id: str) -> dict:
    # Correct URL from live API spec: /agents/claim-chart-agent-beta (hyphens!)
    url = f"{settings.AGENT_API_BASE_URL}/agents/claim-chart-agent-beta"
    headers = {"Authorization": auth_token, "User-ID": str(user_id)} if auth_token else {"User-ID": str(user_id)}
    # Wait indefinitely
    return await _post_with_retry(client, url, payload, timeout=None, headers=headers)


async def generate_claim_chart_background(
    job_id: str,
    patent_number: str,
    assignees: List[str],
    products: List[Dict[str, Any]],
    cached_products: List[Dict[str, Any]],
    custom_instructions: str,
    auth_token: str = None,
    user_id: str = "1"
):
    try:
        # 1. Update initial status
        redis_client.set(f"claim_chart_job:{job_id}", json.dumps({
            "status": "processing",
            "message": "Fetching patent data from Wissen..."
        }), ex=86400)

        # 2. Fetch Prerequisite Data from Wissen
        wissen_data = await fetch_wissen_data(patent_number)
        independent_claims = wissen_data.get("independent_claims", [])
        if not independent_claims:
            raw_claims = wissen_data.get("claims", "")
            independent_claims = [raw_claims] if raw_claims else []

        description = wissen_data.get("description", wissen_data.get("abstract", ""))
        priority_date = wissen_data.get("priority_date", "")

        # Override assignees if frontend sent default/empty
        if not assignees or assignees == ["Unknown"]:
            fetched_assignees = wissen_data.get("assignees")
            if fetched_assignees and isinstance(fetched_assignees, list):
                assignees = fetched_assignees
            elif fetched_assignees and isinstance(fetched_assignees, str):
                assignees = [fetched_assignees]

        logger.info(f"[{job_id}] Wissen data fetched for {patent_number}. Claims: {len(independent_claims)}, Priority: {priority_date}, Assignees: {assignees}")

        redis_client.set(f"claim_chart_job:{job_id}", json.dumps({
            "status": "processing",
            "message": "Running AI Agents in parallel (Novelty, Key Features, Spec Support)..."
        }), ex=86400)

        # 3. Fire parallel sub-agent requests
        async with httpx.AsyncClient() as client:
            novelty_task = asyncio.create_task(fetch_novelty_summary(client, patent_number, auth_token))
            key_feature_task = asyncio.create_task(fetch_key_features(client, independent_claims, description))
            spec_support_task = asyncio.create_task(fetch_spec_support(client, independent_claims, description))

            novelty_summary, keyfeature_list, spec_support = await asyncio.gather(
                novelty_task, key_feature_task, spec_support_task
            )

            logger.info(f"[{job_id}] Parallel agents completed. Building final payload...")

            # 4. Construct final payload
            final_payload = {
                "infringed_models": {
                    "patent_number": patent_number,
                    "assignees": assignees,
                    "priority_date": priority_date,
                    "novelty_summary": novelty_summary,
                    "keyfeature_list": keyfeature_list,
                    "products": products,
                    "spec_support": spec_support,
                    "custom_instructions": custom_instructions or "",
                    "infringement_history_id": 0
                },
                "workspace_id": 0
            }

            logger.info(f"[{job_id}] Final Claim Chart Payload:\n{json.dumps(final_payload, indent=2)}")

            redis_client.set(f"claim_chart_job:{job_id}", json.dumps({
                "status": "processing",
                "message": "Generating Claim Chart (this may take 5-6 minutes)..."
            }), ex=86400)

            # 5. Call final Claim Chart Agent (900s timeout, retries on 5xx)
            final_result = await fetch_claim_chart(client, final_payload, auth_token, user_id)

            logger.info(f"[{job_id}] Claim chart completed for {patent_number}.")
            
            # 5a. Save to Cache
            db = SessionLocal()
            try:
                for prod_res in final_result.get("products_analysis", []):
                    cache_entry = schemas.ClaimChartCache(
                        patent_number=patent_number,
                        company=prod_res.get("company", ""),
                        model=prod_res.get("model", ""),
                        result_data=prod_res
                    )
                    db.add(cache_entry)
                db.commit()
            except Exception as e:
                logger.error(f"[{job_id}] Failed to save claim charts to cache: {e}")
                db.rollback()
            finally:
                db.close()
            
            # 5b. Merge with cached products
            if cached_products:
                final_result["products_analysis"] = final_result.get("products_analysis", []) + cached_products

            # 6. Save Success Result
            redis_client.set(f"claim_chart_job:{job_id}", json.dumps({
                "status": "completed",
                "result": final_result
            }), ex=86400)

    except Exception as e:
        import traceback
        traceback.print_exc()
        logger.error(f"[{job_id}] Claim chart generation failed: {e}")
        redis_client.set(f"claim_chart_job:{job_id}", json.dumps({
            "status": "error",
            "error_message": str(e)
        }), ex=86400)
