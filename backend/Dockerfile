FROM python:3.12-slim

WORKDIR /app

# Install system dependencies required for building psycopg2 and others
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

EXPOSE 8513

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8513"]
