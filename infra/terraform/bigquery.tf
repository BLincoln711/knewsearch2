# -----------------------------------------------------------------------------
# BigQuery Dataset and Tables
# -----------------------------------------------------------------------------

resource "google_bigquery_dataset" "knewsearch" {
  dataset_id    = var.bigquery_dataset_id
  friendly_name = "KnewSearch AEO Visibility Platform"
  description   = "Dataset for AI search visibility monitoring"
  location      = var.bigquery_location

  labels = {
    environment = var.environment
    project     = "knewsearch"
  }

  # Default table expiration disabled - data is valuable
  # default_table_expiration_ms = null

  # Access control managed via IAM
}

# -----------------------------------------------------------------------------
# Core Tables
# -----------------------------------------------------------------------------

# prompts - Library of prompts for AI search visibility monitoring
resource "google_bigquery_table" "prompts" {
  dataset_id          = google_bigquery_dataset.knewsearch.dataset_id
  table_id            = "prompts"
  deletion_protection = var.environment == "prod" ? true : false

  schema = jsonencode([
    {
      name        = "prompt_id"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Unique identifier for the prompt"
    },
    {
      name        = "prompt_text"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "The actual prompt text sent to AI"
    },
    {
      name        = "category"
      type        = "STRING"
      mode        = "NULLABLE"
      description = "Category grouping (e.g., brand, competitor, industry)"
    },
    {
      name        = "brand"
      type        = "STRING"
      mode        = "NULLABLE"
      description = "Target brand this prompt is tracking"
    },
    {
      name        = "keywords"
      type        = "STRING"
      mode        = "REPEATED"
      description = "Keywords associated with this prompt"
    },
    {
      name        = "is_active"
      type        = "BOOL"
      mode        = "NULLABLE"
      description = "Whether prompt is included in scheduled runs"
    },
    {
      name        = "created_at"
      type        = "TIMESTAMP"
      mode        = "REQUIRED"
      description = "When prompt was created"
    },
    {
      name        = "updated_at"
      type        = "TIMESTAMP"
      mode        = "REQUIRED"
      description = "When prompt was last modified"
    },
    {
      name        = "metadata"
      type        = "JSON"
      mode        = "NULLABLE"
      description = "Additional flexible metadata"
    }
  ])

  labels = {
    environment = var.environment
  }
}

# answer_runs - Tracks batch runs of prompt processing
resource "google_bigquery_table" "answer_runs" {
  dataset_id          = google_bigquery_dataset.knewsearch.dataset_id
  table_id            = "answer_runs"
  deletion_protection = var.environment == "prod" ? true : false

  schema = jsonencode([
    {
      name        = "run_id"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Unique identifier for this run"
    },
    {
      name        = "run_type"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Type of run: scheduled, manual, backfill"
    },
    {
      name        = "status"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Run status: pending, running, completed, failed"
    },
    {
      name        = "started_at"
      type        = "TIMESTAMP"
      mode        = "REQUIRED"
      description = "When the run started"
    },
    {
      name        = "completed_at"
      type        = "TIMESTAMP"
      mode        = "NULLABLE"
      description = "When the run completed"
    },
    {
      name        = "total_prompts"
      type        = "INT64"
      mode        = "NULLABLE"
      description = "Total number of prompts in this run"
    },
    {
      name        = "successful_prompts"
      type        = "INT64"
      mode        = "NULLABLE"
      description = "Number of prompts successfully processed"
    },
    {
      name        = "failed_prompts"
      type        = "INT64"
      mode        = "NULLABLE"
      description = "Number of prompts that failed"
    },
    {
      name        = "error_message"
      type        = "STRING"
      mode        = "NULLABLE"
      description = "Error details if run failed"
    },
    {
      name        = "triggered_by"
      type        = "STRING"
      mode        = "NULLABLE"
      description = "What triggered this run: cloud_scheduler, api, manual"
    },
    {
      name        = "metadata"
      type        = "JSON"
      mode        = "NULLABLE"
      description = "Additional run metadata"
    }
  ])

  labels = {
    environment = var.environment
  }
}

# ai_answers - Raw AI-generated answers from Gemini (partitioned)
resource "google_bigquery_table" "ai_answers" {
  dataset_id          = google_bigquery_dataset.knewsearch.dataset_id
  table_id            = "ai_answers"
  deletion_protection = var.environment == "prod" ? true : false

  time_partitioning {
    type                     = "DAY"
    field                    = "event_date"
    require_partition_filter = true
  }

  clustering = ["brand", "prompt_id"]

  schema = jsonencode([
    {
      name        = "answer_id"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Unique identifier for this answer"
    },
    {
      name        = "run_id"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Reference to the answer_run"
    },
    {
      name        = "prompt_id"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Reference to the prompt"
    },
    {
      name        = "brand"
      type        = "STRING"
      mode        = "NULLABLE"
      description = "Brand being tracked"
    },
    {
      name        = "event_date"
      type        = "DATE"
      mode        = "REQUIRED"
      description = "Date of answer generation for partitioning"
    },
    {
      name        = "prompt_text"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "The prompt text used"
    },
    {
      name        = "raw_answer"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Raw response from Gemini"
    },
    {
      name        = "model_version"
      type        = "STRING"
      mode        = "NULLABLE"
      description = "Gemini model version used"
    },
    {
      name        = "token_count_prompt"
      type        = "INT64"
      mode        = "NULLABLE"
      description = "Tokens in the prompt"
    },
    {
      name        = "token_count_response"
      type        = "INT64"
      mode        = "NULLABLE"
      description = "Tokens in the response"
    },
    {
      name        = "latency_ms"
      type        = "INT64"
      mode        = "NULLABLE"
      description = "Response latency in milliseconds"
    },
    {
      name        = "created_at"
      type        = "TIMESTAMP"
      mode        = "REQUIRED"
      description = "When answer was stored"
    },
    {
      name        = "metadata"
      type        = "JSON"
      mode        = "NULLABLE"
      description = "Additional metadata"
    }
  ])

  labels = {
    environment = var.environment
  }
}

# citations - Citations extracted from AI answers (partitioned)
resource "google_bigquery_table" "citations" {
  dataset_id          = google_bigquery_dataset.knewsearch.dataset_id
  table_id            = "citations"
  deletion_protection = var.environment == "prod" ? true : false

  time_partitioning {
    type                     = "DAY"
    field                    = "event_date"
    require_partition_filter = true
  }

  clustering = ["domain", "brand"]

  schema = jsonencode([
    {
      name        = "citation_id"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Unique identifier for this citation"
    },
    {
      name        = "answer_id"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Reference to the ai_answer"
    },
    {
      name        = "run_id"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Reference to the answer_run"
    },
    {
      name        = "prompt_id"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Reference to the prompt"
    },
    {
      name        = "brand"
      type        = "STRING"
      mode        = "NULLABLE"
      description = "Brand being tracked"
    },
    {
      name        = "event_date"
      type        = "DATE"
      mode        = "REQUIRED"
      description = "Date for partitioning"
    },
    {
      name        = "url"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "The cited URL"
    },
    {
      name        = "domain"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Extracted domain from URL"
    },
    {
      name        = "position"
      type        = "INT64"
      mode        = "NULLABLE"
      description = "Position of citation in answer (1-indexed)"
    },
    {
      name        = "anchor_text"
      type        = "STRING"
      mode        = "NULLABLE"
      description = "Text associated with the citation"
    },
    {
      name        = "is_brand_owned"
      type        = "BOOL"
      mode        = "NULLABLE"
      description = "Whether domain belongs to tracked brand"
    },
    {
      name        = "is_competitor"
      type        = "BOOL"
      mode        = "NULLABLE"
      description = "Whether domain belongs to a competitor"
    },
    {
      name        = "created_at"
      type        = "TIMESTAMP"
      mode        = "REQUIRED"
      description = "When citation was extracted"
    },
    {
      name        = "metadata"
      type        = "JSON"
      mode        = "NULLABLE"
      description = "Additional metadata"
    }
  ])

  labels = {
    environment = var.environment
  }
}

# entities - Named entities extracted from AI answers (partitioned)
resource "google_bigquery_table" "entities" {
  dataset_id          = google_bigquery_dataset.knewsearch.dataset_id
  table_id            = "entities"
  deletion_protection = var.environment == "prod" ? true : false

  time_partitioning {
    type                     = "DAY"
    field                    = "event_date"
    require_partition_filter = true
  }

  clustering = ["brand", "entity_type"]

  schema = jsonencode([
    {
      name        = "entity_id"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Unique identifier for this entity extraction"
    },
    {
      name        = "answer_id"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Reference to the ai_answer"
    },
    {
      name        = "run_id"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Reference to the answer_run"
    },
    {
      name        = "prompt_id"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Reference to the prompt"
    },
    {
      name        = "brand"
      type        = "STRING"
      mode        = "NULLABLE"
      description = "Brand being tracked"
    },
    {
      name        = "event_date"
      type        = "DATE"
      mode        = "REQUIRED"
      description = "Date for partitioning"
    },
    {
      name        = "entity_text"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "The extracted entity text"
    },
    {
      name        = "entity_type"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Type: brand, product, person, organization, location"
    },
    {
      name        = "confidence_score"
      type        = "FLOAT64"
      mode        = "NULLABLE"
      description = "Extraction confidence 0.0-1.0"
    },
    {
      name        = "mention_count"
      type        = "INT64"
      mode        = "NULLABLE"
      description = "Number of times entity appears in answer"
    },
    {
      name        = "is_target_brand"
      type        = "BOOL"
      mode        = "NULLABLE"
      description = "Whether this is the brand being tracked"
    },
    {
      name        = "is_competitor"
      type        = "BOOL"
      mode        = "NULLABLE"
      description = "Whether this is a known competitor"
    },
    {
      name        = "sentiment"
      type        = "STRING"
      mode        = "NULLABLE"
      description = "Sentiment: positive, neutral, negative"
    },
    {
      name        = "created_at"
      type        = "TIMESTAMP"
      mode        = "REQUIRED"
      description = "When entity was extracted"
    },
    {
      name        = "metadata"
      type        = "JSON"
      mode        = "NULLABLE"
      description = "Additional metadata"
    }
  ])

  labels = {
    environment = var.environment
  }
}

# embeddings - Vector embeddings of AI answers (partitioned)
resource "google_bigquery_table" "embeddings" {
  dataset_id          = google_bigquery_dataset.knewsearch.dataset_id
  table_id            = "embeddings"
  deletion_protection = var.environment == "prod" ? true : false

  time_partitioning {
    type                     = "DAY"
    field                    = "event_date"
    require_partition_filter = true
  }

  clustering = ["brand", "prompt_id"]

  schema = jsonencode([
    {
      name        = "embedding_id"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Unique identifier for this embedding"
    },
    {
      name        = "answer_id"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Reference to the ai_answer"
    },
    {
      name        = "run_id"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Reference to the answer_run"
    },
    {
      name        = "prompt_id"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Reference to the prompt"
    },
    {
      name        = "brand"
      type        = "STRING"
      mode        = "NULLABLE"
      description = "Brand being tracked"
    },
    {
      name        = "event_date"
      type        = "DATE"
      mode        = "REQUIRED"
      description = "Date for partitioning"
    },
    {
      name        = "embedding"
      type        = "FLOAT64"
      mode        = "REPEATED"
      description = "Vector embedding from Vertex AI"
    },
    {
      name        = "embedding_model"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Model used: text-embedding-004, etc."
    },
    {
      name        = "embedding_dimension"
      type        = "INT64"
      mode        = "REQUIRED"
      description = "Dimension of embedding vector"
    },
    {
      name        = "text_hash"
      type        = "STRING"
      mode        = "NULLABLE"
      description = "Hash of input text for deduplication"
    },
    {
      name        = "created_at"
      type        = "TIMESTAMP"
      mode        = "REQUIRED"
      description = "When embedding was generated"
    },
    {
      name        = "metadata"
      type        = "JSON"
      mode        = "NULLABLE"
      description = "Additional metadata"
    }
  ])

  labels = {
    environment = var.environment
  }
}

# visibility_scores - Computed visibility scores for brand tracking (partitioned)
resource "google_bigquery_table" "visibility_scores" {
  dataset_id          = google_bigquery_dataset.knewsearch.dataset_id
  table_id            = "visibility_scores"
  deletion_protection = var.environment == "prod" ? true : false

  time_partitioning {
    type                     = "DAY"
    field                    = "event_date"
    require_partition_filter = true
  }

  clustering = ["brand"]

  schema = jsonencode([
    {
      name        = "score_id"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Unique identifier for this score record"
    },
    {
      name        = "brand"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Brand being scored"
    },
    {
      name        = "event_date"
      type        = "DATE"
      mode        = "REQUIRED"
      description = "Date of score calculation"
    },
    {
      name        = "prompt_id"
      type        = "STRING"
      mode        = "NULLABLE"
      description = "Specific prompt if per-prompt score, NULL for aggregate"
    },
    {
      name        = "run_id"
      type        = "STRING"
      mode        = "NULLABLE"
      description = "Reference to the answer_run"
    },
    {
      name        = "visibility_score"
      type        = "FLOAT64"
      mode        = "REQUIRED"
      description = "Overall visibility score 0-100"
    },
    {
      name        = "citation_score"
      type        = "FLOAT64"
      mode        = "NULLABLE"
      description = "Score based on citation presence and position"
    },
    {
      name        = "mention_score"
      type        = "FLOAT64"
      mode        = "NULLABLE"
      description = "Score based on brand mentions"
    },
    {
      name        = "sentiment_score"
      type        = "FLOAT64"
      mode        = "NULLABLE"
      description = "Score based on sentiment of mentions"
    },
    {
      name        = "total_prompts"
      type        = "INT64"
      mode        = "NULLABLE"
      description = "Total prompts evaluated"
    },
    {
      name        = "prompts_with_citation"
      type        = "INT64"
      mode        = "NULLABLE"
      description = "Prompts where brand was cited"
    },
    {
      name        = "prompts_with_mention"
      type        = "INT64"
      mode        = "NULLABLE"
      description = "Prompts where brand was mentioned"
    },
    {
      name        = "total_citations"
      type        = "INT64"
      mode        = "NULLABLE"
      description = "Total brand citations across answers"
    },
    {
      name        = "total_mentions"
      type        = "INT64"
      mode        = "NULLABLE"
      description = "Total brand mentions across answers"
    },
    {
      name        = "avg_citation_position"
      type        = "FLOAT64"
      mode        = "NULLABLE"
      description = "Average position when cited (lower is better)"
    },
    {
      name        = "score_change"
      type        = "FLOAT64"
      mode        = "NULLABLE"
      description = "Change from previous period"
    },
    {
      name        = "score_change_pct"
      type        = "FLOAT64"
      mode        = "NULLABLE"
      description = "Percentage change from previous period"
    },
    {
      name        = "created_at"
      type        = "TIMESTAMP"
      mode        = "REQUIRED"
      description = "When score was calculated"
    },
    {
      name        = "metadata"
      type        = "JSON"
      mode        = "NULLABLE"
      description = "Additional scoring metadata and breakdown"
    }
  ])

  labels = {
    environment = var.environment
  }
}

# client_brands - Maps clients (orgs) to their authorized brands
resource "google_bigquery_table" "client_brands" {
  dataset_id          = google_bigquery_dataset.knewsearch.dataset_id
  table_id            = "client_brands"
  deletion_protection = var.environment == "prod" ? true : false

  schema = jsonencode([
    {
      name        = "client_id"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Maps to Firestore /clients/{clientId}"
    },
    {
      name        = "brand"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Brand name matching prompts.brand"
    },
    {
      name        = "is_active"
      type        = "BOOL"
      mode        = "NULLABLE"
      description = "Whether this mapping is active"
    },
    {
      name        = "added_at"
      type        = "TIMESTAMP"
      mode        = "REQUIRED"
      description = "When this brand was assigned to client"
    }
  ])

  labels = {
    environment = var.environment
  }
}

# weekly_summaries - AI-generated weekly executive summaries (partitioned)
resource "google_bigquery_table" "weekly_summaries" {
  dataset_id          = google_bigquery_dataset.knewsearch.dataset_id
  table_id            = "weekly_summaries"
  deletion_protection = var.environment == "prod" ? true : false

  time_partitioning {
    type                     = "DAY"
    field                    = "event_date"
    require_partition_filter = true
  }

  clustering = ["brand"]

  schema = jsonencode([
    {
      name        = "summary_id"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Unique identifier for this summary"
    },
    {
      name        = "brand"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Brand this summary covers"
    },
    {
      name        = "event_date"
      type        = "DATE"
      mode        = "REQUIRED"
      description = "Date summary was generated"
    },
    {
      name        = "week_start_date"
      type        = "DATE"
      mode        = "REQUIRED"
      description = "Start date of the week covered"
    },
    {
      name        = "week_end_date"
      type        = "DATE"
      mode        = "REQUIRED"
      description = "End date of the week covered"
    },
    {
      name        = "executive_summary"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "AI-generated executive summary text"
    },
    {
      name        = "key_findings"
      type        = "STRING"
      mode        = "REPEATED"
      description = "Bullet points of key findings"
    },
    {
      name        = "recommendations"
      type        = "STRING"
      mode        = "REPEATED"
      description = "Recommended actions"
    },
    {
      name        = "avg_visibility_score"
      type        = "FLOAT64"
      mode        = "NULLABLE"
      description = "Average visibility score for the week"
    },
    {
      name        = "visibility_trend"
      type        = "STRING"
      mode        = "NULLABLE"
      description = "Trend direction: up, down, stable"
    },
    {
      name        = "visibility_change_pct"
      type        = "FLOAT64"
      mode        = "NULLABLE"
      description = "Week-over-week change percentage"
    },
    {
      name        = "top_cited_domains"
      type        = "STRING"
      mode        = "REPEATED"
      description = "Most frequently cited domains"
    },
    {
      name        = "top_competitors"
      type        = "STRING"
      mode        = "REPEATED"
      description = "Competitors with highest visibility"
    },
    {
      name        = "prompts_analyzed"
      type        = "INT64"
      mode        = "NULLABLE"
      description = "Number of prompts included"
    },
    {
      name        = "answers_analyzed"
      type        = "INT64"
      mode        = "NULLABLE"
      description = "Number of answers analyzed"
    },
    {
      name        = "model_version"
      type        = "STRING"
      mode        = "NULLABLE"
      description = "Gemini model used for summary generation"
    },
    {
      name        = "email_subject"
      type        = "STRING"
      mode        = "NULLABLE"
      description = "Suggested email subject line"
    },
    {
      name        = "email_ready_html"
      type        = "STRING"
      mode        = "NULLABLE"
      description = "HTML formatted for email"
    },
    {
      name        = "created_at"
      type        = "TIMESTAMP"
      mode        = "REQUIRED"
      description = "When summary was generated"
    },
    {
      name        = "metadata"
      type        = "JSON"
      mode        = "NULLABLE"
      description = "Additional metadata"
    }
  ])

  labels = {
    environment = var.environment
  }
}
