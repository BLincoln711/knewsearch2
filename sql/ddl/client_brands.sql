-- client_brands - Maps clients (orgs) to their authorized brands
-- Primary client data lives in Firestore; this BQ table is a
-- denormalized copy for efficient query-time filtering in BigQuery.

CREATE TABLE IF NOT EXISTS `knewsearch-prod.knewsearch_aeo.client_brands` (
  client_id   STRING    NOT NULL OPTIONS(description = 'Maps to Firestore /clients/{clientId}'),
  brand       STRING    NOT NULL OPTIONS(description = 'Brand name matching prompts.brand'),
  is_active   BOOL      DEFAULT TRUE OPTIONS(description = 'Whether this mapping is active'),
  added_at    TIMESTAMP NOT NULL OPTIONS(description = 'When this brand was assigned to client')
);
