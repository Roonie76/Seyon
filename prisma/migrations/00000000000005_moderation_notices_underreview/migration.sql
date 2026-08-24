-- Moderation, complaints, notices, and the quiet "under review" state.
--
-- Four things that were missing, and the reason each one is a constraint here
-- rather than only a rule in TypeScript: application checks are bypassed the
-- first time somebody fixes a row by hand in psql, and that is exactly when an
-- unexplained hide or an unacknowledged complaint gets written.
--
-- NOTE for whoever regenerates this with `prisma migrate diff`: the generator
-- emits `DROP INDEX "Product_title_trgm_idx"` because that index is created
-- out of band by prisma/sql/fts-indexes.sql (`npm run db:indexes`) and Prisma
-- cannot express a GIN trigram index in the schema, so it believes the index
-- is unwanted. It is not. Deleting it silently guts product search. That line
-- has been removed here deliberately — remove it again next time.

-- CreateEnum
CREATE TYPE "ReportCategory" AS ENUM ('COUNTERFEIT', 'PROHIBITED_ITEM', 'FRAUD_OR_SCAM', 'MISLEADING_LISTING', 'OFFENSIVE_CONTENT', 'IMPERSONATION', 'NON_DELIVERY', 'OTHER');

-- CreateEnum
CREATE TYPE "NoticeKind" AS ENUM ('WARNING', 'POLICY_VIOLATION', 'INFORMATION_REQUEST', 'SUSPENSION', 'REINSTATEMENT');

-- AlterEnum
ALTER TYPE "ReportStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "acknowledgedAt" TIMESTAMP(3),
ADD COLUMN     "acknowledgedById" TEXT,
ADD COLUMN     "category" "ReportCategory" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "resolutionNote" TEXT,
ADD COLUMN     "resolvedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "hiddenAt" TIMESTAMP(3),
ADD COLUMN     "hiddenById" TEXT,
ADD COLUMN     "hiddenReason" TEXT,
ADD COLUMN     "isHidden" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "isUnderReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "underReviewById" TEXT,
ADD COLUMN     "underReviewReason" TEXT,
ADD COLUMN     "underReviewSince" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Notice" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "kind" "NoticeKind" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "requiresResponse" BOOLEAN NOT NULL DEFAULT false,
    "respondBy" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailedAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "response" TEXT,

    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notice_shopId_sentAt_idx" ON "Notice"("shopId", "sentAt");

-- CreateIndex
CREATE INDEX "Notice_shopId_readAt_idx" ON "Notice"("shopId", "readAt");

-- CreateIndex
CREATE INDEX "Notice_sentAt_idx" ON "Notice"("sentAt");

-- CreateIndex
CREATE INDEX "Report_shopId_status_idx" ON "Report"("shopId", "status");

-- CreateIndex
CREATE INDEX "Report_category_createdAt_idx" ON "Report"("category", "createdAt");

-- CreateIndex
CREATE INDEX "Report_acknowledgedAt_createdAt_idx" ON "Report"("acknowledgedAt", "createdAt");

-- CreateIndex
CREATE INDEX "Review_shopId_isHidden_createdAt_idx" ON "Review"("shopId", "isHidden", "createdAt");

-- CreateIndex
CREATE INDEX "Review_isHidden_createdAt_idx" ON "Review"("isHidden", "createdAt");

-- CreateIndex
CREATE INDEX "Shop_isUnderReview_idx" ON "Shop"("isUnderReview");

-- AddForeignKey
ALTER TABLE "Shop" ADD CONSTRAINT "Shop_underReviewById_fkey" FOREIGN KEY ("underReviewById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_hiddenById_fkey" FOREIGN KEY ("hiddenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Integrity: the rules the application also enforces, kept where a script
-- cannot route around them.
-- ---------------------------------------------------------------------------

-- A hidden review says why, and when. A review that vanished for no recorded
-- reason is indistinguishable from one deleted to flatter a shop's rating.
ALTER TABLE "Review" ADD CONSTRAINT "Review_hidden_has_reason"
  CHECK ("isHidden" = false OR ("hiddenReason" IS NOT NULL AND btrim("hiddenReason") <> ''));

ALTER TABLE "Review" ADD CONSTRAINT "Review_hidden_has_timestamp"
  CHECK ("isHidden" = false OR "hiddenAt" IS NOT NULL);

-- Same again for a store placed under investigation.
ALTER TABLE "Shop" ADD CONSTRAINT "Shop_under_review_has_reason"
  CHECK ("isUnderReview" = false OR ("underReviewReason" IS NOT NULL AND btrim("underReviewReason") <> ''));

ALTER TABLE "Shop" ADD CONSTRAINT "Shop_under_review_has_timestamp"
  CHECK ("isUnderReview" = false OR "underReviewSince" IS NOT NULL);

-- A complaint cannot reach a terminal state without a disposal timestamp, and
-- cannot be disposed of before it was acknowledged. The second is the ordering
-- the Consumer Protection (E-Commerce) Rules 2020 assume: acknowledge within
-- 48 hours, dispose within a month. Written as NOT IN over the two live states
-- so that the value added by ALTER TYPE above is covered without this
-- statement naming it -- Postgres will not let a new enum label be used in the
-- same transaction that adds it.
ALTER TABLE "Report" ADD CONSTRAINT "Report_terminal_has_resolved_at"
  CHECK ("status" IN ('OPEN', 'UNDER_REVIEW') OR "resolvedAt" IS NOT NULL);

ALTER TABLE "Report" ADD CONSTRAINT "Report_resolved_implies_acknowledged"
  CHECK ("resolvedAt" IS NULL OR "acknowledgedAt" IS NOT NULL);

-- A notice with an empty subject or body is not a notice.
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_has_content"
  CHECK (btrim("subject") <> '' AND btrim("body") <> '');

ALTER TABLE "Notice" ADD CONSTRAINT "Notice_response_has_content"
  CHECK ("respondedAt" IS NULL OR ("response" IS NOT NULL AND btrim("response") <> ''));

ALTER TABLE "Notice" ADD CONSTRAINT "Notice_respond_by_needs_flag"
  CHECK ("respondBy" IS NULL OR "requiresResponse" = true);

-- The audit CHECK gains the new destructive actions. Hiding a review and
-- de-ranking a store both cost someone something, so both must explain
-- themselves in the same way a suspension does.
ALTER TABLE "AdminAction" DROP CONSTRAINT "AdminAction_destructive_has_reason";

ALTER TABLE "AdminAction" ADD CONSTRAINT "AdminAction_destructive_has_reason"
  CHECK (
    "action" NOT IN (
      'SUSPEND_SHOP','DELETE_PRODUCT','DELETE_SHOP','GRANT_ADMIN','REVOKE_ADMIN',
      'HIDE_REVIEW','MARK_UNDER_REVIEW','REJECT_REPORT'
    )
    OR ("reason" IS NOT NULL AND btrim("reason") <> '')
  );
