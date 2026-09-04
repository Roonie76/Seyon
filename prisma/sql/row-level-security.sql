-- Row-level security on every table in `public`.
--
-- This is not expressible in schema.prisma, so it lives here alongside the
-- full-text indexes for the same reason: it is database state the application
-- depends on that `prisma db push` neither creates nor removes. A fresh
-- environment gets it by running `npm run db:rls`.
--
-- WHY
--
-- Supabase exposes every table in `public` over PostgREST to anyone holding
-- the anon key — a credential that is public by design and ships in browsers.
-- With RLS off and no policies, that key could read and write every row.
-- Harmless while the tables were empty; not harmless once SellerKyc holds
-- identity hashes and User holds sellers' phone numbers.
--
-- WHY THIS DOES NOT BREAK THE APPLICATION
--
-- Nothing in Seyon reaches Postgres through PostgREST. Prisma connects as
-- `postgres`, which owns these tables and carries the BYPASSRLS attribute
-- (checked on pg_roles: rolsuper is false, rolbypassrls is true — it is the
-- attribute, not superuser status, that does the work). The storage client
-- uses the service_role key, which also carries BYPASSRLS. `anon` and
-- `authenticated` carry neither.
--
-- ENABLE, NEVER FORCE
--
-- `FORCE ROW LEVEL SECURITY` strips the owner's exemption. Adding it to any
-- table here would take every Prisma query against that table down at once,
-- with no policies to fall back on. If a future change genuinely needs FORCE,
-- it needs policies written first.
--
-- Idempotent: enabling RLS on a table that already has it is a no-op.

ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."VerificationToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Shop" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ShopSlugHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WhatsappVerification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ProductImage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ProductVariant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Upload" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Review" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Report" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Analytics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Wishlist" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SellerKyc" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AdminAction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Notice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BlogPost" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BlogTopic" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RateLimitCounter" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_prisma_migrations" ENABLE ROW LEVEL SECURITY;
