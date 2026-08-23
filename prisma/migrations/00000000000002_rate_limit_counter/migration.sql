-- Shared rate-limit counters.
--
-- Without this table the Postgres limiter has nothing to write to, every
-- limited request throws, and `rate-limit.ts` falls back to the per-process
-- in-memory map — which is exactly the per-instance behaviour the Postgres
-- backend exists to replace. The schema change is useless without the
-- migration, so they ship together.
--
-- One row per key per fixed window. `expiresAt` marks when the row is dead;
-- the application sweeps expired rows opportunistically, and the index makes
-- that sweep a range scan rather than a table scan.

CREATE TABLE "RateLimitCounter" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitCounter_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "RateLimitCounter_expiresAt_idx" ON "RateLimitCounter"("expiresAt");
