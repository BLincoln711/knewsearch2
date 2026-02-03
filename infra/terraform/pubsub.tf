# -----------------------------------------------------------------------------
# Pub/Sub Topics
# -----------------------------------------------------------------------------

# Topic: prompt_run_requested
# Publisher: prompt_runner
# Subscriber: answer_generator
resource "google_pubsub_topic" "prompt_run_requested" {
  name = "prompt_run_requested"

  labels = {
    environment = var.environment
    publisher   = "prompt-runner"
    subscriber  = "answer-generator"
  }

  message_retention_duration = "86400s" # 24 hours
}

# Topic: answer_generated
# Publisher: answer_generator
# Subscriber: parser
resource "google_pubsub_topic" "answer_generated" {
  name = "answer_generated"

  labels = {
    environment = var.environment
    publisher   = "answer-generator"
    subscriber  = "parser"
  }

  message_retention_duration = "86400s" # 24 hours
}

# Topic: answer_parsed
# Publisher: parser
# Subscriber: scoring (future)
resource "google_pubsub_topic" "answer_parsed" {
  name = "answer_parsed"

  labels = {
    environment = var.environment
    publisher   = "parser"
    subscriber  = "scoring"
  }

  message_retention_duration = "86400s" # 24 hours
}

# -----------------------------------------------------------------------------
# Dead Letter Topics (for failed message handling)
# -----------------------------------------------------------------------------

resource "google_pubsub_topic" "prompt_run_requested_dlq" {
  name = "prompt_run_requested-dlq"

  labels = {
    environment = var.environment
    type        = "dead-letter"
  }

  message_retention_duration = "604800s" # 7 days
}

resource "google_pubsub_topic" "answer_generated_dlq" {
  name = "answer_generated-dlq"

  labels = {
    environment = var.environment
    type        = "dead-letter"
  }

  message_retention_duration = "604800s" # 7 days
}

resource "google_pubsub_topic" "answer_parsed_dlq" {
  name = "answer_parsed-dlq"

  labels = {
    environment = var.environment
    type        = "dead-letter"
  }

  message_retention_duration = "604800s" # 7 days
}

# -----------------------------------------------------------------------------
# Pub/Sub Subscriptions (Push to Cloud Run)
# -----------------------------------------------------------------------------

# Subscription: answer_generator subscribes to prompt_run_requested
resource "google_pubsub_subscription" "answer_generator_sub" {
  name  = "answer-generator-sub"
  topic = google_pubsub_topic.prompt_run_requested.id

  # Push configuration to Cloud Run
  push_config {
    push_endpoint = "${google_cloud_run_v2_service.answer_generator.uri}/pubsub"

    oidc_token {
      service_account_email = google_service_account.pubsub_invoker.email
    }

    attributes = {
      x-goog-version = "v1"
    }
  }

  # Acknowledgement deadline
  ack_deadline_seconds = 60

  # Message retention if subscriber is down
  message_retention_duration = "86400s" # 24 hours

  # Retry policy
  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  # Dead letter policy
  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.prompt_run_requested_dlq.id
    max_delivery_attempts = 5
  }

  # Expiration policy disabled - subscription should persist
  expiration_policy {
    ttl = ""
  }

  labels = {
    environment = var.environment
    service     = "answer-generator"
  }

  depends_on = [
    google_cloud_run_v2_service.answer_generator
  ]
}

# Subscription: parser subscribes to answer_generated
resource "google_pubsub_subscription" "parser_sub" {
  name  = "parser-sub"
  topic = google_pubsub_topic.answer_generated.id

  # Push configuration to Cloud Run
  push_config {
    push_endpoint = "${google_cloud_run_v2_service.parser.uri}/pubsub"

    oidc_token {
      service_account_email = google_service_account.pubsub_invoker.email
    }

    attributes = {
      x-goog-version = "v1"
    }
  }

  # Acknowledgement deadline
  ack_deadline_seconds = 120 # Parser may take longer due to embedding generation

  # Message retention if subscriber is down
  message_retention_duration = "86400s" # 24 hours

  # Retry policy
  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  # Dead letter policy
  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.answer_generated_dlq.id
    max_delivery_attempts = 5
  }

  # Expiration policy disabled - subscription should persist
  expiration_policy {
    ttl = ""
  }

  labels = {
    environment = var.environment
    service     = "parser"
  }

  depends_on = [
    google_cloud_run_v2_service.parser
  ]
}

# Subscription: scoring subscribes to answer_parsed (pull for now, can be converted to push later)
resource "google_pubsub_subscription" "scoring_sub" {
  name  = "scoring-sub"
  topic = google_pubsub_topic.answer_parsed.id

  # Pull subscription for scoring (can aggregate batches)
  # No push_config means this is a pull subscription

  # Acknowledgement deadline
  ack_deadline_seconds = 300 # Scoring aggregation may take longer

  # Message retention
  message_retention_duration = "86400s" # 24 hours

  # Retain acknowledged messages for replay capability
  retain_acked_messages = true

  # Retry policy
  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  # Dead letter policy
  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.answer_parsed_dlq.id
    max_delivery_attempts = 5
  }

  # Expiration policy disabled
  expiration_policy {
    ttl = ""
  }

  labels = {
    environment = var.environment
    service     = "scoring"
  }
}

# -----------------------------------------------------------------------------
# Dead Letter Subscriptions (for monitoring/alerting)
# -----------------------------------------------------------------------------

resource "google_pubsub_subscription" "prompt_run_dlq_sub" {
  name  = "prompt_run_requested-dlq-sub"
  topic = google_pubsub_topic.prompt_run_requested_dlq.id

  ack_deadline_seconds       = 60
  message_retention_duration = "604800s" # 7 days

  expiration_policy {
    ttl = ""
  }

  labels = {
    environment = var.environment
    type        = "dead-letter"
  }
}

resource "google_pubsub_subscription" "answer_generated_dlq_sub" {
  name  = "answer_generated-dlq-sub"
  topic = google_pubsub_topic.answer_generated_dlq.id

  ack_deadline_seconds       = 60
  message_retention_duration = "604800s" # 7 days

  expiration_policy {
    ttl = ""
  }

  labels = {
    environment = var.environment
    type        = "dead-letter"
  }
}

resource "google_pubsub_subscription" "answer_parsed_dlq_sub" {
  name  = "answer_parsed-dlq-sub"
  topic = google_pubsub_topic.answer_parsed_dlq.id

  ack_deadline_seconds       = 60
  message_retention_duration = "604800s" # 7 days

  expiration_policy {
    ttl = ""
  }

  labels = {
    environment = var.environment
    type        = "dead-letter"
  }
}
