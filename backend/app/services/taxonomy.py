import httpx
import json
import os
import asyncio
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

async def classify_patent(cpc_list: list, abstract: str, claims: str, max_retries: int = 3) -> dict:
    if not OPENAI_API_KEY:
        print("Warning: OPENAI_API_KEY is not set.")
        return []
        
    client = AsyncOpenAI(api_key=OPENAI_API_KEY)
    
    prompt = f"""
    Analyze the following patent details carefully. Your task is to classify it into multiple Application Domains, Technology Topics, and Sub-topics to comprehensively cover all aspects of the claims.
    
    CPC Codes: {', '.join(cpc_list)}
    Abstract: {abstract} # truncate to save tokens
    Claims: {claims[:1000]} # truncate to save tokens
    
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
            response = await client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are an expert patent taxonomy classifier."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.2,
                max_tokens=600
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
