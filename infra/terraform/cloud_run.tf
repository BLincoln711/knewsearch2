# -----------------------------------------------------------------------------
# Cloud Run Services
# -----------------------------------------------------------------------------

# prompt_runner - Reads prompts, publishes to Pub/Sub
resource "google_cloud_run_v2_service" "prompt_runner" {
  name     = "prompt-runner"
  location = var.region

  template {
    service_account = google_service_account.prompt_runner.email

    scaling {
      min_instance_count = 0
      max_instance_count = var.cloud_run_max_instances
    }

    timeout = "300s"

    containers {
      image = var.prompt_runner_image

      resources {
        limits = {
          cpu    = var.cloud_run_cpu
          memory = var.cloud_run_memory
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      # Environment variables
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "GCP_REGION"
        value = var.region
      }
      env {
        name  = "BQ_DATASET"
        value = var.bigquery_dataset_id
      }
      env {
        name  = "PUBSUB_TOPIC_PROMPT_RUN"
        value = google_pubsub_topic.prompt_run_requested.name
      }
      env {
        name  = "SERVICE_NAME"
        value = "prompt_runner"
      }
      env {
        name  = "LOG_LEVEL"
        value = var.log_level
      }

      # Health check
      startup_probe {
        http_get {
          path = "/health"
        }
        initial_delay_seconds = 5
        period_seconds        = 10
        failure_threshold     = 3
      }

      liveness_probe {
        http_get {
          path = "/health"
        }
        period_seconds    = 30
        failure_threshold = 3
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  labels = {
    environment = var.environment
    service     = "prompt-runner"
  }

  depends_on = [
    google_project_iam_member.prompt_runner_bq_reader,
    google_pubsub_topic_iam_member.prompt_runner_publisher
  ]
}

# answer_generator - Consumes Pub/Sub, calls Gemini, writes to BigQuery
resource "google_cloud_run_v2_service" "answer_generator" {
  name     = "answer-generator"
  location = var.region

  template {
    service_account = google_service_account.answer_generator.email

    scaling {
      min_instance_count = 0
      max_instance_count = var.cloud_run_max_instances
    }

    timeout = "300s"

    containers {
      image = var.answer_generator_image

      resources {
        limits = {
          cpu    = var.cloud_run_cpu
          memory = var.cloud_run_memory
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      # Environment variables
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "GCP_REGION"
        value = var.region
      }
      env {
        name  = "BQ_DATASET"
        value = var.bigquery_dataset_id
      }
      env {
        name  = "PUBSUB_TOPIC_ANSWER_GENERATED"
        value = google_pubsub_topic.answer_generated.name
      }
      env {
        name  = "GEMINI_MODEL"
        value = var.gemini_model
      }
      env {
        name  = "SERVICE_NAME"
        value = "answer_generator"
      }
      env {
        name  = "LOG_LEVEL"
        value = var.log_level
      }

      # Gemini API Key from Secret Manager
      env {
        name = "GEMINI_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.gemini_api_key.secret_id
            version = "latest"
          }
        }
      }

      # Health check
      startup_probe {
        http_get {
          path = "/health"
        }
        initial_delay_seconds = 5
        period_seconds        = 10
        failure_threshold     = 3
      }

      liveness_probe {
        http_get {
          path = "/health"
        }
        period_seconds    = 30
        failure_threshold = 3
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  labels = {
    environment = var.environment
    service     = "answer-generator"
  }

  depends_on = [
    google_secret_manager_secret_iam_member.answer_generator_gemini_key,
    google_project_iam_member.answer_generator_bq_writer,
    google_pubsub_topic_iam_member.answer_generator_publisher
  ]
}

# parser - Consumes Pub/Sub, extracts citations/entities, calls Vertex AI, writes to BigQuery
resource "google_cloud_run_v2_service" "parser" {
  name     = "parser"
  location = var.region

  template {
    service_account = google_service_account.parser.email

    scaling {
      min_instance_count = 0
      max_instance_count = var.cloud_run_max_instances
    }

    timeout = "300s"

    containers {
      image = var.parser_image

      resources {
        limits = {
          cpu    = var.cloud_run_cpu
          memory = var.cloud_run_memory
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      # Environment variables
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "GCP_REGION"
        value = var.region
      }
      env {
        name  = "GCP_LOCATION"
        value = var.region
      }
      env {
        name  = "BQ_DATASET"
        value = var.bigquery_dataset_id
      }
      env {
        name  = "PUBSUB_TOPIC_ANSWER_PARSED"
        value = google_pubsub_topic.answer_parsed.name
      }
      env {
        name  = "EMBEDDING_MODEL"
        value = var.embedding_model
      }
      env {
        name  = "EMBEDDING_DIMENSION"
        value = tostring(var.embedding_dimension)
      }
      env {
        name  = "SERVICE_NAME"
        value = "parser"
      }
      env {
        name  = "LOG_LEVEL"
        value = var.log_level
      }

      # Health check
      startup_probe {
        http_get {
          path = "/health"
        }
        initial_delay_seconds = 5
        period_seconds        = 10
        failure_threshold     = 3
      }

      liveness_probe {
        http_get {
          path = "/health"
        }
        period_seconds    = 30
        failure_threshold = 3
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  labels = {
    environment = var.environment
    service     = "parser"
  }

  depends_on = [
    google_project_iam_member.parser_bq_writer,
    google_project_iam_member.parser_vertex_user,
    google_pubsub_topic_iam_member.parser_publisher
  ]
}

# -----------------------------------------------------------------------------
# Cloud Run IAM - Allow Pub/Sub to invoke services
# -----------------------------------------------------------------------------

# Allow Pub/Sub invoker service account to invoke answer_generator
resource "google_cloud_run_v2_service_iam_member" "answer_generator_pubsub_invoker" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.answer_generator.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.pubsub_invoker.email}"
}

# Allow Pub/Sub invoker service account to invoke parser
resource "google_cloud_run_v2_service_iam_member" "parser_pubsub_invoker" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.parser.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.pubsub_invoker.email}"
}

# Allow Cloud Scheduler service account to invoke prompt_runner
resource "google_cloud_run_v2_service_iam_member" "prompt_runner_scheduler_invoker" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.prompt_runner.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.scheduler_invoker.email}"
}
