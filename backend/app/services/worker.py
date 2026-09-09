import asyncio
from ..database import SessionLocal
from ..models import schemas
from .wissen import fetch_wissen_data
from .taxonomy import classify_patent
from .sparta import fetch_sparta_data
from .competitor import fetch_competitor_data

async def process_single_patent(db, session_id: str, patent_number: str, semaphore: asyncio.Semaphore):
    async with semaphore:
        try:
            # 1. Fetch from Wissen
            wissen_data = await fetch_wissen_data(patent_number)
            
            # 2. Extract Data for Taxonomy
            abstract = wissen_data.get("abstract", "")
            claims = wissen_data.get("claims", "")
            cpc_list = [c.get("code") for c in wissen_data.get("classifications", [])]
            
            # 3. Fetch Taxonomy (OpenAI)
            taxonomy_data = await classify_patent(cpc_list, abstract, claims)
            
            # 4. Fetch Sparta (strip kind code for Sparta)
            # kind code is usually at the end, e.g., US7930287B2 -> US7930287
            # We can strip trailing letters/numbers after the main digits
            import re
            match = re.match(r"^([A-Z]{2}\d+)", patent_number)
            no_kind_code = match.group(1) if match else patent_number
            sparta_data = await fetch_sparta_data(no_kind_code)
            
            # 5. Fetch Competitor
            raw_assignees = wissen_data.get("assignees", [])
            if not raw_assignees and wissen_data.get("assignee"):
                raw_assignees = [wissen_data.get("assignee")]
            assignees_list = [a for a in raw_assignees if a and str(a).strip()]
            
            competitor_data = await fetch_competitor_data(patent_number, assignees_list)
            
            # 6. Update DB record
            patent_record = db.query(schemas.PatentData).filter(
                schemas.PatentData.session_id == session_id,
                schemas.PatentData.patent_number == patent_number
            ).first()
            
            if patent_record:
                patent_record.title = wissen_data.get("title")
                patent_record.assignees = assignees_list
                patent_record.abstract = abstract
                patent_record.claims = claims
                patent_record.forward_citations = wissen_data.get("forward_citations_deduped", [])
                patent_record.backward_citations = wissen_data.get("backward_citations_deduped", [])
                
                patent_record.taxonomies = taxonomy_data
                
                patent_record.standard = sparta_data.get("standard")
                patent_record.standard_links = sparta_data.get("standard_links")
                
                patent_record.competitors = competitor_data.get("competitors", [])
                
                patent_record.status = "success"
                
                db.commit()
                
        except Exception as e:
            patent_record = db.query(schemas.PatentData).filter(
                schemas.PatentData.session_id == session_id,
                schemas.PatentData.patent_number == patent_number
            ).first()
            if patent_record:
                patent_record.status = "failed"
                patent_record.error_message = str(e)
                db.commit()
        
        # Increment processed counter
        db_session = db.query(schemas.Session).filter(schemas.Session.id == session_id).first()
        if db_session:
            db_session.processed_patents += 1
            if db_session.processed_patents >= db_session.total_patents:
                db_session.status = "completed"
            db.commit()

async def run_processing(session_id: str, patent_numbers: list):
    db = SessionLocal()
    try:
        # concurrency limit: 10 patents at a time
        semaphore = asyncio.Semaphore(10)
        tasks = []
        for patent in patent_numbers:
            task = asyncio.create_task(process_single_patent(db, session_id, patent, semaphore))
            tasks.append(task)
            
        await asyncio.gather(*tasks)
    finally:
        db.close()

def process_patents_background(session_id: str, patent_numbers: list):
    # This runs in a background thread provided by FastAPI
    # Create a new event loop for async tasks
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(run_processing(session_id, patent_numbers))
    loop.close()
