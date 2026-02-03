-- weekly_summaries.sql
-- Stores AI-generated weekly executive summaries
-- Dedupe key: summary_id (or brand + week_start_date for uniqueness)
-- Partitioned by event_date for time-series queries
-- Clustered by brand for filtering

CREATE TABLE IF NOT EXISTS `knewsearch_aeo.weekly_summaries` (
  summary_id STRING NOT NULL OPTIONS(description="Unique identifier for this summary"),
  brand STRING NOT NULL OPTIONS(description="Brand this summary covers"),
  event_date DATE NOT NULL OPTIONS(description="Date summary was generated"),
  week_start_date DATE NOT NULL OPTIONS(description="Start date of the week covered"),
  week_end_date DATE NOT NULL OPTIONS(description="End date of the week covered"),

  -- Summary content
  executive_summary STRING NOT NULL OPTIONS(description="AI-generated executive summary text"),
  key_findings ARRAY<STRING> OPTIONS(description="Bullet points of key findings"),
  recommendations ARRAY<STRING> OPTIONS(description="Recommended actions"),

  -- Metrics snapshot
  avg_visibility_score FLOAT64 OPTIONS(description="Average visibility score for the week"),
  visibility_trend STRING OPTIONS(description="Trend direction: up, down, stable"),
  visibility_change_pct FLOAT64 OPTIONS(description="Week-over-week change percentage"),
  top_cited_domains ARRAY<STRING> OPTIONS(description="Most frequently cited domains"),
  top_competitors ARRAY<STRING> OPTIONS(description="Competitors with highest visibility"),

  -- Generation metadata
  prompts_analyzed INT64 OPTIONS(description="Number of prompts included"),
  answers_analyzed INT64 OPTIONS(description="Number of answers analyzed"),
  model_version STRING OPTIONS(description="Gemini model used for summary generation"),

  -- Email readiness
  email_subject STRING OPTIONS(description="Suggested email subject line"),
  email_ready_html STRING OPTIONS(description="HTML formatted for email"),

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP() OPTIONS(description="When summary was generated"),
  metadata JSON OPTIONS(description="Additional metadata")
)
PARTITION BY event_date
CLUSTER BY brand
OPTIONS(
  description="AI-generated weekly executive summaries",
  require_partition_filter=TRUE
);
