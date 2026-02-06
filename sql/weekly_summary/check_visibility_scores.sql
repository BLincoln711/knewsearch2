-- check_visibility_scores.sql
-- Quick check to determine if visibility_scores has data for a brand
-- Parameters: @brand, @start_date, @end_date
-- Returns: has_scores (BOOL), row_count (INT64)

SELECT
  COUNT(*) > 0 AS has_scores,
  COUNT(*) AS row_count
FROM `{project}.{dataset}.visibility_scores`
WHERE brand = @brand
  AND event_date BETWEEN @start_date AND @end_date;
