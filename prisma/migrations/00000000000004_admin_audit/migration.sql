-- The admin audit log.
--
-- Nothing recorded who suspended a store, deleted a product, or granted someone
-- admin. This is the cheapest high-value addition to the admin surface: it does
-- not change what an admin can do, only whether anyone can find out afterwards.

CREATE TABLE "AdminAction" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminAction_targetType_targetId_createdAt_idx" ON "AdminAction"("targetType", "targetId", "createdAt");
CREATE INDEX "AdminAction_actorId_createdAt_idx" ON "AdminAction"("actorId", "createdAt");
CREATE INDEX "AdminAction_createdAt_idx" ON "AdminAction"("createdAt");

-- Restrict, not Cascade or SetNull. Deleting the admin who acted must not erase
-- the record of the action, and must not silently orphan it either: the row
-- names a person, and that is the point of the row.
ALTER TABLE "AdminAction" ADD CONSTRAINT "AdminAction_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- An action name is not optional and not blank. A row saying an unnamed thing
-- happened is worse than no row, because it looks like coverage.
ALTER TABLE "AdminAction" ADD CONSTRAINT "AdminAction_action_not_blank"
  CHECK (btrim("action") <> '');

-- Destructive actions must carry a reason. Listed explicitly rather than
-- inferred, so adding a new destructive action forces a decision here.
ALTER TABLE "AdminAction" ADD CONSTRAINT "AdminAction_destructive_has_reason"
  CHECK (
    "action" NOT IN ('SUSPEND_SHOP', 'DELETE_PRODUCT', 'DELETE_SHOP', 'GRANT_ADMIN', 'REVOKE_ADMIN')
    OR ("reason" IS NOT NULL AND btrim("reason") <> '')
  );
