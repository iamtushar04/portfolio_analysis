import httpx
import asyncio
from ..config import settings

import random

async def fetch_competitor_data(patent_number: str, assignees: any, label: str = "Unknown", max_retries: int = 3) -> dict:
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
    
    for attempt in range(1, max_retries + 1):
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.post(url, headers=headers, json=payload)
                response.raise_for_status()
                data = response.json()
                competitors = data.get("competitors", [])
                
                # If we received competitors, return them. 
                # If empty, it might be due to API concurrency overload. Retry up to max_retries before giving up.
                if not competitors and attempt < max_retries:
                    print(f"[{label}] Competitor API returned empty for {patent_number} (Attempt {attempt}/{max_retries}). Retrying...")
                    # Fall through to the except-like sleep logic below
                else:
                    return {
                        "competitors": competitors,
                        "total_competitors": data.get("total_competitors", len(competitors))
                    }
                
        except Exception as e:
            print(f"[{label}] Error fetching Competitor data for {patent_number} (Attempt {attempt}/{max_retries}): {type(e).__name__}: {e}")
            
        if attempt < max_retries:
            # Jittered exponential backoff to avoid thundering herd on upstream API
            sleep_time = (attempt * 1.5) + random.uniform(0.5, 2.0)
            await asyncio.sleep(sleep_time)
        else:
            return {"competitors": [], "total_competitors": 0}
            
    return {"competitors": [], "total_competitors": 0}
