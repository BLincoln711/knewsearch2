FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY services/scoring/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY services/scoring/main.py .

# Copy SQL templates
COPY sql/scoring/ /app/sql/scoring/

# Run as non-root user
RUN useradd -m -u 1000 appuser
USER appuser

# Cloud Run sets PORT environment variable
ENV PORT=8080

# SQL_DIR should be set at runtime or during deployment
# Default expects SQL files mounted or copied during build from repo root
ENV SQL_DIR=/app/sql/scoring

EXPOSE 8080

CMD ["python", "main.py"]
