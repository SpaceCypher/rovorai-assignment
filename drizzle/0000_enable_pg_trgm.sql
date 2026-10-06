-- Trigram matching backs the ILIKE ticket search index created in the next migration.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
