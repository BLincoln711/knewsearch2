-- Seed client_brands for development/testing
-- Maps existing Hendricks.AI brand to a test client

INSERT INTO `knewsearch-prod.knewsearch_aeo.client_brands`
  (client_id, brand, is_active, added_at)
VALUES
  ('demo_client_001', 'Hendricks.AI', TRUE, CURRENT_TIMESTAMP());
