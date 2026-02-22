-- brand_scores.sql
-- Computes daily aggregate visibility scores per brand
-- Merges into visibility_scores table with prompt_id = NULL for aggregates
--
-- Score formula:
--   base_score = 50 if brand mentioned in entities for that date else 0
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
  WITH brand_metrics AS (
    -- Get all active brands from prompts table
    SELECT DISTINCT brand
    FROM `@project_id.@dataset.prompts`
    WHERE brand IS NOT NULL
      AND is_active = TRUE
  ),

  -- Count brand mentions per brand for the date
  entity_counts AS (
    SELECT
      e.brand,
      COUNT(DISTINCT e.prompt_id) AS prompts_with_mention,
      SUM(e.mention_count) AS total_mentions,
      COUNTIF(e.is_target_brand = TRUE) AS target_brand_mentions
    FROM `@project_id.@dataset.entities` e
    WHERE e.event_date = @target_date
      AND e.brand IS NOT NULL
      AND e.is_target_brand = TRUE
    GROUP BY e.brand
  ),

  -- Count citations per brand for the date
  citation_counts AS (
    SELECT
      c.brand,
      COUNT(*) AS total_citations,
      COUNT(DISTINCT c.prompt_id) AS prompts_with_citation,
      COUNTIF(c.is_brand_owned = TRUE) AS brand_owned_citations,
      AVG(c.position) AS avg_citation_position
    FROM `@project_id.@dataset.citations` c
    WHERE c.event_date = @target_date
      AND c.brand IS NOT NULL
    GROUP BY c.brand
  ),

  -- Count total prompts evaluated per brand for the date
  prompt_counts AS (
    SELECT
      a.brand,
      COUNT(DISTINCT a.prompt_id) AS total_prompts
    FROM `@project_id.@dataset.ai_answers` a
    WHERE a.event_date = @target_date
      AND a.brand IS NOT NULL
    GROUP BY a.brand
  ),

  -- Compute volatility from ai_answers metadata
  volatility_metrics AS (
    SELECT
      a.brand,
      AVG(
        CASE
          WHEN JSON_VALUE(a.metadata, '$.is_first_answer') = 'true' THEN 0
          WHEN CAST(JSON_VALUE(a.metadata, '$.similarity_score') AS FLOAT64) >= 0.95 THEN 0
          WHEN CAST(JSON_VALUE(a.metadata, '$.similarity_score') AS FLOAT64) >= 0.85 THEN 1
          WHEN CAST(JSON_VALUE(a.metadata, '$.similarity_score') AS FLOAT64) >= 0.70 THEN 2
          WHEN CAST(JSON_VALUE(a.metadata, '$.similarity_score') AS FLOAT64) >= 0.50 THEN 3
          WHEN CAST(JSON_VALUE(a.metadata, '$.similarity_score') AS FLOAT64) >= 0.30 THEN 4
          WHEN CAST(JSON_VALUE(a.metadata, '$.similarity_score') AS FLOAT64) >= 0.10 THEN 5
          ELSE 6
        END
      ) AS avg_volatility_rank
    FROM `@project_id.@dataset.ai_answers` a
    WHERE a.event_date = @target_date
      AND a.brand IS NOT NULL
    GROUP BY a.brand
  ),

  -- Combine all metrics and compute score
  combined_scores AS (
    SELECT
      bm.brand,
      @target_date AS event_date,
      -- Score components
      CASE WHEN COALESCE(ec.total_mentions, 0) > 0 THEN 50.0 ELSE 0.0 END AS mention_score,
      LEAST(50.0, 10.0 * COALESCE(cc.total_citations, 0)) AS citation_score,
      LEAST(30.0, 5.0 * COALESCE(vm.avg_volatility_rank, 0)) AS volatility_penalty,
      -- Raw counts
      COALESCE(pc.total_prompts, 0) AS total_prompts,
      COALESCE(cc.prompts_with_citation, 0) AS prompts_with_citation,
      COALESCE(ec.prompts_with_mention, 0) AS prompts_with_mention,
      COALESCE(cc.total_citations, 0) AS total_citations,
      COALESCE(ec.total_mentions, 0) AS total_mentions,
      COALESCE(cc.avg_citation_position, 0) AS avg_citation_position,
      COALESCE(vm.avg_volatility_rank, 0) AS avg_volatility_rank
    FROM brand_metrics bm
    LEFT JOIN entity_counts ec ON bm.brand = ec.brand
    LEFT JOIN citation_counts cc ON bm.brand = cc.brand
    LEFT JOIN prompt_counts pc ON bm.brand = pc.brand
    LEFT JOIN volatility_metrics vm ON bm.brand = vm.brand
    WHERE pc.total_prompts > 0  -- Only score brands with prompts run today
  ),

  -- Get previous day score for change calculation (deduplicated)
  prev_scores AS (
    SELECT
      brand,
      visibility_score AS prev_visibility_score
    FROM `@project_id.@dataset.visibility_scores`
    WHERE event_date = DATE_SUB(@target_date, INTERVAL 1 DAY)
      AND prompt_id IS NULL
    QUALIFY ROW_NUMBER() OVER (PARTITION BY brand ORDER BY created_at DESC) = 1
  ),

  -- Final score computation
  final_scores AS (
    SELECT
      -- Generate deterministic score_id
      CONCAT('scr_', TO_HEX(SHA256(CONCAT(cs.brand, '_', CAST(cs.event_date AS STRING), '_aggregate')))) AS score_id,
      cs.brand,
      cs.event_date,
      CAST(NULL AS STRING) AS prompt_id,  -- NULL indicates aggregate score
      CAST(NULL AS STRING) AS run_id,
      -- Compute visibility score (clamped to 0-100)
      ROUND(GREATEST(0, LEAST(100, cs.mention_score + cs.citation_score - cs.volatility_penalty)), 2) AS visibility_score,
      ROUND(cs.citation_score, 2) AS citation_score,
      ROUND(cs.mention_score, 2) AS mention_score,
      CAST(NULL AS FLOAT64) AS sentiment_score,  -- Not computed in this version
      -- Counts
      cs.total_prompts,
      cs.prompts_with_citation,
      cs.prompts_with_mention,
      cs.total_citations,
      cs.total_mentions,
      ROUND(cs.avg_citation_position, 2) AS avg_citation_position,
      -- Change from previous day
      ROUND(
        GREATEST(0, LEAST(100, cs.mention_score + cs.citation_score - cs.volatility_penalty)) - COALESCE(ps.prev_visibility_score, 0),
        2
      ) AS score_change,
      ROUND(
        SAFE_DIVIDE(
          GREATEST(0, LEAST(100, cs.mention_score + cs.citation_score - cs.volatility_penalty)) - COALESCE(ps.prev_visibility_score, 0),
          NULLIF(ps.prev_visibility_score, 0)
        ) * 100,
        2
      ) AS score_change_pct,
      -- Metadata with formula breakdown
      TO_JSON(STRUCT(
        'v1' AS formula_version,
        cs.mention_score AS mention_component,
        cs.citation_score AS citation_component,
        cs.volatility_penalty AS volatility_penalty,
        cs.avg_volatility_rank AS avg_volatility_rank
      )) AS metadata
    FROM combined_scores cs
    LEFT JOIN prev_scores ps ON cs.brand = ps.brand
  )

  SELECT * FROM final_scores
) AS source

ON target.brand = source.brand
   AND target.event_date = source.event_date
   AND target.prompt_id IS NULL  -- Match aggregate records only

WHEN MATCHED THEN UPDATE SET
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
