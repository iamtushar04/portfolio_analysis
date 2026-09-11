import httpx
import asyncio
import random
import threading
from ..config import settings

# threading.Semaphore is the correct primitive here.
# Celery uses --pool=threads, so each patent task runs in its own OS thread.
# threading.Semaphore has ZERO event loop dependency — it works correctly
# across all threads for the entire lifetime of the worker process.
_competitor_semaphore = threading.Semaphore(3)  # Max 3 concurrent competitor API calls

async def fetch_competitor_data(patent_number: str, assignees: any, label: str = "Unknown", max_retries: int = 5) -> dict:
    url = settings.COMPETITOR_API_URL
    headers = {
        "accept": "application/json",
        "Content-Type": "application/json"
    }
    
    # Process assignees input into a clean list of strings
    if isinstance(assignees, list):
        clean_assignees = [str(a).strip() for a in assignees if a and str(a).strip() and str(a).strip() != "Unknown"]
    elif isinstance(assignees, str) and assignees.strip() and assignees.strip() != "Unknown":
        clean_assignees = [assignees.strip()]
    else:
        clean_assignees = []
        
    assignees_list = clean_assignees if clean_assignees else ["NAN"]
    
    payload = {
        "patent_number": patent_number,
        "assignees": assignees_list
    }

    # Use None for read timeout — we wait as long as the ML model needs to respond.
    # connect/write/pool have short timeouts to fail fast on network issues.
    timeout = httpx.Timeout(
        connect=10.0,   # fail fast if we can't even connect
        read=None,      # wait as long as needed for the ML response
        write=10.0,
        pool=10.0
    )

    # threading.Semaphore: blocks the thread (not the event loop) until a slot is free.
    # This is correct for Celery's --pool=threads mode.
    with _competitor_semaphore:
        for attempt in range(1, max_retries + 1):
            try:
                print(f"[{label}] Competitor API call for {patent_number} (Attempt {attempt}/{max_retries})...")
                async with httpx.AsyncClient(timeout=timeout) as client:
                    response = await client.post(url, headers=headers, json=payload)
                    response.raise_for_status()
                    data = response.json()
                    competitors = data.get("competitors", [])
                    
                    # If we received competitors, return them.
                    # If empty, it might be due to API transient overload — retry unless last attempt.
                    if not competitors and attempt < max_retries:
                        print(f"[{label}] Competitor API returned empty for {patent_number} (Attempt {attempt}/{max_retries}). Retrying...")
                    else:
                        print(f"[{label}] Got {len(competitors)} competitors for {patent_number} on attempt {attempt}.")
                        return {
                            "competitors": competitors,
                            "total_competitors": data.get("total_competitors", len(competitors))
                        }
                    
            except Exception as e:
                print(f"[{label}] Error fetching Competitor data for {patent_number} (Attempt {attempt}/{max_retries}): {type(e).__name__}: {e}")
                
            if attempt < max_retries:
                # Jittered exponential backoff — longer gaps on later attempts
                sleep_time = (2 ** attempt) + random.uniform(1.0, 3.0)
                print(f"[{label}] Waiting {sleep_time:.1f}s before retry {attempt + 1}...")
                await asyncio.sleep(sleep_time)
            else:
                print(f"[{label}] All {max_retries} attempts exhausted for {patent_number}. Returning empty.")
                return {"competitors": [], "total_competitors": 0}
                
    return {"competitors": [], "total_competitors": 0}
