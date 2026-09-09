import httpx
import asyncio

async def fetch_wissen_data(patent_number: str) -> dict:
    url = f"https://api.patent.wissenresearch.com/patent/{patent_number}"
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()
            
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
            print(f"Error fetching Wissen data for {patent_number}: {e}")
            return {}
