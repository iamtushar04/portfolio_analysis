# End-to-End System Flow

This document details the complete lifecycle of a patent batch analysis, from the moment a user uploads an Excel file to the generation of the final enriched report.

## 1. Data Ingestion & Sanitization
1. **User Action**: The user selects a `.xlsx` file containing a column of patent numbers on the Next.js frontend and initiates the upload.
2. **API Reception**: The FastAPI `POST /upload` endpoint receives the file as a binary stream.
3. **Pandas Processing**: The backend reads the Excel file into memory using `pandas`, extracts the first column, and performs sanitization:
   - Stripping whitespace
   - Removing null/NaN values
   - Deduplicating patent numbers while preserving their original order
4. **Database Pre-population**: For every valid patent number, a "pending" row is inserted into the PostgreSQL `PatentData` table.
5. **Queueing**: The patent numbers are pushed into a Redis List specifically keyed to the current `session_id`.

## 2. Round-Robin Dispatching
To guarantee multi-user fairness, the system employs a custom dispatcher:
1. **Dispatcher Task**: A lightweight Celery task wakes up periodically.
2. **Session Iteration**: It iterates through the set of all "active" user sessions in Redis.
3. **Fair Queuing**: It pops exactly **one** patent from each user's queue and drops it into the main worker execution pool (`process_patent_task.delay()`).
4. **Looping**: It repeats this round-robin loop until all patents for all active users are queued for background processing.

## 3. The Data Enrichment Pipeline
Each `process_patent_task` runs in total isolation inside a Celery OS thread. The pipeline executes the following steps sequentially for a single patent:

### Step 3a: Wissen Base Data Fetch
- The worker queries the external Wissen API.
- **Outputs extracted**: Title, abstract, claims, assignees, and deduplicated lists of forward/backward citations.

### Step 3b: AI Taxonomy Classification
- The worker takes the abstract, claims (truncated to 2000 chars for token limits), and CPC codes, and constructs a strict prompt.
- The prompt is sent to OpenAI's GPT-4o-mini model.
- **Output**: A parsed JSON array of hierarchical `[Domain -> Topic -> Subtopic]`.
- **Observability**: The exact prompt, latency, and token cost are asynchronously logged to Langfuse.

### Step 3c: Standard Mapping
- The patent number (with its trailing kind code stripped, e.g., `US12345` instead of `US12345B2`) is sent to the Sparta API.
- **Output**: Known technological standards (e.g., IEEE) and related hyperlinks.

### Step 3d: Competitor Analysis (Concurrent)
- The worker aggregates the raw assignees from all forward citations into one set, and all backward citations into another.
- It launches **two parallel asynchronous HTTP requests** to the external Competitor ML API using `asyncio.gather()`.
- **Concurrency Control**: These requests are gated by a global `threading.Semaphore(3)` to protect the external ML API from being overwhelmed by too many simultaneous requests across the Celery thread pool.
- **Output**: Resolved lists of Forward Competitors and Backward Competitors.

## 4. Finalization & Database Commit
1. **Assembly**: All the enriched data points from the 4 external APIs are assembled into a single Python dictionary.
2. **Commit**: The corresponding "pending" row in the PostgreSQL database is updated with the enriched JSON payloads and its status is flipped to `success`.
3. **Session Check**: The system counts the number of completed/failed patents for the current session. If the count matches the total expected, the session status is flipped to `completed`.

## 5. Report Generation
1. **User Action**: The user clicks "Export" on the frontend.
2. **Excel Assembly**: The FastAPI backend dynamically generates an `.xlsx` file using `openpyxl`. Complex nested JSON data (like multiple taxonomies or competitor lists) are flattened into readable comma-separated strings or cleanly formatted columns.
3. **Delivery**: The file is streamed back to the browser for download.
