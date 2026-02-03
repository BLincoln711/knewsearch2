FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY main.py .

# Run as non-root user
RUN useradd -m -u 1000 appuser
USER appuser

# Cloud Run sets PORT environment variable
ENV PORT=8080

EXPOSE 8080

CMD ["python", "main.py"]
