-- Seller identity (KYC), and the listing gate it unlocks.
--
-- Two things ship together because neither is useful alone: the record of who a
-- seller is, and the flag that decides whether their store is discoverable.
--
-- `Shop.isListed` defaults to false, but every EXISTING shop is backfilled to
-- true at the bottom of this migration. Sellers who were already trading are not
-- retroactively delisted by a compliance feature they never agreed to; the gate
-- applies to stores created from here on.

CREATE TYPE "KycTier" AS ENUM ('TIER_0', 'TIER_1', 'TIER_2');
CREATE TYPE "KycStatus" AS ENUM ('NOT_STARTED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED');
CREATE TYPE "KycIdType" AS ENUM ('PAN', 'PASSPORT', 'DRIVING_LICENCE', 'VOTER_ID', 'AADHAAR_MASKED');

CREATE TABLE "SellerKyc" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" "KycTier" NOT NULL DEFAULT 'TIER_0',
    "status" "KycStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "legalName" TEXT,
    "undertakingAt" TIMESTAMP(3),
    "undertakingVersion" TEXT,
    "idType" "KycIdType",
    "idLast4" TEXT,
    "idHash" TEXT,
    "documentPath" TEXT,
    "documentDeletedAt" TIMESTAMP(3),
    "gstin" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerKyc_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SellerKyc_userId_key" ON "SellerKyc"("userId");
CREATE INDEX "SellerKyc_status_submittedAt_idx" ON "SellerKyc"("status", "submittedAt");
CREATE INDEX "SellerKyc_idHash_idx" ON "SellerKyc"("idHash");

ALTER TABLE "SellerKyc" ADD CONSTRAINT "SellerKyc_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SetNull, not Cascade: deleting the admin who reviewed a case must not delete
-- the case. The decision outlives the reviewer's account.
ALTER TABLE "SellerKyc" ADD CONSTRAINT "SellerKyc_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Only the last four characters of an identifier may be stored. A wider column
-- would let a future code path quietly write the whole thing.
ALTER TABLE "SellerKyc" ADD CONSTRAINT "SellerKyc_idLast4_is_short"
  CHECK ("idLast4" IS NULL OR char_length("idLast4") <= 4);

-- A submitted case must carry a submission time, so the review queue can be
-- ordered and an SLA measured against it.
ALTER TABLE "SellerKyc" ADD CONSTRAINT "SellerKyc_submitted_has_timestamp"
  CHECK ("status" <> 'PENDING_REVIEW' OR "submittedAt" IS NOT NULL);

-- A rejection must say why. A rejection without a reason is one the seller
-- cannot act on and support cannot defend.
ALTER TABLE "SellerKyc" ADD CONSTRAINT "SellerKyc_rejection_has_reason"
  CHECK ("status" <> 'REJECTED' OR ("rejectionReason" IS NOT NULL AND btrim("rejectionReason") <> ''));

ALTER TABLE "Shop" ADD COLUMN "isListed" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Shop_isListed_idx" ON "Shop"("isListed");

-- Backfill: every shop that already exists stays discoverable.
UPDATE "Shop" SET "isListed" = true;
