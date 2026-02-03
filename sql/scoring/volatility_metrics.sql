-- volatility_metrics.sql
-- Computes volatility metrics per prompt based on answer text changes
-- between the latest two answers for each prompt
--
-- Volatility ranks (0-6):
--   0: No change or first answer (similarity >= 0.95)
--   1: Minor changes (similarity 0.85-0.95)
--   2: Moderate changes (similarity 0.70-0.85)
--   3: Significant changes (similarity 0.50-0.70)
--   4: Major changes (similarity 0.30-0.50)
--   5: Substantial rewrite (similarity 0.10-0.30)
--   6: Complete rewrite (similarity < 0.10)
--
-- Parameters (to be substituted):
--   @target_date: DATE - The date to query
--   @project_id: STRING - GCP project ID
--   @dataset: STRING - BigQuery dataset name

WITH answer_metadata AS (
  SELECT
    a.answer_id,
    a.run_id,
    a.prompt_id,
    a.brand,
    a.event_date,
    a.created_at,
    JSON_VALUE(a.metadata, '$.is_first_answer') AS is_first_answer,
    CAST(JSON_VALUE(a.metadata, '$.similarity_score') AS FLOAT64) AS similarity_score,
    CAST(JSON_VALUE(a.metadata, '$.words_added') AS INT64) AS words_added,
    CAST(JSON_VALUE(a.metadata, '$.words_removed') AS INT64) AS words_removed,
    CAST(JSON_VALUE(a.metadata, '$.length_change') AS INT64) AS length_change,
    JSON_VALUE(a.metadata, '$.has_changes') AS has_changes
  FROM `@project_id.@dataset.ai_answers` a
  WHERE a.event_date = @target_date
    AND a.brand IS NOT NULL
),

volatility_computed AS (
  SELECT
    *,
    -- Compute volatility rank based on similarity score
    CASE
      WHEN is_first_answer = 'true' THEN 0
      WHEN similarity_score IS NULL THEN 0
      WHEN similarity_score >= 0.95 THEN 0
      WHEN similarity_score >= 0.85 THEN 1
      WHEN similarity_score >= 0.70 THEN 2
      WHEN similarity_score >= 0.50 THEN 3
      WHEN similarity_score >= 0.30 THEN 4
      WHEN similarity_score >= 0.10 THEN 5
      ELSE 6
    END AS volatility_rank,
    -- Human-readable volatility label
    CASE
      WHEN is_first_answer = 'true' THEN 'first_answer'
      WHEN similarity_score IS NULL THEN 'unknown'
      WHEN similarity_score >= 0.95 THEN 'stable'
      WHEN similarity_score >= 0.85 THEN 'minor_change'
      WHEN similarity_score >= 0.70 THEN 'moderate_change'
      WHEN similarity_score >= 0.50 THEN 'significant_change'
      WHEN similarity_score >= 0.30 THEN 'major_change'
      WHEN similarity_score >= 0.10 THEN 'substantial_rewrite'
      ELSE 'complete_rewrite'
    END AS volatility_label
  FROM answer_metadata
)

SELECT
  answer_id,
  run_id,
  prompt_id,
  brand,
  event_date,
  is_first_answer,
  ROUND(similarity_score, 3) AS similarity_score,
  words_added,
  words_removed,
  length_change,
  has_changes,
  volatility_rank,
  volatility_label,
  -- Score penalty (used in visibility score calculation)
  LEAST(30, 5 * volatility_rank) AS volatility_penalty
FROM volatility_computed
ORDER BY brand, prompt_id, created_at DESC;
