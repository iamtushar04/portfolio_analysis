import httpx
import json
import os
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

async def classify_patent(cpc_list: list, abstract: str, claims: str) -> dict:
    if not OPENAI_API_KEY:
        print("Warning: OPENAI_API_KEY is not set.")
        return {"domain": "Unknown", "topic": "Unknown", "subtopic": "Unknown"}
        
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
    
    try:
        response = await client.chat.completions.create(
            model="gpt-3.5-turbo", # or gpt-4o depending on preference/cost
            messages=[
                {"role": "system", "content": "You are an expert patent taxonomy classifier."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
            max_tokens=600
        )
        
        content = response.choices[0].message.content.strip()
        
        # Parse the JSON block out of the response
        json_start = content.find("JSON:\n")
        if json_start != -1:
            json_str = content[json_start + 6:].strip()
            if json_str.startswith("```json"):
                json_str = json_str[7:-3].strip()
            elif json_str.startswith("```"):
                json_str = json_str[3:-3].strip()
            return json.loads(json_str)
            
        # Fallback if no "JSON:" marker but has array brackets
        if "[" in content and "]" in content:
            json_str = content[content.find("["):content.rfind("]")+1]
            return json.loads(json_str)
            
        return []
    except Exception as e:
        print(f"Error classifying patent: {e}")
        return []
