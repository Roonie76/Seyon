-- Integrity rules the database enforces itself.
--
-- Every one of these was previously guaranteed only by application code, so a
-- direct SQL edit, a script, an admin tool or a future code path that forgot
-- to validate could write a row the UI cannot render sensibly. Constraints in
-- the schema make the invalid state unrepresentable regardless of who is
-- writing.
--
-- All are NOT VALID-free (checked against existing rows) because the audit
-- confirmed no current row violates them.

-- A price is never negative, and no listing costs more than one crore.
ALTER TABLE "Product"
  ADD CONSTRAINT "Product_price_nonnegative" CHECK ("price" >= 0),
  ADD CONSTRAINT "Product_price_sane_ceiling" CHECK ("price" <= 10000000);

-- A compare-at price only means anything above the selling price.
ALTER TABLE "Product"
  ADD CONSTRAINT "Product_compareAtPrice_above_price"
  CHECK ("compareAtPrice" IS NULL OR "compareAtPrice" > "price");

-- A title that is only whitespace produced an empty slug and an unreachable
-- product page.
ALTER TABLE "Product"
  ADD CONSTRAINT "Product_title_not_blank" CHECK (btrim("title") <> '');

-- The slug is the product's address; it must never be empty.
ALTER TABLE "Product"
  ADD CONSTRAINT "Product_slug_not_blank" CHECK (btrim("slug") <> '');

-- Display order is a position, not an arbitrary integer.
ALTER TABLE "ProductImage"
  ADD CONSTRAINT "ProductImage_displayOrder_nonnegative" CHECK ("displayOrder" >= 0);

-- At most one cover image per product. A partial unique index is the right
-- shape here: many non-primary rows are fine, two primaries are not.
--
-- Existing data can violate this: the API accepted several isPrimary images
-- on one product, and applying the index against a live database failed on
-- exactly that. Demote the extras first, keeping the lowest displayOrder as
-- the cover, so the migration is safe to run against production.
UPDATE "ProductImage" pi
SET "isPrimary" = false
WHERE pi."isPrimary"
  AND pi."id" <> (
    SELECT keep."id"
    FROM "ProductImage" keep
    WHERE keep."productId" = pi."productId" AND keep."isPrimary"
    ORDER BY keep."displayOrder" ASC, keep."id" ASC
    LIMIT 1
  );

CREATE UNIQUE INDEX IF NOT EXISTS "ProductImage_one_primary_per_product"
  ON "ProductImage" ("productId")
  WHERE "isPrimary";

-- Ratings are 1-5 stars.
ALTER TABLE "Review"
  ADD CONSTRAINT "Review_rating_range" CHECK ("rating" BETWEEN 1 AND 5);

-- Cached aggregates cannot describe an impossible shop.
ALTER TABLE "Shop"
  ADD CONSTRAINT "Shop_reviewCount_nonnegative" CHECK ("reviewCount" >= 0),
  ADD CONSTRAINT "Shop_averageRating_range" CHECK ("averageRating" >= 0 AND "averageRating" <= 5);
