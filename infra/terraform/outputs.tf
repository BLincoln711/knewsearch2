output "project_id" {
  description = "GCP project ID"
  value       = var.project_id
}

output "region" {
  description = "GCP region"
  value       = var.region
}

# -----------------------------------------------------------------------------
# Service Account Outputs
# -----------------------------------------------------------------------------

output "service_account_emails" {
  description = "Service account emails for each service"
  value = {
    prompt_runner      = google_service_account.prompt_runner.email
    answer_generator   = google_service_account.answer_generator.email
    parser             = google_service_account.parser.email
    scoring            = google_service_account.scoring.email
    weekly_summary     = google_service_account.weekly_summary.email
    api_gateway        = google_service_account.api_gateway.email
    pubsub_invoker     = google_service_account.pubsub_invoker.email
    scheduler_invoker  = google_service_account.scheduler_invoker.email
  }
}

# -----------------------------------------------------------------------------
# Secret Manager Outputs
# -----------------------------------------------------------------------------

output "secret_ids" {
  description = "Secret Manager secret IDs"
  value = {
    gemini_api_key = google_secret_manager_secret.gemini_api_key.secret_id
    vertex_ai_key  = google_secret_manager_secret.vertex_ai_key.secret_id
    api_auth_key   = google_secret_manager_secret.api_auth_key.secret_id
  }
}

# -----------------------------------------------------------------------------
# BigQuery Outputs
# -----------------------------------------------------------------------------

output "bigquery_dataset_id" {
  description = "BigQuery dataset ID"
  value       = google_bigquery_dataset.knewsearch.dataset_id
}

output "bigquery_tables" {
  description = "BigQuery table IDs"
  value = {
    prompts           = google_bigquery_table.prompts.table_id
    answer_runs       = google_bigquery_table.answer_runs.table_id
    ai_answers        = google_bigquery_table.ai_answers.table_id
    citations         = google_bigquery_table.citations.table_id
    entities          = google_bigquery_table.entities.table_id
    embeddings        = google_bigquery_table.embeddings.table_id
    visibility_scores = google_bigquery_table.visibility_scores.table_id
    weekly_summaries  = google_bigquery_table.weekly_summaries.table_id
  }
}

# -----------------------------------------------------------------------------
# Pub/Sub Outputs
# -----------------------------------------------------------------------------

output "pubsub_topics" {
  description = "Pub/Sub topic names"
  value = {
    prompt_run_requested = google_pubsub_topic.prompt_run_requested.name
    answer_generated     = google_pubsub_topic.answer_generated.name
    answer_parsed        = google_pubsub_topic.answer_parsed.name
  }
}

output "pubsub_subscriptions" {
  description = "Pub/Sub subscription names"
  value = {
    answer_generator = google_pubsub_subscription.answer_generator_sub.name
    parser           = google_pubsub_subscription.parser_sub.name
    scoring          = google_pubsub_subscription.scoring_sub.name
  }
}

# -----------------------------------------------------------------------------
# Cloud Run Outputs
# -----------------------------------------------------------------------------

output "cloud_run_urls" {
  description = "Cloud Run service URLs"
  value = {
    prompt_runner    = google_cloud_run_v2_service.prompt_runner.uri
    answer_generator = google_cloud_run_v2_service.answer_generator.uri
    parser           = google_cloud_run_v2_service.parser.uri
  }
}

# -----------------------------------------------------------------------------
# Cloud Scheduler Outputs
# -----------------------------------------------------------------------------

output "scheduler_jobs" {
  description = "Cloud Scheduler job names"
  value = {
    daily_prompt_run = google_cloud_scheduler_job.daily_prompt_run.name
    weekly_summary   = google_cloud_scheduler_job.weekly_summary_run.name
  }
}
