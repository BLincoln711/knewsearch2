-- ai_answers.sql
-- Stores raw AI-generated answers from Gemini
-- Dedupe key: answer_id (or run_id + prompt_id for a given run)
-- Partitioned by event_date for cost-efficient querying
-- Clustered by brand, prompt_id for common query patterns

CREATE TABLE IF NOT EXISTS `knewsearch_aeo.ai_answers` (
  answer_id STRING NOT NULL OPTIONS(description="Unique identifier for this answer"),
  run_id STRING NOT NULL OPTIONS(description="Reference to the answer_run"),
  prompt_id STRING NOT NULL OPTIONS(description="Reference to the prompt"),
  brand STRING OPTIONS(description="Brand being tracked"),
  event_date DATE NOT NULL OPTIONS(description="Date of answer generation for partitioning"),
  prompt_text STRING NOT NULL OPTIONS(description="The prompt text used"),
  raw_answer STRING NOT NULL OPTIONS(description="Raw response from Gemini"),
  model_version STRING OPTIONS(description="Gemini model version used"),
  token_count_prompt INT64 OPTIONS(description="Tokens in the prompt"),
  token_count_response INT64 OPTIONS(description="Tokens in the response"),
  latency_ms INT64 OPTIONS(description="Response latency in milliseconds"),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP() OPTIONS(description="When answer was stored"),
  metadata JSON OPTIONS(description="Additional metadata")
)
PARTITION BY event_date
CLUSTER BY brand, prompt_id
OPTIONS(
  description="Raw AI-generated answers from Gemini",
  require_partition_filter=TRUE
);
