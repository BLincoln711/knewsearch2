-- prompt_scores.sql
-- Computes daily visibility scores per brand per prompt
-- Merges into visibility_scores table with prompt_id populated
--
-- Score formula (per prompt):
--   base_score = 50 if brand mentioned in entities for that prompt else 0
--   citation_bonus = min(50, 10 * citation_count)
--   volatility_penalty = min(30, 5 * volatility_rank)
--   visibility_score = base_score + citation_bonus - volatility_penalty
--
-- Parameters (to be substituted):
--   @target_date: DATE - The date to compute scores for
--   @project_id: STRING - GCP project ID
--   @dataset: STRING - BigQuery dataset name

MERGE INTO `@project_id.@dataset.visibility_scores` AS target
USING (
  WITH prompt_answers AS (
    -- Get all answers for the target date
    SELECT
      a.answer_id,
      a.run_id,
      a.prompt_id,
      a.brand,
      a.event_date,
      a.metadata
    FROM `@project_id.@dataset.ai_answers` a
    WHERE a.event_date = @target_date
      AND a.brand IS NOT NULL
  ),

  -- Count brand mentions per prompt
  prompt_mentions AS (
    SELECT
      e.prompt_id,
      e.brand,
      SUM(e.mention_count) AS mention_count,
      MAX(CASE WHEN e.is_target_brand THEN 1 ELSE 0 END) AS has_brand_mention
    FROM `@project_id.@dataset.entities` e
    WHERE e.event_date = @target_date
      AND e.brand IS NOT NULL
      AND e.is_target_brand = TRUE
    GROUP BY e.prompt_id, e.brand
  ),

  -- Count citations per prompt
  prompt_citations AS (
    SELECT
      c.prompt_id,
      c.brand,
      COUNT(*) AS citation_count,
      COUNTIF(c.is_brand_owned = TRUE) AS brand_owned_count,
      MIN(c.position) AS best_position,
      AVG(c.position) AS avg_position
    FROM `@project_id.@dataset.citations` c
    WHERE c.event_date = @target_date
      AND c.brand IS NOT NULL
    GROUP BY c.prompt_id, c.brand
  ),

  -- Compute volatility from answer metadata
  prompt_volatility AS (
    SELECT
      a.prompt_id,
      a.brand,
      CASE
        WHEN JSON_VALUE(a.metadata, '$.is_first_answer') = 'true' THEN 0
        WHEN CAST(JSON_VALUE(a.metadata, '$.similarity_score') AS FLOAT64) >= 0.95 THEN 0
        WHEN CAST(JSON_VALUE(a.metadata, '$.similarity_score') AS FLOAT64) >= 0.85 THEN 1
        WHEN CAST(JSON_VALUE(a.metadata, '$.similarity_score') AS FLOAT64) >= 0.70 THEN 2
        WHEN CAST(JSON_VALUE(a.metadata, '$.similarity_score') AS FLOAT64) >= 0.50 THEN 3
        WHEN CAST(JSON_VALUE(a.metadata, '$.similarity_score') AS FLOAT64) >= 0.30 THEN 4
        WHEN CAST(JSON_VALUE(a.metadata, '$.similarity_score') AS FLOAT64) >= 0.10 THEN 5
        ELSE 6
      END AS volatility_rank
    FROM prompt_answers a
  ),

  -- Get previous day scores for change calculation (deduplicated)
  prev_prompt_scores AS (
    SELECT
      prompt_id,
      brand,
      visibility_score AS prev_visibility_score
    FROM `@project_id.@dataset.visibility_scores`
    WHERE event_date = DATE_SUB(@target_date, INTERVAL 1 DAY)
      AND prompt_id IS NOT NULL
    QUALIFY ROW_NUMBER() OVER (PARTITION BY brand, prompt_id ORDER BY created_at DESC) = 1
  ),

  -- Combine all metrics
  combined_prompt_scores AS (
    SELECT
      pa.answer_id,
      pa.run_id,
      pa.prompt_id,
      pa.brand,
      pa.event_date,
      -- Score components
      CASE WHEN COALESCE(pm.has_brand_mention, 0) > 0 THEN 50.0 ELSE 0.0 END AS mention_score,
      LEAST(50.0, 10.0 * COALESCE(pc.citation_count, 0)) AS citation_score,
      LEAST(30.0, 5.0 * COALESCE(pv.volatility_rank, 0)) AS volatility_penalty,
      -- Counts
      COALESCE(pm.mention_count, 0) AS mention_count,
      COALESCE(pc.citation_count, 0) AS citation_count,
      COALESCE(pc.brand_owned_count, 0) AS brand_owned_citations,
      COALESCE(pc.avg_position, 0) AS avg_citation_position,
      COALESCE(pv.volatility_rank, 0) AS volatility_rank,
      -- Previous score
      COALESCE(pps.prev_visibility_score, 0) AS prev_visibility_score
    FROM prompt_answers pa
    LEFT JOIN prompt_mentions pm ON pa.prompt_id = pm.prompt_id AND pa.brand = pm.brand
    LEFT JOIN prompt_citations pc ON pa.prompt_id = pc.prompt_id AND pa.brand = pc.brand
    LEFT JOIN prompt_volatility pv ON pa.prompt_id = pv.prompt_id AND pa.brand = pv.brand
    LEFT JOIN prev_prompt_scores pps ON pa.prompt_id = pps.prompt_id AND pa.brand = pps.brand
  ),

  -- Final score computation
  final_scores AS (
    SELECT
      -- Generate deterministic score_id
      CONCAT('scr_', TO_HEX(SHA256(CONCAT(cps.brand, '_', CAST(cps.event_date AS STRING), '_', cps.prompt_id)))) AS score_id,
      cps.brand,
      cps.event_date,
      cps.prompt_id,
      cps.run_id,
      -- Compute visibility score (clamped to 0-100)
      ROUND(GREATEST(0, LEAST(100, cps.mention_score + cps.citation_score - cps.volatility_penalty)), 2) AS visibility_score,
      ROUND(cps.citation_score, 2) AS citation_score,
      ROUND(cps.mention_score, 2) AS mention_score,
      CAST(NULL AS FLOAT64) AS sentiment_score,
      -- Counts (for per-prompt, total_prompts = 1)
      1 AS total_prompts,
      CASE WHEN cps.citation_count > 0 THEN 1 ELSE 0 END AS prompts_with_citation,
      CASE WHEN cps.mention_count > 0 THEN 1 ELSE 0 END AS prompts_with_mention,
      cps.citation_count AS total_citations,
      cps.mention_count AS total_mentions,
      ROUND(cps.avg_citation_position, 2) AS avg_citation_position,
      -- Change from previous day
      ROUND(
        GREATEST(0, LEAST(100, cps.mention_score + cps.citation_score - cps.volatility_penalty)) - cps.prev_visibility_score,
        2
      ) AS score_change,
      ROUND(
        SAFE_DIVIDE(
          GREATEST(0, LEAST(100, cps.mention_score + cps.citation_score - cps.volatility_penalty)) - cps.prev_visibility_score,
          NULLIF(cps.prev_visibility_score, 0)
        ) * 100,
        2
      ) AS score_change_pct,
      -- Metadata with formula breakdown
      TO_JSON(STRUCT(
        'v1' AS formula_version,
        cps.mention_score AS mention_component,
        cps.citation_score AS citation_component,
        cps.volatility_penalty AS volatility_penalty,
        cps.volatility_rank AS volatility_rank
      )) AS metadata
    FROM combined_prompt_scores cps
  )

  SELECT * FROM final_scores
  QUALIFY ROW_NUMBER() OVER (PARTITION BY brand, event_date, prompt_id ORDER BY visibility_score DESC) = 1
) AS source

ON target.brand = source.brand
   AND target.event_date = source.event_date
   AND target.prompt_id = source.prompt_id

WHEN MATCHED THEN UPDATE SET
  run_id = source.run_id,
  visibility_score = source.visibility_score,
  citation_score = source.citation_score,
  mention_score = source.mention_score,
  sentiment_score = source.sentiment_score,
  total_prompts = source.total_prompts,
  prompts_with_citation = source.prompts_with_citation,
  prompts_with_mention = source.prompts_with_mention,
  total_citations = source.total_citations,
  total_mentions = source.total_mentions,
  avg_citation_position = source.avg_citation_position,
  score_change = source.score_change,
  score_change_pct = source.score_change_pct,
  metadata = source.metadata

WHEN NOT MATCHED THEN INSERT (
  score_id,
  brand,
  event_date,
  prompt_id,
  run_id,
  visibility_score,
  citation_score,
  mention_score,
  sentiment_score,
  total_prompts,
  prompts_with_citation,
  prompts_with_mention,
  total_citations,
  total_mentions,
  avg_citation_position,
  score_change,
  score_change_pct,
  metadata,
  created_at
)
VALUES (
  source.score_id,
  source.brand,
  source.event_date,
  source.prompt_id,
  source.run_id,
  source.visibility_score,
  source.citation_score,
  source.mention_score,
  source.sentiment_score,
  source.total_prompts,
  source.prompts_with_citation,
  source.prompts_with_mention,
  source.total_citations,
  source.total_mentions,
  source.avg_citation_position,
  source.score_change,
  source.score_change_pct,
  source.metadata,
  CURRENT_TIMESTAMP()
);
