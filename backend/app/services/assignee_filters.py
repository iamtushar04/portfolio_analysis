"""
assignee_filters.py
-------------------
Pure-Python, zero-cost pre-filters applied to forward citation assignees
BEFORE any Perplexity API call.

Filters:
  1. Jurisdiction filter  — keep only citations from the same patent office
                            as the input patent (US→US, EP→EP, etc.)
  2. Operating Company    — strip out universities, government bodies, NPEs,
                            and individual inventors via a keyword blocklist.

Design goal: adding a new filter is a single function + one call in
`apply_all_filters()`. Nothing else needs to change.
"""

from __future__ import annotations
import re
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 1.  JURISDICTION FILTER
# ---------------------------------------------------------------------------

def extract_jurisdiction(patent_number: str) -> Optional[str]:
    """
    Extract the 2-letter jurisdiction prefix from a patent number.
    Returns None if the number doesn't start with letters (edge-case guard).

    Examples:
        "US12345B2"   -> "US"
        "EP3456789A1" -> "EP"
        "WO2021123456"-> "WO"
    """
    match = re.match(r"^([A-Z]{2})", patent_number.strip().upper())
    return match.group(1) if match else None


def filter_by_jurisdiction(
    forward_citations: list[dict],
    input_patent_number: str,
) -> list[dict]:
    """
    Keep only forward citations whose patent_number starts with the same
    2-letter jurisdiction code as `input_patent_number`.

    If jurisdiction cannot be determined, returns the full list unchanged
    (safe fallback — no citations dropped unexpectedly).

    Args:
        forward_citations: List of citation dicts from wissen
                           e.g. [{"patent_number": "US...", "assignees": [...]}]
        input_patent_number: The patent being processed, e.g. "US12345B2"

    Returns:
        Filtered list of citation dicts.
    """
    jurisdiction = extract_jurisdiction(input_patent_number)
    if not jurisdiction:
        logger.warning(
            f"[AssigneeFilters] Could not determine jurisdiction for "
            f"'{input_patent_number}'. Skipping jurisdiction filter."
        )
        return forward_citations

    filtered = [
        c for c in forward_citations
        if str(c.get("patent_number", "")).upper().startswith(jurisdiction)
    ]

    logger.info(
        f"[AssigneeFilters] Jurisdiction filter ({jurisdiction}): "
        f"{len(forward_citations)} -> {len(filtered)} citations"
    )
    return filtered


# ---------------------------------------------------------------------------
# 2.  OPERATING COMPANY FILTER
# ---------------------------------------------------------------------------

# Keyword blocklist — all lowercase.
# Any assignee whose normalised name contains one of these substrings
# is considered a non-operating entity and is dropped.
#
# To ADD a new pattern:  just append to this list.
# To DISABLE this filter: set ENABLE_OC_FILTER=false in .env (see config.py).
_NON_OPERATING_KEYWORDS: list[str] = [
    # Academia
    "university",
    "universite",
    "universidad",
    "universitat",
    "universit",       # catches unicode variants (universita, université)
    "college",
    "institute of technology",
    "polytechnic",
    "polytechnique",
    "school of",
    "faculty of",
    "department of",
    "board of trustees",
    "board of regents",
    "regents of",
    # Research bodies
    "research institute",
    "research center",
    "research centre",
    "research lab",
    "research laboratory",
    "research foundation",
    "national laboratory",
    "national lab",
    "fraunhofer",
    "cnrs",
    "inria",
    "csiro",
    "nist",
    "imec",
    # Academies & foundations (non-commercial)
    "academy of sciences",
    "academy of science",
    "national academy",
    "wissenschaft",
    # Government / military
    "government of",
    "ministry of",
    "minister of",
    "secretary of",
    "department of defense",
    "department of energy",
    "department of agriculture",
    "u.s. army",
    "us army",
    "u.s. navy",
    "us navy",
    "u.s. air force",
    "us air force",
    "u.s. government",
    "united states government",
    "united states of america",
    "nasa",
    "darpa",
    "agency for",
    "authority of",
    "administration of",
    # Hospitals / medical institutions (non-commercial R&D)
    "hospital",
    "health system",
    "medical center",
    "medical centre",
    # Generic non-profit / charity indicators
    "foundation",
    "charitable trust",
    "nonprofit",
    "non-profit",
]

# Pre-compile a single regex for speed (substring match, case-insensitive).
_OC_BLOCK_PATTERN: re.Pattern = re.compile(
    "|".join(re.escape(kw) for kw in _NON_OPERATING_KEYWORDS),
    re.IGNORECASE,
)


def is_operating_company(name: str) -> bool:
    """
    Returns True if `name` looks like an operating (product-making) company.
    Returns False if it matches any non-operating keyword.
    """
    if not name or not name.strip():
        return False
    return _OC_BLOCK_PATTERN.search(name) is None


def filter_operating_companies(assignee_names: list[str]) -> list[str]:
    """
    Given a flat list of assignee name strings, return only those that
    pass the operating-company test.

    Args:
        assignee_names: e.g. ["Samsung Electronics", "MIT", "Qualcomm"]
    Returns:
        e.g. ["Samsung Electronics", "Qualcomm"]
    """
    before = len(assignee_names)
    filtered = [a for a in assignee_names if is_operating_company(a)]
    after = len(filtered)

    if before != after:
        dropped = set(assignee_names) - set(filtered)
        logger.info(
            f"[AssigneeFilters] OC filter: {before} -> {after} assignees "
            f"(dropped: {dropped})"
        )
    return filtered


# ---------------------------------------------------------------------------
# 3.  COMBINED PIPELINE  (main entry point for tasks.py)
# ---------------------------------------------------------------------------

def apply_all_filters(
    forward_citations: list[dict],
    input_patent_number: str,
    enable_jurisdiction_filter: bool = True,
    enable_oc_filter: bool = True,
) -> list[str]:
    """
    Applies the full assignee pre-filter pipeline and returns a
    deduplicated list of operating-company assignee name strings.

    Pipeline:
        raw citations
            -> [jurisdiction filter]  (optional, default ON)
            -> extract assignee names
            -> strip Unknown / NaN values
            -> [OC keyword filter]    (optional, default ON)
            -> deduplicate

    Args:
        forward_citations:          Raw list of citation dicts from Wissen.
        input_patent_number:        Input patent being processed.
        enable_jurisdiction_filter: Toggle jurisdiction filter.
        enable_oc_filter:           Toggle operating company filter.

    Returns:
        Sorted, deduplicated list of clean assignee name strings.
    """
    # Step 1: Jurisdiction filter
    if enable_jurisdiction_filter:
        citations = filter_by_jurisdiction(forward_citations, input_patent_number)
    else:
        citations = forward_citations

    # Step 2: Extract and clean all assignee name strings
    raw_names: set[str] = set()
    for c in citations:
        # Support both 'assignees' (list) and 'assignee' (string) formats
        raw = c.get("assignees") or (
            [c.get("assignee")] if c.get("assignee") else []
        )
        for a in raw:
            cleaned = str(a).strip()
            if cleaned and cleaned.lower() not in {"unknown", "nan", "none", ""}:
                raw_names.add(cleaned)

    # Step 3: Operating company filter
    if enable_oc_filter:
        result = filter_operating_companies(list(raw_names))
    else:
        result = list(raw_names)

    logger.info(
        f"[AssigneeFilters] Final assignee count after all filters: {len(result)}"
    )
    return sorted(result)  # sorted for determinism
