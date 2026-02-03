#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Enable required GCP APIs for KnewSearch AEO Visibility Platform
# Usage: ./scripts/enable_apis.sh <PROJECT_ID>
# -----------------------------------------------------------------------------

set -euo pipefail

PROJECT_ID="${1:-}"

if [[ -z "$PROJECT_ID" ]]; then
  echo "Usage: $0 <PROJECT_ID>"
  exit 1
fi

echo "Enabling APIs for project: $PROJECT_ID"

APIS=(
  # Compute
  "run.googleapis.com"                    # Cloud Run
  "cloudscheduler.googleapis.com"         # Cloud Scheduler

  # Messaging
  "pubsub.googleapis.com"                 # Pub/Sub

  # Storage
  "bigquery.googleapis.com"               # BigQuery
  "bigquerystorage.googleapis.com"        # BigQuery Storage API

  # AI/ML
  "aiplatform.googleapis.com"             # Vertex AI (embeddings)
  "generativelanguage.googleapis.com"     # Gemini API

  # Security
  "secretmanager.googleapis.com"          # Secret Manager
  "iam.googleapis.com"                    # IAM

  # Operations
  "logging.googleapis.com"                # Cloud Logging
  "monitoring.googleapis.com"             # Cloud Monitoring
  "cloudtrace.googleapis.com"             # Cloud Trace

  # Build & Deploy
  "cloudbuild.googleapis.com"             # Cloud Build
  "artifactregistry.googleapis.com"       # Artifact Registry
)

for api in "${APIS[@]}"; do
  echo "Enabling $api..."
  gcloud services enable "$api" --project="$PROJECT_ID"
done

echo "All APIs enabled successfully."
