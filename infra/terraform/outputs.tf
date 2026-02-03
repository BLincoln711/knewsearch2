output "project_id" {
  description = "GCP project ID"
  value       = var.project_id
}

output "region" {
  description = "GCP region"
  value       = var.region
}

output "service_account_emails" {
  description = "Service account emails for each service"
  value = {
    prompt_runner    = google_service_account.prompt_runner.email
    answer_generator = google_service_account.answer_generator.email
    parser           = google_service_account.parser.email
    scoring          = google_service_account.scoring.email
    weekly_summary   = google_service_account.weekly_summary.email
    api_gateway      = google_service_account.api_gateway.email
  }
}

output "secret_ids" {
  description = "Secret Manager secret IDs"
  value = {
    gemini_api_key = google_secret_manager_secret.gemini_api_key.secret_id
    api_auth_key   = google_secret_manager_secret.api_auth_key.secret_id
  }
}
