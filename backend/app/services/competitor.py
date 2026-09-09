import httpx
import asyncio

async def fetch_competitor_data(patent_number: str, assignees: any, max_retries: int = 3) -> dict:
    url = "http://135.181.19.83:8509/utilities/competitor-search"
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
                
                # If we received competitors OR if assignees was NAN (no competitors expected), return immediately
                if competitors or assignees_list == ["NAN"]:
                    return {
                        "competitors": competitors,
                        "total_competitors": data.get("total_competitors", len(competitors))
                    }
                
                # If competitors list is empty but valid assignees were sent, retry once or twice in case service was warming up
                if attempt < max_retries:
                    print(f"Competitor API returned empty for {patent_number} (Attempt {attempt}/{max_retries}). Retrying in {attempt}s...")
                    await asyncio.sleep(attempt)
                    continue
                    
                return {
                    "competitors": [],
                    "total_competitors": 0
                }
                
        except Exception as e:
            print(f"Error fetching Competitor data for {patent_number} (Attempt {attempt}/{max_retries}): {e}")
            if attempt < max_retries:
                await asyncio.sleep(attempt * 1.5)
            else:
                return {"competitors": [], "total_competitors": 0}
                
    return {"competitors": [], "total_competitors": 0}
