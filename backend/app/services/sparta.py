import httpx

async def fetch_sparta_data(no_kind_code: str) -> dict:
    url = f"https://api.sparta.wissenresearch.com/patent_standard_mapping/{no_kind_code}"
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.get(url)
            if response.status_code == 404:
                return {"standard": None, "standard_links": None}
                
            response.raise_for_status()
            data = response.json()
            
            content = data.get("content", [])
            
            for item in content:
                pub_num = str(item.get("publication_number", ""))
                # Find the object where publication_number matches no_kind_code
                if pub_num == no_kind_code or pub_num.startswith(no_kind_code) or no_kind_code in pub_num:
                    return {
                        "standard": item.get("standard"),
                        "standard_links": item.get("standard_links")
                    }
                    
            return {"standard": None, "standard_links": None}
            
        except Exception as e:
            print(f"Error fetching Sparta data for {no_kind_code}: {e}")
            return {"standard": None, "standard_links": None}
