-- citations.sql
-- Stores extracted citations/URLs from AI answers
-- Dedupe key: citation_id (or answer_id + url + position for uniqueness)
-- Partitioned by event_date for cost-efficient querying
-- Clustered by domain, brand for common query patterns

CREATE TABLE IF NOT EXISTS `knewsearch_aeo.citations` (
  citation_id STRING NOT NULL OPTIONS(description="Unique identifier for this citation"),
  answer_id STRING NOT NULL OPTIONS(description="Reference to the ai_answer"),
  run_id STRING NOT NULL OPTIONS(description="Reference to the answer_run"),
  prompt_id STRING NOT NULL OPTIONS(description="Reference to the prompt"),
  brand STRING OPTIONS(description="Brand being tracked"),
  event_date DATE NOT NULL OPTIONS(description="Date for partitioning"),
  url STRING NOT NULL OPTIONS(description="The cited URL"),
  domain STRING NOT NULL OPTIONS(description="Extracted domain from URL"),
  position INT64 OPTIONS(description="Position of citation in answer (1-indexed)"),
  anchor_text STRING OPTIONS(description="Text associated with the citation"),
  is_brand_owned BOOL OPTIONS(description="Whether domain belongs to tracked brand"),
  is_competitor BOOL OPTIONS(description="Whether domain belongs to a competitor"),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP() OPTIONS(description="When citation was extracted"),
  metadata JSON OPTIONS(description="Additional metadata")
)
PARTITION BY event_date
CLUSTER BY domain, brand
OPTIONS(
  description="Citations extracted from AI answers",
  require_partition_filter=TRUE
);
