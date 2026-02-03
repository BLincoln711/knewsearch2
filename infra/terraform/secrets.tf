# -----------------------------------------------------------------------------
# Secret Manager - Placeholder Secrets
# -----------------------------------------------------------------------------

# Gemini API Key
resource "google_secret_manager_secret" "gemini_api_key" {
  secret_id = "knewsearch-gemini-api-key"

  replication {
    auto {}
  }

  labels = {
    environment = var.environment
    service     = "answer-generator"
  }
}

# API Gateway Auth Key (simple API key for MVP)
resource "google_secret_manager_secret" "api_auth_key" {
  secret_id = "knewsearch-api-auth-key"

  replication {
    auto {}
  }

  labels = {
    environment = var.environment
    service     = "api-gateway"
  }
}

# -----------------------------------------------------------------------------
# Secret Accessor IAM - Placeholder
# -----------------------------------------------------------------------------

# TODO: Grant secret accessor roles to service accounts when services are deployed
# Example:
# resource "google_secret_manager_secret_iam_member" "answer_generator_gemini_key" {
#   secret_id = google_secret_manager_secret.gemini_api_key.secret_id
#   role      = "roles/secretmanager.secretAccessor"
#   member    = "serviceAccount:${google_service_account.answer_generator.email}"
# }
