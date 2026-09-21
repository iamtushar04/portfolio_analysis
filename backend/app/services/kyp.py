import httpx
import asyncio
# pyrefly: ignore [missing-import]
from jose import jwt
from typing import List, Dict, Any
from ..logging_config import logger
from ..config import settings

KYP_BASE_URL = settings.KYP_BASE_URL

async def fetch_classifications_batch(patents: List[str], user_id: str = "1", auth_token: str = None) -> List[Dict[str, Any]]:
    """Fetch classifications for a batch of patents."""
    url = f"{KYP_BASE_URL}/upload_and_get_classifications"
    payload = {"patents": patents}
    headers = {"user-id": user_id}
    if auth_token:
        headers["Authorization"] = auth_token
    
    try:
        # timeout=None means the request will wait as long as the KYP server needs to respond
        async with httpx.AsyncClient(timeout=None) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            return response.json()
    except Exception as e:
        logger.error(f"[KYP] Error fetching classifications for {len(patents)} patents: {e}")
        return []

async def filter_patents_batch(codes: List[str], patents: List[str], user_id: str = "1", auth_token: str = None) -> Dict[str, Any]:
    """Filter patents by classification codes."""
    url = f"{KYP_BASE_URL}/get_patents_by_classification_ids"
    payload = {"codes": codes, "patents": patents}
    headers = {"user-id": user_id}
    if auth_token:
        headers["Authorization"] = auth_token
    
    try:
        # timeout=None means the request will wait as long as the KYP server needs to respond
        async with httpx.AsyncClient(timeout=None) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            return response.json()
    except Exception as e:
        logger.error(f"[KYP] Error filtering patents by classifications: {e}")
        return {"patent_numbers": [], "total_patents": 0}

async def trigger_scoring_batch(patents: List[str], user_id: str = "1", auth_token: str = None) -> str:
    """Trigger scoring and return task_id."""
    url = f"{KYP_BASE_URL}/get_score_parameters"
    payload = {"patents": patents}
    headers = {"user-id": user_id}
    logger.info(f"[KYP API REQUEST] Triggering scoring for {patents} with user-id header: '{user_id}'")
    if auth_token:
        headers["Authorization"] = auth_token
    
    try:
        # timeout=None means the request will wait as long as the KYP server needs to respond
        async with httpx.AsyncClient(timeout=None) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data.get("task_id", "")
    except Exception as e:
        logger.error(f"[KYP] Error triggering scoring for {len(patents)} patents: {e}")
        return ""

async def poll_scoring_task(task_id: str, max_retries: int = 720, delay: int = 5, user_id: str = "1", auth_token: str = None) -> Dict[str, Any]:
    """Poll the task endpoint until completed or failed. (Default max 60 mins for 1k patents)."""
    url = f"{KYP_BASE_URL}/tasks/{task_id}"
    headers = {"user-id": user_id}
    if auth_token:
        headers["Authorization"] = auth_token
    
    for attempt in range(max_retries):
        try:
            # timeout=None means the request will wait as long as the KYP server needs to respond
            async with httpx.AsyncClient(timeout=None) as client:
                response = await client.get(url, headers=headers)
                response.raise_for_status()
                data = response.json()
                
                status = data.get("status", "pending")
                if status == "completed":
                    return data
                elif status == "failed":
                    logger.error(f"[KYP] Task {task_id} failed.")
                    return {}
        except Exception as e:
            logger.warning(f"[KYP] Polling error on attempt {attempt + 1}: {repr(e)}")
            
        await asyncio.sleep(delay)
        
    logger.error(f"[KYP] Task {task_id} timed out after {max_retries * delay} seconds.")
    return {}
