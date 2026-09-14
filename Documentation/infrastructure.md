# Infrastructure & Deployment

This document covers the infrastructure components, Docker networking, and deployment topology used to run the Patent Portfolio Analysis platform in a production environment.

## Deployment Topology

The application is fully containerized using Docker and is orchestrated via Docker Compose. The production environment assumes a single-node Linux server deployment (currently hosted at `135.181.19.83`).

### Containers

1. **`portfolio_frontend`**
   - **Base Image**: `node:20-alpine`
   - **Port**: `8511` (Mapped `8511:8511` to the host)
   - **Environment Variables**: Points to the external auth server and the backend API (`NEXT_PUBLIC_API_URL=http://135.181.19.83:8513`). Built entirely at compile-time by Next.js.
   - **Restart Policy**: `unless-stopped`

2. **`portfolio_backend`**
   - **Base Image**: `python:3.12-slim`
   - **Port**: `8513` (Mapped `8513:8513` to the host)
   - **Server**: Uvicorn running FastAPI.
   - **Restart Policy**: `unless-stopped`

3. **`portfolio_celery_worker`**
   - **Base Image**: `python:3.12-slim` (Shares the exact same Dockerfile build context as the backend to ensure identical environment parity).
   - **Port**: None exposed. Operates purely in the background listening to Redis.
   - **Command**: `celery -A app.celery_app worker --concurrency=4 --pool=threads --loglevel=info`
   - **Restart Policy**: `unless-stopped`

### Host Infrastructure Dependencies

The application relies on two stateful services that are hosted directly on the underlying Linux server (outside of this specific Docker compose stack):

1. **PostgreSQL** (`135.181.19.83:5432`): The primary relational database.
2. **Redis** (`135.181.19.83:6379`): In-memory datastore used exclusively as the Celery message broker and result backend.

## Docker Networking

The stack utilizes an automatic Docker bridge network named `portfolio_analysis_default`.

### Internal vs External Routing
- **Container-to-Container**: The frontend container communicates with the backend container using standard Docker DNS resolution (`http://backend:8513`).
- **Container-to-Host**: To communicate with services running directly on the Linux host machine (such as the external Competitor API running on port 8509), containers use the Docker bridge gateway IP: `172.17.0.1`. This bypasses strict "hairpin" routing firewall rules that block containers from accessing their own host's public IP.

## Scaling the Infrastructure

The infrastructure is designed for horizontal scalability, specifically at the worker layer.

### Vertical Scaling (Single Server)
To increase patent processing throughput on the existing server, you can modify the `concurrency` flag on the Celery worker in `docker-compose.yml`:
```yaml
command: celery -A app.celery_app worker --concurrency=8 --pool=threads
```
Because the tasks are heavily I/O bound (waiting on external APIs) and utilize Python's `threading` module, you can safely set the concurrency to a high number (e.g., 16 or 32) without maxing out the host CPU, provided the external APIs do not rate limit the system.

### Horizontal Scaling (Multi-Server)
To process millions of patents, the architecture supports true horizontal scaling:
1. Spin up additional Linux servers.
2. Deploy only the `portfolio_celery_worker` container to those new servers.
3. Point their `.env` files to the central Redis broker (`135.181.19.83:6379`) and PostgreSQL database.
4. The workers will automatically join the pool and begin pulling patents off the central queue.
