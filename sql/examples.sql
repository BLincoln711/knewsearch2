-- examples.sql
-- Example queries for KnewSearch AEO Visibility Platform
-- Dataset: knewsearch_aeo

--------------------------------------------------------------------------------
-- 1. LATEST ANSWER PER PROMPT
-- Retrieves the most recent AI answer for each prompt
--------------------------------------------------------------------------------

-- Option A: Using QUALIFY with ROW_NUMBER (preferred for BigQuery)
SELECT
  prompt_id,
  prompt_text,
  brand,
  answer_id,
  raw_answer,
  event_date,
  created_at
FROM `knewsearch_aeo.ai_answers`
WHERE event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
QUALIFY ROW_NUMBER() OVER (
  PARTITION BY prompt_id
  ORDER BY event_date DESC, created_at DESC
) = 1
ORDER BY brand, prompt_id;

-- Option B: Using subquery (more portable SQL)
SELECT a.*
FROM `knewsearch_aeo.ai_answers` a
INNER JOIN (
  SELECT
    prompt_id,
    MAX(event_date) AS max_date
  FROM `knewsearch_aeo.ai_answers`
  WHERE event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  GROUP BY prompt_id
) latest ON a.prompt_id = latest.prompt_id
        AND a.event_date = latest.max_date
WHERE a.event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
ORDER BY a.brand, a.prompt_id;


--------------------------------------------------------------------------------
-- 2. CITATION TREND OVER TIME
-- Shows how citation counts and domains change day-over-day
--------------------------------------------------------------------------------

-- Daily citation counts by domain
SELECT
  event_date,
  domain,
  COUNT(*) AS citation_count,
  COUNT(DISTINCT prompt_id) AS unique_prompts_cited,
  COUNT(DISTINCT answer_id) AS unique_answers,
  AVG(position) AS avg_position
FROM `knewsearch_aeo.citations`
WHERE event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY event_date, domain
ORDER BY event_date DESC, citation_count DESC;

-- Weekly citation trend with week-over-week change
WITH weekly_citations AS (
  SELECT
    DATE_TRUNC(event_date, WEEK) AS week_start,
    domain,
    COUNT(*) AS citations,
    AVG(position) AS avg_position
  FROM `knewsearch_aeo.citations`
  WHERE event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
  GROUP BY week_start, domain
),
with_lag AS (
  SELECT
    *,
    LAG(citations) OVER (PARTITION BY domain ORDER BY week_start) AS prev_week_citations
  FROM weekly_citations
)
SELECT
  week_start,
  domain,
  citations,
  prev_week_citations,
  citations - COALESCE(prev_week_citations, 0) AS citation_change,
  SAFE_DIVIDE(citations - prev_week_citations, prev_week_citations) * 100 AS pct_change,
  avg_position
FROM with_lag
ORDER BY week_start DESC, citations DESC;

-- Top 10 most cited domains in the last 7 days
SELECT
  domain,
  COUNT(*) AS total_citations,
  COUNT(DISTINCT prompt_id) AS prompts_citing,
  COUNTIF(is_brand_owned) AS brand_owned_citations,
  COUNTIF(is_competitor) AS competitor_citations,
  ROUND(AVG(position), 2) AS avg_position
FROM `knewsearch_aeo.citations`
WHERE event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
GROUP BY domain
ORDER BY total_citations DESC
LIMIT 10;


--------------------------------------------------------------------------------
-- 3. VISIBILITY SCORE TREND FOR A BRAND
-- Tracks brand visibility over time with trend analysis
--------------------------------------------------------------------------------

-- Daily visibility score trend for a specific brand
SELECT
  event_date,
  brand,
  visibility_score,
  citation_score,
  mention_score,
  sentiment_score,
  score_change,
  score_change_pct,
  total_prompts,
  prompts_with_citation,
  prompts_with_mention,
  ROUND(SAFE_DIVIDE(prompts_with_citation, total_prompts) * 100, 2) AS citation_rate_pct,
  ROUND(SAFE_DIVIDE(prompts_with_mention, total_prompts) * 100, 2) AS mention_rate_pct
FROM `knewsearch_aeo.visibility_scores`
WHERE brand = 'Acme Corp'  -- Replace with target brand
  AND event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  AND prompt_id IS NULL  -- Aggregate scores only (not per-prompt)
ORDER BY event_date DESC;

-- Weekly visibility trend with moving average
WITH daily_scores AS (
  SELECT
    event_date,
    brand,
    visibility_score
  FROM `knewsearch_aeo.visibility_scores`
  WHERE brand = 'Acme Corp'  -- Replace with target brand
    AND event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
    AND prompt_id IS NULL
)
SELECT
  event_date,
  brand,
  visibility_score,
  AVG(visibility_score) OVER (
    ORDER BY event_date
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ) AS seven_day_moving_avg,
  AVG(visibility_score) OVER (
    ORDER BY event_date
    ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
  ) AS thirty_day_moving_avg
FROM daily_scores
ORDER BY event_date DESC;

-- Brand comparison: visibility scores across multiple brands
SELECT
  event_date,
  brand,
  visibility_score,
  RANK() OVER (PARTITION BY event_date ORDER BY visibility_score DESC) AS daily_rank
FROM `knewsearch_aeo.visibility_scores`
WHERE event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
  AND prompt_id IS NULL
ORDER BY event_date DESC, visibility_score DESC;

-- Visibility score breakdown by prompt category
SELECT
  vs.event_date,
  vs.brand,
  p.category,
  AVG(vs.visibility_score) AS avg_visibility_score,
  COUNT(*) AS prompt_count
FROM `knewsearch_aeo.visibility_scores` vs
JOIN `knewsearch_aeo.prompts` p ON vs.prompt_id = p.prompt_id
WHERE vs.brand = 'Acme Corp'  -- Replace with target brand
  AND vs.event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  AND vs.prompt_id IS NOT NULL  -- Per-prompt scores
GROUP BY vs.event_date, vs.brand, p.category
ORDER BY vs.event_date DESC, avg_visibility_score DESC;


--------------------------------------------------------------------------------
-- BONUS: Useful operational queries
--------------------------------------------------------------------------------

-- Recent run status
SELECT
  run_id,
  run_type,
  status,
  started_at,
  completed_at,
  TIMESTAMP_DIFF(completed_at, started_at, SECOND) AS duration_seconds,
  total_prompts,
  successful_prompts,
  failed_prompts,
  ROUND(SAFE_DIVIDE(successful_prompts, total_prompts) * 100, 2) AS success_rate_pct
FROM `knewsearch_aeo.answer_runs`
ORDER BY started_at DESC
LIMIT 10;

-- Failed prompts in the last run
SELECT
  ar.run_id,
  aa.prompt_id,
  aa.prompt_text,
  aa.brand,
  ar.error_message
FROM `knewsearch_aeo.answer_runs` ar
CROSS JOIN UNNEST([ar.run_id]) AS run_ref
LEFT JOIN `knewsearch_aeo.ai_answers` aa ON aa.run_id = run_ref
WHERE ar.status = 'completed'
  AND ar.failed_prompts > 0
ORDER BY ar.started_at DESC
LIMIT 20;

-- Entity extraction summary for a brand
SELECT
  entity_type,
  entity_text,
  SUM(mention_count) AS total_mentions,
  COUNT(DISTINCT answer_id) AS answers_mentioning,
  COUNTIF(sentiment = 'positive') AS positive_mentions,
  COUNTIF(sentiment = 'neutral') AS neutral_mentions,
  COUNTIF(sentiment = 'negative') AS negative_mentions
FROM `knewsearch_aeo.entities`
WHERE brand = 'Acme Corp'  -- Replace with target brand
  AND event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
GROUP BY entity_type, entity_text
ORDER BY total_mentions DESC
LIMIT 20;
