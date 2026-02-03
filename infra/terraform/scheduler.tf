# -----------------------------------------------------------------------------
# Cloud Scheduler Jobs
# -----------------------------------------------------------------------------

# Daily trigger for prompt_runner /run endpoint
resource "google_cloud_scheduler_job" "daily_prompt_run" {
  name        = "knewsearch-daily-prompt-run"
  description = "Daily trigger for prompt runner to initiate AI answer generation"
  schedule    = var.daily_run_schedule
  time_zone   = var.scheduler_timezone

  region = var.region

  retry_config {
    retry_count          = 3
    min_backoff_duration = "5s"
    max_backoff_duration = "300s"
    max_retry_duration   = "600s"
    max_doublings        = 3
  }

  http_target {
    http_method = "POST"
    uri         = "${google_cloud_run_v2_service.prompt_runner.uri}/run"

    headers = {
      "Content-Type" = "application/json"
    }

    body = base64encode(jsonencode({
      run_type     = "scheduled"
      triggered_by = "cloud_scheduler"
    }))

    oidc_token {
      service_account_email = google_service_account.scheduler_invoker.email
      audience              = google_cloud_run_v2_service.prompt_runner.uri
    }
  }

  labels = {
    environment = var.environment
    job_type    = "daily-run"
  }

  depends_on = [
    google_cloud_run_v2_service.prompt_runner,
    google_cloud_run_v2_service_iam_member.prompt_runner_scheduler_invoker
  ]
}

# Weekly trigger for weekly_summary generation (placeholder for future service)
# This can be enabled when the weekly_summary service is deployed
resource "google_cloud_scheduler_job" "weekly_summary_run" {
  name        = "knewsearch-weekly-summary"
  description = "Weekly trigger for executive summary generation"
  schedule    = var.weekly_summary_schedule
  time_zone   = var.scheduler_timezone

  region = var.region

  # Paused by default until weekly_summary service is deployed
  paused = true

  retry_config {
    retry_count          = 3
    min_backoff_duration = "5s"
    max_backoff_duration = "300s"
    max_retry_duration   = "600s"
    max_doublings        = 3
  }

  http_target {
    http_method = "POST"
    # Placeholder URI - update when weekly_summary service is deployed
    uri = "https://weekly-summary-placeholder.${var.region}.run.app/run"

    headers = {
      "Content-Type" = "application/json"
    }

    body = base64encode(jsonencode({
      run_type     = "scheduled"
      triggered_by = "cloud_scheduler"
    }))

    oidc_token {
      service_account_email = google_service_account.scheduler_invoker.email
      audience              = "https://weekly-summary-placeholder.${var.region}.run.app"
    }
  }

  labels = {
    environment = var.environment
    job_type    = "weekly-summary"
  }
}
