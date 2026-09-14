# API Reference & Responsibility Matrix

This document outlines the Application Programming Interfaces (APIs) utilized within the Patent Portfolio Analysis platform. It is divided into two sections: **Internal APIs** (endpoints exposed by our backend) and **External Integration APIs** (third-party services our backend consumes).

---

## 1. Internal REST APIs (FastAPI)

These endpoints are exposed by the Uvicorn server and consumed exclusively by the Next.js frontend. They handle session state and data retrieval.

### `POST /api/sessions/`
- **Purpose**: Initializes a new analysis session.
- **Responsibility**: Creates a new UUID-based session record in PostgreSQL tied to the authenticated user.
- **Returns**: `{"id": "uuid", "name": "...", "status": "pending"}`

### `GET /api/sessions/`
- **Purpose**: Retrieves the user's dashboard history.
- **Responsibility**: Queries all sessions owned by the authenticated user, dynamically calculating the progress of each session (processed vs total patents) for real-time UI updates.
- **Returns**: List of session summaries.

### `GET /api/sessions/{session_id}`
- **Purpose**: Fetches the complete enriched dataset for a specific session.
- **Responsibility**: Retrieves all `PatentData` records associated with the session. Contains self-healing logic to auto-mark stuck sessions as `completed` if all patent sub-tasks have reached a terminal state (`success` or `failed`).
- **Returns**: Complete session object including an array of detailed patent analysis records.

### `POST /api/sessions/{session_id}/upload`
- **Purpose**: Ingests patent data batches.
- **Responsibility**: Accepts an `.xlsx` file upload, sanitizes and deduplicates the patent numbers using Pandas, pre-populates pending database records, and enqueues the patents into Redis for the Celery Round-Robin dispatcher.

### `GET /api/sessions/{session_id}/export`
- **Purpose**: Generates a downloadable report.
- **Responsibility**: Compiles the deeply nested patent analysis data into a heavily formatted, multi-column Excel spreadsheet using `openpyxl`.

---

## 2. External Integration APIs

These APIs are called asynchronously by the Celery worker threads during the data enrichment pipeline.

### `Wissen Patent API`
- **Endpoint**: `GET {WISSEN_API_BASE_URL}/{patent_number}`
- **Responsibility**: Acts as the foundational data source. Retrieves the patent's abstract, claims, classification codes (CPC), and deeply nested lists of forward and backward citations.

### `OpenAI API (GPT-4o-mini)`
- **Endpoint**: `POST https://api.openai.com/v1/chat/completions`
- **Responsibility**: AI Taxonomy Classification. Analyzes the raw abstract and claims text to extract hierarchical technical domains, topics, and subtopics.

### `Langfuse API`
- **Endpoint**: Background Telemetry via Python SDK
- **Responsibility**: LLM Observability. Silently captures prompt inputs, LLM outputs, latency, and exact token costs for every OpenAI API call. Also manages background curation of evaluation datasets.

### `Sparta Standard API`
- **Endpoint**: `GET {SPARTA_API_URL}?patent_number={id}`
- **Responsibility**: Cross-references the patent number against known telecommunication and technology standards (e.g., 5G, IEEE) and returns related standard documentation links.

### `Competitor ML API`
- **Endpoint**: `POST {COMPETITOR_API_URL}`
- **Responsibility**: Market Analysis. Accepts a list of citation assignees and uses machine learning models to cluster, resolve, and identify primary corporate competitors in the technology space.
