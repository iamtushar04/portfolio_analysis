import httpx
import asyncio
from ..config import settings

async def fetch_sparta_data(no_kind_code: str, max_retries: int = 3) -> dict:
    url = f"{settings.SPARTA_API_BASE_URL}/{no_kind_code}"
    
    for attempt in range(1, max_retries + 1):
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.get(url)
                if response.status_code == 404:
                    return {"standard": None, "standard_links": None}
                    
                response.raise_for_status()
                data = response.json()
                content = data.get("content", [])
                
                for item in content:
                    pub_num = str(item.get("publication_number", ""))
                    if pub_num == no_kind_code or pub_num.startswith(no_kind_code) or no_kind_code in pub_num:
                        return {
                            "standard": item.get("standard"),
                            "standard_links": item.get("standard_links")
                        }
                        
                return {"standard": None, "standard_links": None}
                
        except Exception as e:
            print(f"Error fetching Sparta data for {no_kind_code} (Attempt {attempt}/{max_retries}): {e}")
            if attempt < max_retries:
                await asyncio.sleep(attempt * 1.5)
            else:
                return {"standard": None, "standard_links": None}
                
    return {"standard": None, "standard_links": None}
