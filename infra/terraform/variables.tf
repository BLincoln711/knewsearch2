variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for resources"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

# -----------------------------------------------------------------------------
# BigQuery Configuration
# -----------------------------------------------------------------------------

variable "bigquery_dataset_id" {
  description = "BigQuery dataset ID"
  type        = string
  default     = "knewsearch_aeo"
}

variable "bigquery_location" {
  description = "BigQuery dataset location"
  type        = string
  default     = "US"
}

# -----------------------------------------------------------------------------
# Cloud Run Configuration
# -----------------------------------------------------------------------------

variable "prompt_runner_image" {
  description = "Container image for prompt_runner service"
  type        = string
  default     = "gcr.io/cloudrun/placeholder"
}

variable "answer_generator_image" {
  description = "Container image for answer_generator service"
  type        = string
  default     = "gcr.io/cloudrun/placeholder"
}

variable "parser_image" {
  description = "Container image for parser service"
  type        = string
  default     = "gcr.io/cloudrun/placeholder"
}

variable "cloud_run_cpu" {
  description = "CPU allocation for Cloud Run services"
  type        = string
  default     = "1"
}

variable "cloud_run_memory" {
  description = "Memory allocation for Cloud Run services"
  type        = string
  default     = "512Mi"
}

variable "cloud_run_max_instances" {
  description = "Maximum number of Cloud Run instances"
  type        = number
  default     = 10
}

variable "log_level" {
  description = "Logging level for services"
  type        = string
  default     = "INFO"
}

# -----------------------------------------------------------------------------
# Cloud Scheduler Configuration
# -----------------------------------------------------------------------------

variable "daily_run_schedule" {
  description = "Cron schedule for daily prompt runs (default: 6 AM)"
  type        = string
  default     = "0 6 * * *"
}

variable "weekly_summary_schedule" {
  description = "Cron schedule for weekly summary generation (default: Monday 8 AM)"
  type        = string
  default     = "0 8 * * 1"
}

variable "scheduler_timezone" {
  description = "Timezone for Cloud Scheduler jobs"
  type        = string
  default     = "America/Chicago"
}

# -----------------------------------------------------------------------------
# AI/ML Configuration
# -----------------------------------------------------------------------------

variable "gemini_model" {
  description = "Gemini model version to use"
  type        = string
  default     = "gemini-1.5-pro"
}

variable "embedding_model" {
  description = "Vertex AI embedding model"
  type        = string
  default     = "text-embedding-004"
}

variable "embedding_dimension" {
  description = "Embedding vector dimension"
  type        = number
  default     = 768
}
