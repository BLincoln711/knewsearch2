-- visibility_scores.sql
-- Stores computed visibility scores per brand per day
-- Dedupe key: score_id (or brand + event_date + prompt_id for uniqueness)
-- Partitioned by event_date for time-series queries
-- Clustered by brand for dashboard filtering

CREATE TABLE IF NOT EXISTS `knewsearch_aeo.visibility_scores` (
  score_id STRING NOT NULL OPTIONS(description="Unique identifier for this score record"),
  brand STRING NOT NULL OPTIONS(description="Brand being scored"),
  event_date DATE NOT NULL OPTIONS(description="Date of score calculation"),
  prompt_id STRING OPTIONS(description="Specific prompt if per-prompt score, NULL for aggregate"),
  run_id STRING OPTIONS(description="Reference to the answer_run"),

  -- Core visibility metrics
  visibility_score FLOAT64 NOT NULL OPTIONS(description="Overall visibility score 0-100"),
  citation_score FLOAT64 OPTIONS(description="Score based on citation presence and position"),
  mention_score FLOAT64 OPTIONS(description="Score based on brand mentions"),
  sentiment_score FLOAT64 OPTIONS(description="Score based on sentiment of mentions"),

  -- Raw counts for transparency
  total_prompts INT64 OPTIONS(description="Total prompts evaluated"),
  prompts_with_citation INT64 OPTIONS(description="Prompts where brand was cited"),
  prompts_with_mention INT64 OPTIONS(description="Prompts where brand was mentioned"),
  total_citations INT64 OPTIONS(description="Total brand citations across answers"),
  total_mentions INT64 OPTIONS(description="Total brand mentions across answers"),
  avg_citation_position FLOAT64 OPTIONS(description="Average position when cited (lower is better)"),

  -- Change detection
  score_change FLOAT64 OPTIONS(description="Change from previous period"),
  score_change_pct FLOAT64 OPTIONS(description="Percentage change from previous period"),

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP() OPTIONS(description="When score was calculated"),
  metadata JSON OPTIONS(description="Additional scoring metadata and breakdown")
)
PARTITION BY event_date
CLUSTER BY brand
OPTIONS(
  description="Computed visibility scores for brand tracking",
  require_partition_filter=TRUE
);
