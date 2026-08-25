-- Reports gain a target.
--
-- Until now `Report` could only be about a shop, so a buyer could report a
-- store and nobody could report a review. Hiding a defamatory or fake review
-- was possible, but only if an admin happened to read it: twenty one-star
-- reviews in an hour and a genuinely bad week looked identical from the admin
-- side, because neither produced anything in the queue.
--
-- One polymorphic Report rather than a separate ReviewReport model. The
-- Consumer Protection (E-Commerce) Rules 2020 make no distinction between what
-- a complaint is about -- the same 48-hour acknowledgement and one-month
-- disposal deadlines apply either way -- so two models would mean two queues,
-- two SLA clocks and the acknowledge-and-dispose logic written twice, then
-- merged back together for any compliance answer.

CREATE TYPE "ReportTarget" AS ENUM ('SHOP', 'REVIEW');

-- Every existing report is about a shop, and the default keeps older callers
-- (and the buyer-facing store form, which sends no target) filing valid rows.
ALTER TABLE "Report" ADD COLUMN "targetType" "ReportTarget" NOT NULL DEFAULT 'SHOP';
ALTER TABLE "Report" ADD COLUMN "reviewId" TEXT;

ALTER TABLE "Report"
  ADD CONSTRAINT "Report_reviewId_fkey"
  FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Exactly one target, enforced here rather than only in the action. A row
-- claiming to be about a review with no review attached is unreadable by the
-- queue, and a row claiming to be about a shop while carrying a review id is
-- worse: it renders as a shop complaint and quietly loses the thing it was
-- actually about.
ALTER TABLE "Report" ADD CONSTRAINT "Report_target_matches_type" CHECK (
  ("targetType" = 'SHOP'   AND "reviewId" IS NULL) OR
  ("targetType" = 'REVIEW' AND "reviewId" IS NOT NULL)
);

-- One report per person per review. Partial, so it constrains review reports
-- without touching shop reports, which are deliberately repeatable: a buyer
-- may report the same store again for something new.
CREATE UNIQUE INDEX "Report_one_per_user_per_review"
  ON "Report"("reviewId", "userId") WHERE "reviewId" IS NOT NULL;

-- Drives the admin queue's target filter and the "how many complaints about
-- this review" lookup.
CREATE INDEX "Report_targetType_status_createdAt_idx"
  ON "Report"("targetType", "status", "createdAt");
CREATE INDEX "Report_reviewId_idx" ON "Report"("reviewId");
