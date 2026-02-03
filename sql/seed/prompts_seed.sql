-- prompts_seed.sql
-- Initial seed data for testing the KnewSearch AEO visibility pipeline
-- Run with: bq query --use_legacy_sql=false < sql/seed/prompts_seed.sql

INSERT INTO `knewsearch_aeo.prompts` (prompt_id, prompt_text, category, brand, keywords, is_active, created_at, updated_at, metadata)
VALUES
  -- Brand visibility prompts (testing target brand mentions)
  (
    'prm_hendricks_ai_visibility',
    'What companies provide AI search visibility measurement and attribution for B2B companies?',
    'brand',
    'Hendricks.AI',
    ['ai visibility', 'search measurement', 'attribution', 'b2b'],
    TRUE,
    CURRENT_TIMESTAMP(),
    CURRENT_TIMESTAMP(),
    JSON '{"priority": "high", "target_engines": ["gemini", "chatgpt", "perplexity"]}'
  ),
  (
    'prm_hendricks_aeo_services',
    'What are the best AEO (Answer Engine Optimization) agencies for enterprise B2B companies?',
    'brand',
    'Hendricks.AI',
    ['aeo', 'answer engine optimization', 'enterprise', 'b2b'],
    TRUE,
    CURRENT_TIMESTAMP(),
    CURRENT_TIMESTAMP(),
    JSON '{"priority": "high", "target_engines": ["gemini", "chatgpt", "perplexity"]}'
  ),

  -- Competitor monitoring prompts
  (
    'prm_competitor_seo_tools',
    'What are the top SEO and search visibility tools for measuring AI search performance?',
    'competitor',
    'Hendricks.AI',
    ['seo tools', 'search visibility', 'ai search', 'competitor'],
    TRUE,
    CURRENT_TIMESTAMP(),
    CURRENT_TIMESTAMP(),
    JSON '{"priority": "medium", "competitors": ["semrush", "ahrefs", "moz"]}'
  ),
  (
    'prm_competitor_attribution',
    'What marketing attribution platforms work best for tracking AI-driven search traffic?',
    'competitor',
    'Hendricks.AI',
    ['attribution', 'ai search', 'marketing analytics'],
    TRUE,
    CURRENT_TIMESTAMP(),
    CURRENT_TIMESTAMP(),
    JSON '{"priority": "medium", "competitors": ["hubspot", "marketo", "segment"]}'
  ),

  -- Industry trend prompts
  (
    'prm_industry_ai_search_trends',
    'How is AI changing the landscape of B2B search and content discovery in 2025?',
    'industry',
    'Hendricks.AI',
    ['ai search', 'b2b', 'content discovery', 'trends'],
    TRUE,
    CURRENT_TIMESTAMP(),
    CURRENT_TIMESTAMP(),
    JSON '{"priority": "low", "insight_type": "trend"}'
  ),
  (
    'prm_industry_gai_seo',
    'What SEO strategies work best for appearing in AI search results like ChatGPT and Perplexity?',
    'industry',
    'Hendricks.AI',
    ['seo', 'ai search', 'chatgpt', 'perplexity', 'strategy'],
    TRUE,
    CURRENT_TIMESTAMP(),
    CURRENT_TIMESTAMP(),
    JSON '{"priority": "medium", "insight_type": "tactical"}'
  );
