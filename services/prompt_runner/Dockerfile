FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY main.py .

# Set environment variables
ENV PORT=8080
ENV SERVICE_NAME=prompt_runner
ENV LOG_LEVEL=INFO

# Run the application
CMD ["python", "main.py"]
