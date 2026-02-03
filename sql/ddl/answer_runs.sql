-- answer_runs.sql
-- Tracks each scheduled or manual batch run of prompts
-- Dedupe key: run_id

CREATE TABLE IF NOT EXISTS `knewsearch_aeo.answer_runs` (
  run_id STRING NOT NULL OPTIONS(description="Unique identifier for this run"),
  run_type STRING NOT NULL OPTIONS(description="Type of run: scheduled, manual, backfill"),
  status STRING NOT NULL OPTIONS(description="Run status: pending, running, completed, failed"),
  started_at TIMESTAMP NOT NULL OPTIONS(description="When the run started"),
  completed_at TIMESTAMP OPTIONS(description="When the run completed"),
  total_prompts INT64 OPTIONS(description="Total number of prompts in this run"),
  successful_prompts INT64 OPTIONS(description="Number of prompts successfully processed"),
  failed_prompts INT64 OPTIONS(description="Number of prompts that failed"),
  error_message STRING OPTIONS(description="Error details if run failed"),
  triggered_by STRING OPTIONS(description="What triggered this run: cloud_scheduler, api, manual"),
  metadata JSON OPTIONS(description="Additional run metadata")
)
OPTIONS(
  description="Tracks batch runs of prompt processing"
);
