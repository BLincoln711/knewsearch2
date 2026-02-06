# KnewSearch AEO Visibility Platform - Deployment Guide

This guide provides step-by-step instructions for deploying the KnewSearch platform to Google Cloud Platform.

## Prerequisites

Before you begin, ensure you have:

1. **GCP Project** - A Google Cloud project with billing enabled
2. **gcloud CLI** - Installed and authenticated (`gcloud auth login`)
3. **Terraform** - Version 1.5.0 or later
4. **Docker** - For building container images
5. **Gemini API Key** - From Google AI Studio or Vertex AI

## Deployment Overview

```
┌─────────────────┐
│  1. Bootstrap   │ Enable APIs, create Artifact Registry
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  2. Secrets     │ Add API keys to Secret Manager
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  3. Build       │ Build and push container images
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  4. Deploy      │ Apply Terraform configuration
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  5. Verify      │ Test endpoints and pipeline
└─────────────────┘
```

## Step 1: Bootstrap GCP Project

Run the bootstrap script to enable required APIs and create initial resources:

```bash
# From the project root directory
chmod +x scripts/gcp_bootstrap.sh
./scripts/gcp_bootstrap.sh <your-project-id> us-central1
```

The bootstrap script will:
- Enable all required GCP APIs
- Create an Artifact Registry repository for container images
- Generate `infra/terraform/terraform.tfvars` with your project settings
- Initialize Terraform

### Manual API Enablement (Alternative)

If you prefer to enable APIs manually:

```bash
export PROJECT_ID="your-project-id"

gcloud services enable \
    cloudresourcemanager.googleapis.com \
    iam.googleapis.com \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com \
    bigquery.googleapis.com \
    pubsub.googleapis.com \
    cloudscheduler.googleapis.com \
    aiplatform.googleapis.com \
    generativelanguage.googleapis.com \
    secretmanager.googleapis.com \
    logging.googleapis.com \
    monitoring.googleapis.com \
    --project="${PROJECT_ID}"
```

## Step 2: Configure Secrets

### Add Gemini API Key

1. Get your Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

2. Create a secret version:

```bash
# Create a file with your API key (don't commit this!)
echo -n "your-gemini-api-key" > /tmp/gemini-key.txt

# Add to Secret Manager (the secret is created by Terraform, we just add the version)
gcloud secrets versions add knewsearch-gemini-api-key \
    --data-file=/tmp/gemini-key.txt \
    --project="${PROJECT_ID}"

# Clean up
rm /tmp/gemini-key.txt
```

### Add API Auth Key (for MVP API authentication)

```bash
# Generate a random API key
API_KEY=$(openssl rand -base64 32)
echo -n "${API_KEY}" > /tmp/api-key.txt

# Add to Secret Manager
gcloud secrets versions add knewsearch-api-auth-key \
    --data-file=/tmp/api-key.txt \
    --project="${PROJECT_ID}"

# Save this key for client use
echo "Your API key: ${API_KEY}"

# Clean up
rm /tmp/api-key.txt
```

## Step 3: Build and Push Container Images

### Configure Docker Authentication

```bash
gcloud auth configure-docker us-central1-docker.pkg.dev
```

### Build and Push Images

```bash
export PROJECT_ID="your-project-id"
export REGION="us-central1"
export REPO="knewsearch"
export TAG="latest"

# Build prompt_runner
docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/prompt-runner:${TAG} \
    -f services/prompt_runner/Dockerfile \
    services/prompt_runner

# Build answer_generator
docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/answer-generator:${TAG} \
    -f services/answer_generator/Dockerfile \
    services/answer_generator

# Build parser
docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/parser:${TAG} \
    -f services/parser/Dockerfile \
    services/parser

# Push all images
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/prompt-runner:${TAG}
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/answer-generator:${TAG}
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/parser:${TAG}
```

### Using Cloud Build (Alternative)

You can also build images using Cloud Build:

```bash
# From services/prompt_runner directory
gcloud builds submit \
    --tag ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/prompt-runner:${TAG} \
    .
```

## Step 4: Update Terraform Variables

Edit `infra/terraform/terraform.tfvars` to update the container image references:

```hcl
# Update these to point to your built images
prompt_runner_image    = "us-central1-docker.pkg.dev/your-project-id/knewsearch/prompt-runner:latest"
answer_generator_image = "us-central1-docker.pkg.dev/your-project-id/knewsearch/answer-generator:latest"
parser_image           = "us-central1-docker.pkg.dev/your-project-id/knewsearch/parser:latest"
```

## Step 5: Deploy Infrastructure

### Plan

Review the changes Terraform will make:

```bash
cd infra/terraform
terraform plan
```

### Apply

Deploy the infrastructure:

```bash
terraform apply
```

Type `yes` when prompted to confirm.

### Expected Resources

Terraform will create:

| Resource Type | Count | Description |
|--------------|-------|-------------|
| BigQuery Dataset | 1 | `knewsearch_aeo` |
| BigQuery Tables | 8 | prompts, answer_runs, ai_answers, citations, entities, embeddings, visibility_scores, weekly_summaries |
| Pub/Sub Topics | 6 | 3 main topics + 3 dead letter topics |
| Pub/Sub Subscriptions | 6 | 3 main subscriptions + 3 DLQ subscriptions |
| Cloud Run Services | 3 | prompt_runner, answer_generator, parser |
| Cloud Scheduler Jobs | 2 | daily_prompt_run, weekly_summary (paused) |
| Service Accounts | 8 | One per service + 2 invoker accounts |
| Secret Manager Secrets | 3 | gemini_api_key, vertex_ai_key, api_auth_key |
| IAM Bindings | ~30 | Least privilege access for all services |

## Step 6: Verify Deployment

### Check Cloud Run Services

```bash
# List services
gcloud run services list --region=us-central1 --project=${PROJECT_ID}

# Get service URLs
gcloud run services describe prompt-runner --region=us-central1 --format='value(status.url)'
gcloud run services describe answer-generator --region=us-central1 --format='value(status.url)'
gcloud run services describe parser --region=us-central1 --format='value(status.url)'
```

### Check Health Endpoints

```bash
# Get the prompt_runner URL
PROMPT_RUNNER_URL=$(gcloud run services describe prompt-runner \
    --region=us-central1 \
    --format='value(status.url)')

# Test health endpoint (requires authentication)
curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
    "${PROMPT_RUNNER_URL}/health"
```

### Check BigQuery Tables

```bash
bq ls --project_id=${PROJECT_ID} knewsearch_aeo
```

### Check Pub/Sub Topics

```bash
gcloud pubsub topics list --project=${PROJECT_ID}
```

### Check Cloud Scheduler

```bash
gcloud scheduler jobs list --location=us-central1 --project=${PROJECT_ID}
```

## Step 7: Seed Initial Data (Optional)

### Add Sample Prompts

```sql
-- Run in BigQuery console or using bq command
INSERT INTO `your-project-id.knewsearch_aeo.prompts`
(prompt_id, prompt_text, category, brand, keywords, is_active, created_at, updated_at)
VALUES
('prm_001', 'What is the best CRM software for small businesses?', 'brand', 'Acme Corp', ['CRM', 'small business'], TRUE, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP()),
('prm_002', 'Compare Salesforce vs HubSpot vs Zoho CRM', 'competitor', 'Acme Corp', ['CRM', 'comparison'], TRUE, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP()),
('prm_003', 'What are the top CRM trends in 2025?', 'industry', 'Acme Corp', ['CRM', 'trends'], TRUE, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP());
```

## Step 8: Trigger a Test Run

### Manual Trigger via Cloud Scheduler

```bash
gcloud scheduler jobs run knewsearch-daily-prompt-run \
    --location=us-central1 \
    --project=${PROJECT_ID}
```

### Manual Trigger via HTTP

```bash
PROMPT_RUNNER_URL=$(gcloud run services describe prompt-runner \
    --region=us-central1 \
    --format='value(status.url)')

curl -X POST \
    -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
    -H "Content-Type: application/json" \
    -d '{"run_type": "manual", "triggered_by": "test"}' \
    "${PROMPT_RUNNER_URL}/run"
```

## Monitoring

### View Logs

```bash
# View prompt_runner logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=prompt-runner" \
    --project=${PROJECT_ID} \
    --limit=50

# View all pipeline logs
gcloud logging read "resource.type=cloud_run_revision" \
    --project=${PROJECT_ID} \
    --limit=100
```

### Check Dead Letter Queues

```bash
# List messages in DLQ (for debugging failed messages)
gcloud pubsub subscriptions pull prompt_run_requested-dlq-sub \
    --project=${PROJECT_ID} \
    --limit=10
```

## Troubleshooting

### Common Issues

1. **Permission Denied errors**
   - Ensure all service accounts have the correct IAM bindings
   - Check that secrets have been created with versions

2. **Cloud Run services not starting**
   - Check that container images exist and are accessible
   - Review Cloud Run logs for startup errors

3. **Pub/Sub messages not being delivered**
   - Verify subscription push endpoints are correct
   - Check that the pubsub_invoker service account can invoke Cloud Run

4. **BigQuery write failures**
   - Ensure tables exist with correct schemas
   - Verify service accounts have dataEditor role

### Useful Commands

```bash
# Check service account permissions
gcloud projects get-iam-policy ${PROJECT_ID} \
    --flatten="bindings[].members" \
    --filter="bindings.members:knewsearch-*"

# Describe a Cloud Run service
gcloud run services describe prompt-runner --region=us-central1

# Test a Pub/Sub subscription
gcloud pubsub subscriptions pull answer-generator-sub --limit=1
```

## Updating Services

To update a service after code changes:

```bash
# Rebuild and push the image
docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/prompt-runner:${TAG} \
    services/prompt_runner
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/prompt-runner:${TAG}

# Update Cloud Run service
gcloud run services update prompt-runner \
    --image=${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/prompt-runner:${TAG} \
    --region=us-central1
```

Or re-run Terraform:

```bash
cd infra/terraform
terraform apply
```

## Cleanup

To destroy all resources:

```bash
cd infra/terraform
terraform destroy
```

**Warning**: This will delete all data including BigQuery tables. Back up important data first.

## Cost Estimation

| Resource | Estimated Monthly Cost (dev) |
|----------|------------------------------|
| Cloud Run | $0-10 (scale to zero) |
| BigQuery | $0-5 (first 10GB free) |
| Pub/Sub | $0-1 (first 10GB free) |
| Cloud Scheduler | $0 (3 jobs free) |
| Secret Manager | $0 (6 active secrets free) |
| **Total** | **$0-20/month** |

Production costs will vary based on:
- Number of prompts processed daily
- Gemini API usage (separate billing)
- Data retention policies
- Cloud Run instance sizes
