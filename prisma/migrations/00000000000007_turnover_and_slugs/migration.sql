-- Two unrelated things that both needed a column.

-- 1. The GST threshold, as a declaration rather than a measurement.
--
-- The plan for this assumed a turnover signal the marketplace could watch. It
-- has none: Seyon is a discovery marketplace, buyers leave for WhatsApp to
-- transact, and there is no Order model, no payment record and no line item
-- anywhere in the schema. The only events are SHOP_VIEW, PRODUCT_VIEW and
-- WHATSAPP_CLICK. So the marketplace cannot detect a seller crossing the
-- registration threshold, and any code that claimed to would be inventing it.
--
-- What it can honestly do is ask, record the answer and the date, and ask again
-- when the answer goes stale.
CREATE TYPE "TurnoverDeclaration" AS ENUM ('NOT_DECLARED', 'BELOW_THRESHOLD', 'ABOVE_THRESHOLD');

ALTER TABLE "SellerKyc"
  ADD COLUMN "turnoverDeclaration" "TurnoverDeclaration" NOT NULL DEFAULT 'NOT_DECLARED';
ALTER TABLE "SellerKyc" ADD COLUMN "turnoverDeclaredAt" TIMESTAMP(3);

-- A declaration with no date is unusable: the whole point is knowing when it
-- was true, so it can be asked again a year later.
ALTER TABLE "SellerKyc" ADD CONSTRAINT "SellerKyc_declaration_has_date" CHECK (
  "turnoverDeclaration" = 'NOT_DECLARED' OR "turnoverDeclaredAt" IS NOT NULL
);

CREATE INDEX "SellerKyc_turnoverDeclaration_idx"
  ON "SellerKyc"("turnoverDeclaration", "turnoverDeclaredAt");

-- 2. Old store addresses, kept so that changing one does not break the web.
--
-- An admin fixing a bad slug is a small convenience with a large blast radius:
-- every link a seller has shared, every search result, every WhatsApp message
-- pointing at the old address stops working. Keeping the old slug and
-- redirecting costs one small table.
CREATE TABLE "ShopSlugHistory" (
    "id"          TEXT NOT NULL,
    "shopId"      TEXT NOT NULL,
    "slug"        TEXT NOT NULL,
    "changedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedById" TEXT,

    CONSTRAINT "ShopSlugHistory_pkey" PRIMARY KEY ("id")
);

-- Unique across history, so a freed slug cannot be handed to a different store
-- and silently redirect its traffic somewhere else.
CREATE UNIQUE INDEX "ShopSlugHistory_slug_key" ON "ShopSlugHistory"("slug");
CREATE INDEX "ShopSlugHistory_shopId_idx" ON "ShopSlugHistory"("shopId");

ALTER TABLE "ShopSlugHistory"
  ADD CONSTRAINT "ShopSlugHistory_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShopSlugHistory"
  ADD CONSTRAINT "ShopSlugHistory_changedById_fkey"
  FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Repairing a store joins the actions that must explain themselves.
--
-- REQUIRES_REASON in lib/admin-audit.ts and this constraint are documented as
-- mirrors of each other; adding one without the other is how the application
-- check becomes the only check, and an application check is what a migration
-- script bypasses.
ALTER TABLE "AdminAction" DROP CONSTRAINT "AdminAction_destructive_has_reason";
ALTER TABLE "AdminAction" ADD CONSTRAINT "AdminAction_destructive_has_reason"
  CHECK (
    "action" NOT IN (
      'SUSPEND_SHOP','DELETE_PRODUCT','DELETE_SHOP','GRANT_ADMIN','REVOKE_ADMIN',
      'HIDE_REVIEW','MARK_UNDER_REVIEW','REJECT_REPORT','REPAIR_SHOP'
    )
    OR ("reason" IS NOT NULL AND btrim("reason") <> '')
  );
