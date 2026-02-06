# -----------------------------------------------------------------------------
# IAM Bindings - Least Privilege per Service
# -----------------------------------------------------------------------------

# -----------------------------------------------------------------------------
# BigQuery IAM
# -----------------------------------------------------------------------------

# prompt_runner: Read prompts table
resource "google_project_iam_member" "prompt_runner_bq_reader" {
  project = var.project_id
  role    = "roles/bigquery.dataViewer"
  member  = "serviceAccount:${google_service_account.prompt_runner.email}"

  condition {
    title      = "prompt_runner_bq_access"
    expression = "resource.name.startsWith(\"projects/${var.project_id}/datasets/${var.bigquery_dataset_id}\")"
  }
}

resource "google_project_iam_member" "prompt_runner_bq_job" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${google_service_account.prompt_runner.email}"
}

# answer_generator: Write to ai_answers, answer_runs tables
resource "google_project_iam_member" "answer_generator_bq_writer" {
  project = var.project_id
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:${google_service_account.answer_generator.email}"

  condition {
    title      = "answer_generator_bq_access"
    expression = "resource.name.startsWith(\"projects/${var.project_id}/datasets/${var.bigquery_dataset_id}\")"
  }
}

resource "google_project_iam_member" "answer_generator_bq_job" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${google_service_account.answer_generator.email}"
}

# parser: Write to citations, entities, embeddings tables
resource "google_project_iam_member" "parser_bq_writer" {
  project = var.project_id
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:${google_service_account.parser.email}"

  condition {
    title      = "parser_bq_access"
    expression = "resource.name.startsWith(\"projects/${var.project_id}/datasets/${var.bigquery_dataset_id}\")"
  }
}

resource "google_project_iam_member" "parser_bq_job" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${google_service_account.parser.email}"
}

# scoring: Read/write visibility_scores
resource "google_project_iam_member" "scoring_bq_editor" {
  project = var.project_id
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:${google_service_account.scoring.email}"

  condition {
    title      = "scoring_bq_access"
    expression = "resource.name.startsWith(\"projects/${var.project_id}/datasets/${var.bigquery_dataset_id}\")"
  }
}

resource "google_project_iam_member" "scoring_bq_job" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${google_service_account.scoring.email}"
}

# weekly_summary: Read/write BigQuery
resource "google_project_iam_member" "weekly_summary_bq_editor" {
  project = var.project_id
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:${google_service_account.weekly_summary.email}"

  condition {
    title      = "weekly_summary_bq_access"
    expression = "resource.name.startsWith(\"projects/${var.project_id}/datasets/${var.bigquery_dataset_id}\")"
  }
}

resource "google_project_iam_member" "weekly_summary_bq_job" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${google_service_account.weekly_summary.email}"
}

# api_gateway: Read/write prompts, read scores
resource "google_project_iam_member" "api_gateway_bq_editor" {
  project = var.project_id
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:${google_service_account.api_gateway.email}"

  condition {
    title      = "api_gateway_bq_access"
    expression = "resource.name.startsWith(\"projects/${var.project_id}/datasets/${var.bigquery_dataset_id}\")"
  }
}

resource "google_project_iam_member" "api_gateway_bq_job" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${google_service_account.api_gateway.email}"
}

# -----------------------------------------------------------------------------
# Pub/Sub IAM
# -----------------------------------------------------------------------------

# prompt_runner: Publish to prompt_run_requested topic
resource "google_pubsub_topic_iam_member" "prompt_runner_publisher" {
  topic  = google_pubsub_topic.prompt_run_requested.name
  role   = "roles/pubsub.publisher"
  member = "serviceAccount:${google_service_account.prompt_runner.email}"
}

# answer_generator: Publish to answer_generated topic
resource "google_pubsub_topic_iam_member" "answer_generator_publisher" {
  topic  = google_pubsub_topic.answer_generated.name
  role   = "roles/pubsub.publisher"
  member = "serviceAccount:${google_service_account.answer_generator.email}"
}

# parser: Publish to answer_parsed topic
resource "google_pubsub_topic_iam_member" "parser_publisher" {
  topic  = google_pubsub_topic.answer_parsed.name
  role   = "roles/pubsub.publisher"
  member = "serviceAccount:${google_service_account.parser.email}"
}

# scoring: Subscribe to answer_parsed topic (pull subscription)
resource "google_pubsub_subscription_iam_member" "scoring_subscriber" {
  subscription = google_pubsub_subscription.scoring_sub.name
  role         = "roles/pubsub.subscriber"
  member       = "serviceAccount:${google_service_account.scoring.email}"
}

# Pub/Sub service account needs to publish to dead letter topics
resource "google_pubsub_topic_iam_member" "pubsub_dlq_prompt_run" {
  topic  = google_pubsub_topic.prompt_run_requested_dlq.name
  role   = "roles/pubsub.publisher"
  member = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

resource "google_pubsub_topic_iam_member" "pubsub_dlq_answer_generated" {
  topic  = google_pubsub_topic.answer_generated_dlq.name
  role   = "roles/pubsub.publisher"
  member = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

resource "google_pubsub_topic_iam_member" "pubsub_dlq_answer_parsed" {
  topic  = google_pubsub_topic.answer_parsed_dlq.name
  role   = "roles/pubsub.publisher"
  member = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

# -----------------------------------------------------------------------------
# Vertex AI IAM
# -----------------------------------------------------------------------------

# parser: Use Vertex AI for embeddings
resource "google_project_iam_member" "parser_vertex_user" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.parser.email}"
}

# weekly_summary: Use Vertex AI for summary generation (optional)
resource "google_project_iam_member" "weekly_summary_vertex_user" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.weekly_summary.email}"
}

# -----------------------------------------------------------------------------
# Cloud Run IAM - Service-to-Service
# -----------------------------------------------------------------------------

# All services need to be able to log
resource "google_project_iam_member" "prompt_runner_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.prompt_runner.email}"
}

resource "google_project_iam_member" "answer_generator_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.answer_generator.email}"
}

resource "google_project_iam_member" "parser_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.parser.email}"
}

resource "google_project_iam_member" "scoring_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.scoring.email}"
}

resource "google_project_iam_member" "weekly_summary_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.weekly_summary.email}"
}

resource "google_project_iam_member" "api_gateway_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.api_gateway.email}"
}

# -----------------------------------------------------------------------------
# Data source for project number (needed for Pub/Sub service account)
# -----------------------------------------------------------------------------

data "google_project" "current" {
  project_id = var.project_id
}
