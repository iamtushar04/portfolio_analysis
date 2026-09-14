import json
import logging
from sqlalchemy.orm import Session
from openai import OpenAI
from ..models.schemas import TranslationCache
from ..config import settings

logger = logging.getLogger(__name__)

# Initialize OpenAI client (requires OPENAI_API_KEY in env/config)
# Wait, checking if OPENAI_API_KEY is in settings
client = None
if getattr(settings, "OPENAI_API_KEY", None):
    client = OpenAI(api_key=settings.OPENAI_API_KEY)

def is_non_english(name: str) -> bool:
    """
    Returns True if a name contains any character outside the standard
    printable ASCII range (0-127). This detects Chinese, Japanese, Korean,
    Arabic, Cyrillic, etc. — anything that needs translating.
    Pure Latin/English names are skipped for free without touching the API.
    """
    return any(ord(char) > 127 for char in name)

def batch_translate_names(db: Session, names: list[str]) -> dict[str, str]:
    """
    Takes a list of raw names, checks the translation cache, translates the unknown ones 
    via OpenAI, caches them, and returns a dictionary mapping {original: english}.
    """
    if not names:
        return {}
        
    # Clean up empty/whitespace
    unique_names = list(set([n.strip() for n in names if n and n.strip()]))
    if not unique_names:
        return {}

    translation_map = {}
    unknown_names = []

    # 1. Check DB Cache
    cached_translations = db.query(TranslationCache).filter(
        TranslationCache.original_text.in_(unique_names)
    ).all()
    
    for cache_hit in cached_translations:
        translation_map[cache_hit.original_text] = cache_hit.english_text
        
    # Find which ones are still unknown
    for name in unique_names:
        if name not in translation_map:
            unknown_names.append(name)

    # 2. Batch Translate unknowns via OpenAI
    # --- Non-English Pre-filter (Cost Optimization) ---
    # Only send names with non-ASCII characters (foreign script) to the API.
    # Names that are already pure Latin/English are identity-mapped for free.
    names_to_translate = [n for n in unknown_names if is_non_english(n)]
    english_already = [n for n in unknown_names if not is_non_english(n)]
    
    # Identity-map English names instantly at zero cost
    for name in english_already:
        translation_map[name] = name
    
    logger.info(f"Translation batch: {len(names_to_translate)} foreign-script, {len(english_already)} already-English (skipped).")

    if names_to_translate and client:
        # --- Dynamic Chunk Sizing ---
        # OpenAI output budget: 4096 tokens max. We leave ~600 as margin = 3500 usable.
        # 1 token ≈ 4 characters. So usable output chars ≈ 3500 * 4 = 14,000 chars.
        # A translated JSON entry is roughly 2x the input name length (original + translated + JSON syntax).
        # chunk_size = floor(14000 / (avg_name_len * 2)), clamped between 20 and 300.
        avg_name_len = sum(len(n) for n in names_to_translate) / len(names_to_translate)
        estimated_chars_per_entry = max(avg_name_len * 2, 20)  # floor at 20 to avoid div-by-zero
        CHUNK_SIZE = max(20, min(300, int(14000 / estimated_chars_per_entry)))
        
        total_chunks = (len(names_to_translate) + CHUNK_SIZE - 1) // CHUNK_SIZE
        logger.info(f"Dynamic chunk size: {CHUNK_SIZE} (avg name length: {avg_name_len:.1f} chars, total chunks: {total_chunks})")
        
        for chunk_start in range(0, len(names_to_translate), CHUNK_SIZE):
            chunk = names_to_translate[chunk_start:chunk_start + CHUNK_SIZE]
            try:
                logger.info(f"Translating chunk {chunk_start // CHUNK_SIZE + 1}/{total_chunks} ({len(chunk)} names)...")

                # --- Index-Based Approach ---
                # We NEVER use foreign characters as JSON keys because GPT-4o-mini sometimes
                # produces invalid \uXXXX escape sequences when writing CJK characters as keys.
                # Instead, we map each name to a numeric index, ask GPT to translate by index,
                # and then map back. GPT only ever writes plain English as values, which is safe.
                index_map = {str(i): name for i, name in enumerate(chunk)}
                indexed_input = {str(i): name for i, name in enumerate(chunk)}

                prompt = (
                    "You are a professional patent and corporate name translator. "
                    "I will provide a JSON object where keys are numeric indices and values are foreign company/individual names. "
                    "Common patterns: 'Kabushiki Kaisha' or 'KK' = Japanese Corp, "
                    "'GmbH' = German LLC, '\uc8fc\uc2dd\ud68c\uc0ac' = Korean Corp, '\u682a\u5f0f\u4f1a\u793e' = Japanese Corp. "
                    "Return a JSON object with the SAME numeric keys, but replace each value with the English translation. "
                    "If a name is already English, return it unchanged. "
                    "If it is a person's name, transliterate it to English letters.\n\n"
                    f"Input:\n{json.dumps(indexed_input, ensure_ascii=True)}"
                )

                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                    temperature=0.0,
                    max_tokens=4096
                )

                result_text = response.choices[0].message.content
                llm_translations = json.loads(result_text)

                # Map back from index → original name → translated value
                new_cache_objects = []
                for idx_str, translated in llm_translations.items():
                    original = index_map.get(idx_str)
                    if original and isinstance(translated, str):
                        translation_map[original] = translated
                        new_cache_objects.append(
                            TranslationCache(original_text=original, english_text=translated)
                        )
                
                if new_cache_objects:
                    db.bulk_save_objects(new_cache_objects)
                    db.commit()
                    
            except Exception as e:
                logger.error(f"Error during translation chunk {chunk_start // CHUNK_SIZE + 1}: {str(e)}")
                # Fallback for this chunk only: identity-map
                for name in chunk:
                    if name not in translation_map:
                        translation_map[name] = name
    else:
        # If no API key or nothing to translate, identity-map remaining
        for name in names_to_translate:
            translation_map[name] = name

    return translation_map
