-- top_citation_domains.sql
-- Returns top citation domains per brand per day
-- Used for reporting and dashboard display
--
-- Parameters (to be substituted):
--   @target_date: DATE - The date to query
--   @project_id: STRING - GCP project ID
--   @dataset: STRING - BigQuery dataset name
--   @limit: INT64 - Number of top domains to return per brand (default 10)

WITH domain_stats AS (
  SELECT
    c.brand,
    c.domain,
    c.event_date,
    COUNT(*) AS citation_count,
    COUNT(DISTINCT c.prompt_id) AS prompts_citing,
    COUNT(DISTINCT c.answer_id) AS answers_citing,
    MIN(c.position) AS best_position,
    ROUND(AVG(c.position), 2) AS avg_position,
    MAX(c.is_brand_owned) AS is_brand_owned,
    MAX(c.is_competitor) AS is_competitor,
    ARRAY_AGG(DISTINCT c.anchor_text IGNORE NULLS LIMIT 5) AS sample_anchors
  FROM `@project_id.@dataset.citations` c
  WHERE c.event_date = @target_date
    AND c.brand IS NOT NULL
    AND c.domain IS NOT NULL
  GROUP BY c.brand, c.domain, c.event_date
),

ranked_domains AS (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY brand
      ORDER BY citation_count DESC, avg_position ASC
    ) AS domain_rank
  FROM domain_stats
)

SELECT
  brand,
  domain,
  event_date,
  citation_count,
  prompts_citing,
  answers_citing,
  best_position,
  avg_position,
  is_brand_owned,
  is_competitor,
  sample_anchors,
  domain_rank
FROM ranked_domains
WHERE domain_rank <= @limit
ORDER BY brand, domain_rank;
