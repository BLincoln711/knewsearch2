-- embeddings.sql
-- Stores vector embeddings of AI answers for similarity search
-- Dedupe key: embedding_id (or answer_id for 1:1 relationship)
-- Clustered by brand, prompt_id for common query patterns

CREATE TABLE IF NOT EXISTS `knewsearch_aeo.embeddings` (
  embedding_id STRING NOT NULL OPTIONS(description="Unique identifier for this embedding"),
  answer_id STRING NOT NULL OPTIONS(description="Reference to the ai_answer"),
  run_id STRING NOT NULL OPTIONS(description="Reference to the answer_run"),
  prompt_id STRING NOT NULL OPTIONS(description="Reference to the prompt"),
  brand STRING OPTIONS(description="Brand being tracked"),
  event_date DATE NOT NULL OPTIONS(description="Date for partitioning"),
  embedding ARRAY<FLOAT64> NOT NULL OPTIONS(description="Vector embedding from Vertex AI"),
  embedding_model STRING NOT NULL OPTIONS(description="Model used: text-embedding-004, etc."),
  embedding_dimension INT64 NOT NULL OPTIONS(description="Dimension of embedding vector"),
  text_hash STRING OPTIONS(description="Hash of input text for deduplication"),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP() OPTIONS(description="When embedding was generated"),
  metadata JSON OPTIONS(description="Additional metadata")
)
PARTITION BY event_date
CLUSTER BY brand, prompt_id
OPTIONS(
  description="Vector embeddings of AI answers for similarity and drift detection",
  require_partition_filter=TRUE
);
