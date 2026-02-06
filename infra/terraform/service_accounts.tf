# -----------------------------------------------------------------------------
# Service Accounts - Least Privilege per Service
# -----------------------------------------------------------------------------

# prompt_runner: reads prompts, publishes to Pub/Sub
resource "google_service_account" "prompt_runner" {
  account_id   = "knewsearch-prompt-runner"
  display_name = "KnewSearch Prompt Runner"
  description  = "Service account for prompt_runner service"
}

# answer_generator: consumes Pub/Sub, calls Gemini, writes to BigQuery
resource "google_service_account" "answer_generator" {
  account_id   = "knewsearch-answer-gen"
  display_name = "KnewSearch Answer Generator"
  description  = "Service account for answer_generator service"
}

# parser: consumes Pub/Sub, calls Vertex AI, writes to BigQuery
resource "google_service_account" "parser" {
  account_id   = "knewsearch-parser"
  display_name = "KnewSearch Parser"
  description  = "Service account for parser service"
}

# scoring: reads/writes BigQuery
resource "google_service_account" "scoring" {
  account_id   = "knewsearch-scoring"
  display_name = "KnewSearch Scoring"
  description  = "Service account for scoring service"
}

# weekly_summary: reads BigQuery, calls Gemini, writes to BigQuery
resource "google_service_account" "weekly_summary" {
  account_id   = "knewsearch-weekly-summary"
  display_name = "KnewSearch Weekly Summary"
  description  = "Service account for weekly_summary service"
}

# api_gateway: reads/writes prompts, reads scores
resource "google_service_account" "api_gateway" {
  account_id   = "knewsearch-api-gateway"
  display_name = "KnewSearch API Gateway"
  description  = "Service account for api_gateway service"
}

# -----------------------------------------------------------------------------
# Invoker Service Accounts (for Pub/Sub push and Cloud Scheduler)
# -----------------------------------------------------------------------------

# pubsub_invoker: Used by Pub/Sub to invoke Cloud Run services
resource "google_service_account" "pubsub_invoker" {
  account_id   = "knewsearch-pubsub-invoker"
  display_name = "KnewSearch Pub/Sub Invoker"
  description  = "Service account for Pub/Sub push subscriptions to invoke Cloud Run"
}

# scheduler_invoker: Used by Cloud Scheduler to invoke Cloud Run services
resource "google_service_account" "scheduler_invoker" {
  account_id   = "knewsearch-scheduler-invoker"
  display_name = "KnewSearch Scheduler Invoker"
  description  = "Service account for Cloud Scheduler to invoke Cloud Run"
}
