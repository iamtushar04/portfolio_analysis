import httpx
import json
import logging
from datetime import datetime
from ..redis_client import redis_client
from ..database import SessionLocal
from ..models.schemas import InfringementAnalysisCache

logger = logging.getLogger(__name__)

# External bulk analysis API endpoint
INFRINGEMENT_API_URL = "http://135.181.19.83:8509/agents/bulk-analysis/infringement"

async def run_infringement_job(job_id: str, patent_number: str, auth_token: str = None, custom_instruction: str = None):
    """
    Background task that calls the external infringement analysis API (takes 4-10 mins)
    and stores the result in Redis so the frontend can poll it.
    """
    try:
        # Initialize job in Redis (2 hours TTL)
        redis_client.set(
            f"infringement_job:{job_id}", 
            json.dumps({"status": "running"}), 
            ex=7200
        )
        # Track which patent_number is running so the session API can report it on reload
        redis_client.set(f"infringement_running:{patent_number}", job_id, ex=7200)
        
        payload = {
            "patent_numbers": [patent_number],
            "custom_instructions": custom_instruction
        }
        
        logger.info(f"[{job_id}] Starting infringement analysis for patent {patent_number}")
        
        headers = {}
        if auth_token:
            headers["Authorization"] = auth_token
        
        # 15 minute timeout (900 seconds) since API takes 4-10 minutes
        async with httpx.AsyncClient(timeout=900.0) as client:
            response = await client.post(INFRINGEMENT_API_URL, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            
            # Save to Postgres Cache
            db = SessionLocal()
            try:
                cache_entry = db.query(InfringementAnalysisCache).filter(InfringementAnalysisCache.patent_number == patent_number).first()
                if cache_entry:
                    cache_entry.result_data = data
                    cache_entry.updated_at = datetime.utcnow()
                else:
                    cache_entry = InfringementAnalysisCache(
                        patent_number=patent_number,
                        result_data=data,
                        updated_at=datetime.utcnow()
                    )
                    db.add(cache_entry)
                db.commit()
            except Exception as db_e:
                logger.error(f"Failed to cache infringement result to DB: {db_e}")
            finally:
                db.close()
            
            # Store completed result in Redis
            redis_client.set(
                f"infringement_job:{job_id}", 
                json.dumps({
                    "status": "completed",
                    "result": data
                }),
                ex=7200
            )
            logger.info(f"[{job_id}] Infringement analysis completed for patent {patent_number}")
            # Clean up the running tracker
            redis_client.delete(f"infringement_running:{patent_number}")
            
    except Exception as e:
        logger.error(f"[{job_id}] Infringement analysis failed: {e}")
        # Store error state so frontend knows it failed
        redis_client.set(
            f"infringement_job:{job_id}", 
            json.dumps({
                "status": "error",
                "message": str(e)
            }),
            ex=7200
        )
        # Clean up the running tracker on failure too
        redis_client.delete(f"infringement_running:{patent_number}")

def get_infringement_job_status(job_id: str):
    """
    Retrieves the job status from Redis.
    """
    data = redis_client.get(f"infringement_job:{job_id}")
    if not data:
        return None
    return json.loads(data)
