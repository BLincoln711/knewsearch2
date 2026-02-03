-- week_metrics_with_scores.sql
-- Query to pull weekly metrics when visibility_scores table has data
-- Parameters: @brand, @start_date, @end_date, @prev_start_date, @prev_end_date

-- CTE: Current week visibility scores
WITH current_week AS (
  SELECT
    brand,
    AVG(visibility_score) AS avg_visibility_score,
    AVG(citation_score) AS avg_citation_score,
    AVG(mention_score) AS avg_mention_score,
    AVG(sentiment_score) AS avg_sentiment_score,
    SUM(total_prompts) AS total_prompts,
    SUM(prompts_with_citation) AS prompts_with_citation,
    SUM(prompts_with_mention) AS prompts_with_mention,
    SUM(total_citations) AS total_citations,
    SUM(total_mentions) AS total_mentions,
    AVG(avg_citation_position) AS avg_citation_position
  FROM `{project}.{dataset}.visibility_scores`
  WHERE brand = @brand
    AND event_date BETWEEN @start_date AND @end_date
  GROUP BY brand
),

-- CTE: Previous week visibility scores for comparison
previous_week AS (
  SELECT
    brand,
    AVG(visibility_score) AS avg_visibility_score,
    AVG(citation_score) AS avg_citation_score,
    AVG(mention_score) AS avg_mention_score
  FROM `{project}.{dataset}.visibility_scores`
  WHERE brand = @brand
    AND event_date BETWEEN @prev_start_date AND @prev_end_date
  GROUP BY brand
),

-- CTE: Best performing prompts by visibility score
best_prompts AS (
  SELECT
    prompt_id,
    AVG(visibility_score) AS avg_score
  FROM `{project}.{dataset}.visibility_scores`
  WHERE brand = @brand
    AND event_date BETWEEN @start_date AND @end_date
    AND prompt_id IS NOT NULL
  GROUP BY prompt_id
  ORDER BY avg_score DESC
  LIMIT 5
),

-- CTE: Worst performing prompts by visibility score
worst_prompts AS (
  SELECT
    prompt_id,
    AVG(visibility_score) AS avg_score
  FROM `{project}.{dataset}.visibility_scores`
  WHERE brand = @brand
    AND event_date BETWEEN @start_date AND @end_date
    AND prompt_id IS NOT NULL
  GROUP BY prompt_id
  ORDER BY avg_score ASC
  LIMIT 5
),

-- CTE: Top cited domains from citations table
top_domains AS (
  SELECT
    domain,
    COUNT(*) AS citation_count,
    COUNTIF(is_brand_owned = TRUE) AS brand_owned_count,
    COUNTIF(is_competitor = TRUE) AS competitor_count
  FROM `{project}.{dataset}.citations`
  WHERE brand = @brand
    AND event_date BETWEEN @start_date AND @end_date
  GROUP BY domain
  ORDER BY citation_count DESC
  LIMIT 10
),

-- CTE: Score volatility (daily variance)
volatility AS (
  SELECT
    STDDEV(visibility_score) AS score_volatility,
    MAX(visibility_score) - MIN(visibility_score) AS score_range
  FROM `{project}.{dataset}.visibility_scores`
  WHERE brand = @brand
    AND event_date BETWEEN @start_date AND @end_date
),

-- CTE: Top competitors from entities
top_competitors AS (
  SELECT
    entity_text AS competitor,
    COUNT(*) AS mention_count
  FROM `{project}.{dataset}.entities`
  WHERE brand = @brand
    AND event_date BETWEEN @start_date AND @end_date
    AND is_competitor = TRUE
  GROUP BY entity_text
  ORDER BY mention_count DESC
  LIMIT 5
)

-- Main query combining all metrics
SELECT
  @brand AS brand,
  @start_date AS week_start_date,
  @end_date AS week_end_date,

  -- Current week metrics
  cw.avg_visibility_score,
  cw.avg_citation_score,
  cw.avg_mention_score,
  cw.avg_sentiment_score,
  cw.total_prompts,
  cw.prompts_with_citation,
  cw.prompts_with_mention,
  cw.total_citations,
  cw.total_mentions,
  cw.avg_citation_position,

  -- Week over week changes
  COALESCE(cw.avg_visibility_score - pw.avg_visibility_score, 0) AS visibility_change,
  CASE
    WHEN pw.avg_visibility_score > 0
    THEN ROUND((cw.avg_visibility_score - pw.avg_visibility_score) / pw.avg_visibility_score * 100, 2)
    ELSE NULL
  END AS visibility_change_pct,
  CASE
    WHEN cw.avg_visibility_score > pw.avg_visibility_score THEN 'up'
    WHEN cw.avg_visibility_score < pw.avg_visibility_score THEN 'down'
    ELSE 'stable'
  END AS visibility_trend,

  -- Volatility
  v.score_volatility,
  v.score_range,

  -- Arrays for structured data
  ARRAY(SELECT AS STRUCT prompt_id, avg_score FROM best_prompts) AS best_prompts,
  ARRAY(SELECT AS STRUCT prompt_id, avg_score FROM worst_prompts) AS worst_prompts,
  ARRAY(SELECT AS STRUCT domain, citation_count, brand_owned_count, competitor_count FROM top_domains) AS top_domains,
  ARRAY(SELECT AS STRUCT competitor, mention_count FROM top_competitors) AS top_competitors

FROM current_week cw
LEFT JOIN previous_week pw ON cw.brand = pw.brand
CROSS JOIN volatility v;
