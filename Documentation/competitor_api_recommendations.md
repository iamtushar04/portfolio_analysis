# Competitor API Integration: Scalability & Optimization Feedback

This document outlines the current integration architecture between our Patent Analysis Platform and your Competitor API. It includes technical context regarding how we consume your endpoints and key questions/suggestions to help optimize both sides of the infrastructure for scale.

## 1. Current Integration Context

Our platform analyzes batches of patents asynchronously using a Celery distributed task queue backed by a thread pool. 

For every single patent processed, our system makes **two concurrent HTTP POST requests** to your API:
1. One request for Forward Citation Assignees.
2. One request for Backward Citation Assignees.

### Active Throttling (The Semaphore)
To protect your infrastructure from being overwhelmed during large batch uploads (e.g., a user uploading 1,000 patents at once), we have implemented a strict client-side throttle. We use a global `threading.Semaphore(3)` which guarantees that **our backend will never send more than 3 simultaneous HTTP requests to your API** at any given millisecond.

### Connection Timeouts
Currently, we have set our HTTP read timeout to `Infinity`. We keep the connection alive for as long as your ML model takes to return a response.

---

## 2. Questions for Your Team

To help us tune our infrastructure and speed up patent processing for our end users, please provide feedback on the following:

**Q1: Maximum Safe Concurrency**
Can your infrastructure handle 10, 20, or 50+ concurrent HTTP requests without timing out or degrading performance? 
*Impact: If yes, we can increase our Semaphore limit and dramatically speed up the overall processing time on our end.*

**Q2: Expected Latency Benchmarks**
What is the 95th percentile expected response time (latency) for a standard payload?
*Impact: Knowing this will allow us to configure strict connection timeouts instead of keeping sockets open indefinitely, saving memory and preventing zombie connections on both of our servers.*

---

## 3. Future Optimization Suggestions

If you are looking to improve the API for heavy integrations like ours, here are two industry-standard patterns that would drastically reduce overhead:

### A. Batch Processing Endpoint (Highly Recommended)
Currently, if a user uploads 1,000 patents, we must execute 2,000 separate HTTP POST requests to your API over the network. 
- **Suggestion**: Implement a `/batch-competitor-search` endpoint that accepts an array of payloads (e.g., up to 50 assignee lists at once) and returns an array of results. 
- **Benefit**: This would eliminate 98% of the HTTP overhead, TCP handshakes, and network latency for both of our systems.

### B. Asynchronous Webhook Pattern
Because your machine learning models may take several seconds or longer to run:
- **Suggestion**: Adopt an async webhook architecture. We would send a POST request with the data and a `callback_url`. Your API would immediately return an HTTP `202 Accepted`. Once your ML model finishes processing, your server sends the final JSON payload back to our `callback_url`.
- **Benefit**: This prevents our servers from keeping hundreds of HTTP connections open waiting for processing to finish, significantly reducing memory strain.
