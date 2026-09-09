import httpx

async def fetch_competitor_data(patent_number: str, assignees: any) -> dict:
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
    
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
            return {
                "competitors": data.get("competitors", []),
                "total_competitors": data.get("total_competitors", 0)
            }
        except Exception as e:
            print(f"Error fetching Competitor data for {patent_number}: {e}")
            return {"competitors": [], "total_competitors": 0}
