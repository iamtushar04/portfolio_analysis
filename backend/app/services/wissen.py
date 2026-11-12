import os
import httpx
import asyncio
from ..config import settings

async def fetch_wissen_data(patent_number: str, max_retries: int = 3) -> dict:
    base_url = (getattr(settings, "WISSEN_API_BASE_URL", "") or "").strip().rstrip("/")
    if base_url.endswith("/patent"):
        url = f"{base_url}/{patent_number}"
        domain_root = base_url[:-7]
    else:
        url = f"{base_url}/patent/{patent_number}"
        domain_root = base_url

    referer_url = (
        f"{getattr(settings, 'WISSEN_AI_API_BASE_URL', '').strip().rstrip('/')}/docs"
        if getattr(settings, "WISSEN_AI_API_BASE_URL", None)
        else f"{domain_root}/docs"
    )

    api_key = getattr(settings, "WISSEN_API_KEY", None) or os.environ.get("WISSEN_API_KEY", "").strip()
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Dest": "empty",
        "Referer": referer_url,
    }
    if api_key and api_key != "...":
        headers["X-API-Key"] = api_key
        headers["Authorization"] = f"Bearer {api_key}"

    for attempt in range(1, max_retries + 1):
        try:
            async with httpx.AsyncClient(timeout=35.0) as client:
                response = await client.get(url, headers=headers)
                response.raise_for_status()
                data = response.json()
                
                # Verify key payload presence
                if not data or not isinstance(data, dict):
                    raise ValueError("Invalid JSON response format from Wissen API")
                    
                # Deduplicate forward citations
                fwd = data.get("forward_citations", [])
                fwd_family = data.get("forward_citations_family", [])
                
                fwd_dict = {}
                for c in fwd + fwd_family:
                    pat_num = c.get("patent_number")
                    if pat_num and pat_num not in fwd_dict:
                        raw_assignees = c.get("assignees") or ([c.get("assignee")] if c.get("assignee") else [])
                        fwd_dict[pat_num] = {
                            "patent_number": pat_num,
                            "assignees": raw_assignees if raw_assignees else ["Unknown"],
                            "assignee": raw_assignees[0] if raw_assignees else "Unknown"
                        }
                        
                # Deduplicate backward citations
                bwd = data.get("backward_citations", [])
                bwd_family = data.get("backward_citations_family", [])
                
                bwd_dict = {}
                for c in bwd + bwd_family:
                    pat_num = c.get("patent_number")
                    if pat_num and pat_num not in bwd_dict:
                        raw_assignees = c.get("assignees") or ([c.get("assignee")] if c.get("assignee") else [])
                        bwd_dict[pat_num] = {
                            "patent_number": pat_num,
                            "assignees": raw_assignees if raw_assignees else ["Unknown"],
                            "assignee": raw_assignees[0] if raw_assignees else "Unknown"
                        }
                
                data["forward_citations_deduped"] = list(fwd_dict.values())
                data["backward_citations_deduped"] = list(bwd_dict.values())
                
                return data
                
        except Exception as e:
            print(f"Error fetching Wissen data for {patent_number} (Attempt {attempt}/{max_retries}): {e}")
            if isinstance(e, httpx.HTTPStatusError) and e.response.status_code == 404:
                return {}
            if attempt < max_retries:
                await asyncio.sleep(attempt * 1.5)
            else:
                return {}
                
    return {}
