-- Full-text search support for marketplace product search.
-- Run via: npm run db:indexes  (after prisma db push)

-- Expression GIN index matching the tsvector expression used in
-- src/backend/lib/search.ts. Keep the two in sync.
CREATE INDEX IF NOT EXISTS "Product_fts_idx" ON "Product" USING GIN (
  to_tsvector(
    'english',
    coalesce("title", '') || ' ' || coalesce("description", '') || ' ' || coalesce("category", '')
  )
);

-- Trigram index supporting the ILIKE partial-match fallback on titles.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "Product_title_trgm_idx" ON "Product" USING GIN ("title" gin_trgm_ops);
