import json
import asyncio
from langfuse.openai import AsyncOpenAI
from langfuse import Langfuse
from ..config import settings

# Initialize Langfuse client for production monitoring
langfuse = Langfuse(
    public_key=settings.LANGFUSE_PUBLIC_KEY,
    secret_key=settings.LANGFUSE_SECRET_KEY,
    host=settings.LANGFUSE_HOST
)

async def classify_patent(cpc_list: list, abstract: str, claims: str, patent_number: str = "", session_id: str = "", max_retries: int = 3) -> dict:
    if not settings.OPENAI_API_KEY:
        print("Warning: OPENAI_API_KEY is not set.")
        return []

    # Initialize auto-instrumented AsyncOpenAI client from langfuse.openai
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    prompt = f"""
    Analyze the following patent details carefully. Your task is to classify it into multiple Application Domains, Technology Topics, and Sub-topics to comprehensively cover all aspects of the claims.

    CPC Codes: {', '.join(cpc_list)}
    Abstract: {abstract}
    Claims: {claims[:1000]}

    Instructions:
    1. First, provide your step-by-step reasoning (Chain of Thought) analyzing the claims, abstract, and CPC codes to identify the core technologies and applications.
    2. Then, output the final classifications as a JSON array. Each element in the array must be an object with exactly three keys: "domain", "topic", and "subtopic". Provide at least 2 distinct taxonomies if applicable.

    Output Format strictly like this:
    Thought: <your step-by-step reasoning here>
    JSON:
    [
      {{"domain": "...", "topic": "...", "subtopic": "..."}},
      {{"domain": "...", "topic": "...", "subtopic": "..."}}
    ]
    """

    for attempt in range(1, max_retries + 1):
        try:
            # Langfuse auto-instruments this call: logs prompt, completion, token usage, latency, and exact cost
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an expert patent taxonomy classifier."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.2,
                max_tokens=600,
                name=f"classify-{patent_number}" if patent_number else "patent-taxonomy-classification",
                metadata={
                    "patent_number": patent_number,
                    "session_id": session_id,
                    "cpc_count": len(cpc_list),
                    "abstract_len": len(abstract),
                    "claims_len": len(claims)
                }
            )

            content = response.choices[0].message.content.strip()

            # Parse JSON block
            json_start = content.find("JSON:\n")
            if json_start != -1:
                json_str = content[json_start + 6:].strip()
                if json_str.startswith("```json"):
                    json_str = json_str[7:-3].strip()
                elif json_str.startswith("```"):
                    json_str = json_str[3:-3].strip()
                parsed = json.loads(json_str)
                if isinstance(parsed, list) and len(parsed) > 0:
                    return parsed

            if "[" in content and "]" in content:
                json_str = content[content.find("["):content.rfind("]")+1]
                parsed = json.loads(json_str)
                if isinstance(parsed, list) and len(parsed) > 0:
                    return parsed

            if attempt < max_retries:
                print(f"Taxonomy classification output unparseable for patent (Attempt {attempt}/{max_retries}). Retrying...")
                await asyncio.sleep(attempt)
                continue

            return []

        except Exception as e:
            print(f"Error classifying patent (Attempt {attempt}/{max_retries}): {e}")
            if attempt < max_retries:
                await asyncio.sleep(attempt * 1.5)
            else:
                return []

    return []
