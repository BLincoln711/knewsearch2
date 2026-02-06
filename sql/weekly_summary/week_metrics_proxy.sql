-- week_metrics_proxy.sql
-- Query to pull weekly metrics when visibility_scores is empty
-- Uses ai_answers, entities, and citations as proxy metrics
-- Parameters: @brand, @start_date, @end_date, @prev_start_date, @prev_end_date

-- CTE: Current week answer metrics
WITH current_week_answers AS (
  SELECT
    brand,
    COUNT(DISTINCT answer_id) AS answer_count,
    COUNT(DISTINCT prompt_id) AS unique_prompts,
    COUNT(DISTINCT run_id) AS run_count,
    AVG(token_count_response) AS avg_response_tokens
  FROM `{project}.{dataset}.ai_answers`
  WHERE brand = @brand
    AND event_date BETWEEN @start_date AND @end_date
  GROUP BY brand
),

-- CTE: Previous week answer metrics for comparison
previous_week_answers AS (
  SELECT
    brand,
    COUNT(DISTINCT answer_id) AS answer_count
  FROM `{project}.{dataset}.ai_answers`
  WHERE brand = @brand
    AND event_date BETWEEN @prev_start_date AND @prev_end_date
  GROUP BY brand
),

-- CTE: Current week entity metrics (brand mentions)
current_week_entities AS (
  SELECT
    brand,
    COUNT(*) AS total_entity_mentions,
    COUNTIF(is_target_brand = TRUE) AS target_brand_mentions,
    COUNTIF(is_competitor = TRUE) AS competitor_mentions,
    COUNT(DISTINCT entity_text) AS unique_entities
  FROM `{project}.{dataset}.entities`
  WHERE brand = @brand
    AND event_date BETWEEN @start_date AND @end_date
  GROUP BY brand
),

-- CTE: Previous week entity metrics
previous_week_entities AS (
  SELECT
    brand,
    COUNTIF(is_target_brand = TRUE) AS target_brand_mentions
  FROM `{project}.{dataset}.entities`
  WHERE brand = @brand
    AND event_date BETWEEN @prev_start_date AND @prev_end_date
  GROUP BY brand
),

-- CTE: Current week citation metrics
current_week_citations AS (
  SELECT
    brand,
    COUNT(*) AS total_citations,
    COUNT(DISTINCT domain) AS unique_domains,
    COUNTIF(is_brand_owned = TRUE) AS brand_owned_citations,
    COUNTIF(is_competitor = TRUE) AS competitor_citations,
    AVG(position) AS avg_citation_position
  FROM `{project}.{dataset}.citations`
  WHERE brand = @brand
    AND event_date BETWEEN @start_date AND @end_date
  GROUP BY brand
),

-- CTE: Top entities by mention frequency
top_entities AS (
  SELECT
    entity_text,
    entity_type,
    SUM(mention_count) AS total_mentions,
    is_target_brand,
    is_competitor
  FROM `{project}.{dataset}.entities`
  WHERE brand = @brand
    AND event_date BETWEEN @start_date AND @end_date
  GROUP BY entity_text, entity_type, is_target_brand, is_competitor
  ORDER BY total_mentions DESC
  LIMIT 10
),

-- CTE: Top prompts by answer frequency (proxy for importance)
top_prompts AS (
  SELECT
    prompt_id,
    COUNT(*) AS answer_count,
    AVG(token_count_response) AS avg_response_length
  FROM `{project}.{dataset}.ai_answers`
  WHERE brand = @brand
    AND event_date BETWEEN @start_date AND @end_date
  GROUP BY prompt_id
  ORDER BY answer_count DESC
  LIMIT 10
),

-- CTE: Top cited domains
top_domains AS (
  SELECT
    domain,
    COUNT(*) AS citation_count,
    COUNTIF(is_brand_owned = TRUE) AS brand_owned_count,
    COUNTIF(is_competitor = TRUE) AS competitor_count,
    AVG(position) AS avg_position
  FROM `{project}.{dataset}.citations`
  WHERE brand = @brand
    AND event_date BETWEEN @start_date AND @end_date
  GROUP BY domain
  ORDER BY citation_count DESC
  LIMIT 10
),

-- CTE: Top competitors from entities
top_competitors AS (
  SELECT
    entity_text AS competitor,
    SUM(mention_count) AS mention_count
  FROM `{project}.{dataset}.entities`
  WHERE brand = @brand
    AND event_date BETWEEN @start_date AND @end_date
    AND is_competitor = TRUE
  GROUP BY entity_text
  ORDER BY mention_count DESC
  LIMIT 5
),

-- CTE: Daily answer counts for volatility proxy
daily_activity AS (
  SELECT
    event_date,
    COUNT(*) AS daily_answers
  FROM `{project}.{dataset}.ai_answers`
  WHERE brand = @brand
    AND event_date BETWEEN @start_date AND @end_date
  GROUP BY event_date
)

-- Main query combining all proxy metrics
SELECT
  @brand AS brand,
  @start_date AS week_start_date,
  @end_date AS week_end_date,

  -- Answer metrics
  COALESCE(cwa.answer_count, 0) AS answers_analyzed,
  COALESCE(cwa.unique_prompts, 0) AS prompts_analyzed,
  COALESCE(cwa.run_count, 0) AS run_count,
  cwa.avg_response_tokens,

  -- Entity metrics
  COALESCE(cwe.total_entity_mentions, 0) AS total_entity_mentions,
  COALESCE(cwe.target_brand_mentions, 0) AS target_brand_mentions,
  COALESCE(cwe.competitor_mentions, 0) AS competitor_mentions,
  COALESCE(cwe.unique_entities, 0) AS unique_entities,

  -- Citation metrics
  COALESCE(cwc.total_citations, 0) AS total_citations,
  COALESCE(cwc.unique_domains, 0) AS unique_domains,
  COALESCE(cwc.brand_owned_citations, 0) AS brand_owned_citations,
  COALESCE(cwc.competitor_citations, 0) AS competitor_citations,
  cwc.avg_citation_position,

  -- Week over week changes (proxy: brand mention change)
  COALESCE(cwe.target_brand_mentions, 0) - COALESCE(pwe.target_brand_mentions, 0) AS mention_change,
  CASE
    WHEN COALESCE(pwe.target_brand_mentions, 0) > 0
    THEN ROUND((COALESCE(cwe.target_brand_mentions, 0) - pwe.target_brand_mentions) / pwe.target_brand_mentions * 100, 2)
    ELSE NULL
  END AS mention_change_pct,

  -- Answer volume change
  COALESCE(cwa.answer_count, 0) - COALESCE(pwa.answer_count, 0) AS answer_volume_change,

  -- Trend based on brand mentions
  CASE
    WHEN COALESCE(cwe.target_brand_mentions, 0) > COALESCE(pwe.target_brand_mentions, 0) THEN 'up'
    WHEN COALESCE(cwe.target_brand_mentions, 0) < COALESCE(pwe.target_brand_mentions, 0) THEN 'down'
    ELSE 'stable'
  END AS visibility_trend,

  -- Activity volatility (stddev of daily answer counts)
  (SELECT STDDEV(daily_answers) FROM daily_activity) AS activity_volatility,

  -- Structured arrays
  ARRAY(SELECT AS STRUCT entity_text, entity_type, total_mentions, is_target_brand, is_competitor FROM top_entities) AS top_entities,
  ARRAY(SELECT AS STRUCT prompt_id, answer_count, avg_response_length FROM top_prompts) AS top_prompts,
  ARRAY(SELECT AS STRUCT domain, citation_count, brand_owned_count, competitor_count, avg_position FROM top_domains) AS top_domains,
  ARRAY(SELECT AS STRUCT competitor, mention_count FROM top_competitors) AS top_competitors

FROM current_week_answers cwa
LEFT JOIN previous_week_answers pwa ON cwa.brand = pwa.brand
LEFT JOIN current_week_entities cwe ON cwa.brand = cwe.brand
LEFT JOIN previous_week_entities pwe ON cwa.brand = pwe.brand
LEFT JOIN current_week_citations cwc ON cwa.brand = cwc.brand;
