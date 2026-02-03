-- prompts.sql
-- Stores the library of prompts used to query AI search engines
-- Dedupe key: prompt_id

CREATE TABLE IF NOT EXISTS `knewsearch_aeo.prompts` (
  prompt_id STRING NOT NULL OPTIONS(description="Unique identifier for the prompt"),
  prompt_text STRING NOT NULL OPTIONS(description="The actual prompt text sent to AI"),
  category STRING OPTIONS(description="Category grouping (e.g., brand, competitor, industry)"),
  brand STRING OPTIONS(description="Target brand this prompt is tracking"),
  keywords ARRAY<STRING> OPTIONS(description="Keywords associated with this prompt"),
  is_active BOOL DEFAULT TRUE OPTIONS(description="Whether prompt is included in scheduled runs"),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP() OPTIONS(description="When prompt was created"),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP() OPTIONS(description="When prompt was last modified"),
  metadata JSON OPTIONS(description="Additional flexible metadata")
)
OPTIONS(
  description="Library of prompts for AI search visibility monitoring"
);
