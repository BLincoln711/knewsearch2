# -----------------------------------------------------------------------------
# Secret Manager - Secrets
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

# Vertex AI Service Account Key (if using service account auth instead of ADC)
resource "google_secret_manager_secret" "vertex_ai_key" {
  secret_id = "knewsearch-vertex-ai-key"

  replication {
    auto {}
  }

  labels = {
    environment = var.environment
    service     = "parser"
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
# Secret Accessor IAM
# -----------------------------------------------------------------------------

# answer_generator: Access Gemini API key
resource "google_secret_manager_secret_iam_member" "answer_generator_gemini_key" {
  secret_id = google_secret_manager_secret.gemini_api_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.answer_generator.email}"
}

# weekly_summary: Access Gemini API key (for summary generation)
resource "google_secret_manager_secret_iam_member" "weekly_summary_gemini_key" {
  secret_id = google_secret_manager_secret.gemini_api_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.weekly_summary.email}"
}

# parser: Access Vertex AI key (if not using ADC)
resource "google_secret_manager_secret_iam_member" "parser_vertex_key" {
  secret_id = google_secret_manager_secret.vertex_ai_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.parser.email}"
}

# api_gateway: Access API auth key
resource "google_secret_manager_secret_iam_member" "api_gateway_auth_key" {
  secret_id = google_secret_manager_secret.api_auth_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.api_gateway.email}"
}
