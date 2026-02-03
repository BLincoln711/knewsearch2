-- entities.sql
-- Stores named entities (brands, products, people, orgs) extracted from AI answers
-- Dedupe key: entity_id (or answer_id + entity_text + entity_type for uniqueness)
-- Clustered by brand, entity_type for common query patterns

CREATE TABLE IF NOT EXISTS `knewsearch_aeo.entities` (
  entity_id STRING NOT NULL OPTIONS(description="Unique identifier for this entity extraction"),
  answer_id STRING NOT NULL OPTIONS(description="Reference to the ai_answer"),
  run_id STRING NOT NULL OPTIONS(description="Reference to the answer_run"),
  prompt_id STRING NOT NULL OPTIONS(description="Reference to the prompt"),
  brand STRING OPTIONS(description="Brand being tracked"),
  event_date DATE NOT NULL OPTIONS(description="Date for partitioning"),
  entity_text STRING NOT NULL OPTIONS(description="The extracted entity text"),
  entity_type STRING NOT NULL OPTIONS(description="Type: brand, product, person, organization, location"),
  confidence_score FLOAT64 OPTIONS(description="Extraction confidence 0.0-1.0"),
  mention_count INT64 DEFAULT 1 OPTIONS(description="Number of times entity appears in answer"),
  is_target_brand BOOL OPTIONS(description="Whether this is the brand being tracked"),
  is_competitor BOOL OPTIONS(description="Whether this is a known competitor"),
  sentiment STRING OPTIONS(description="Sentiment: positive, neutral, negative"),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP() OPTIONS(description="When entity was extracted"),
  metadata JSON OPTIONS(description="Additional metadata")
)
PARTITION BY event_date
CLUSTER BY brand, entity_type
OPTIONS(
  description="Named entities extracted from AI answers",
  require_partition_filter=TRUE
);
