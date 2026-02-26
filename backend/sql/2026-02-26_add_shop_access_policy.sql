ALTER TABLE "Shop"
  ADD COLUMN IF NOT EXISTS "membershipPolicy" TEXT NOT NULL DEFAULT 'invite-only',
  ADD COLUMN IF NOT EXISTS "membershipEmailDomain" TEXT;

UPDATE "Shop"
SET "membershipPolicy" = 'invite-only'
WHERE "membershipPolicy" IS NULL;

UPDATE "Shop"
SET "membershipEmailDomain" = NULL
WHERE "membershipPolicy" <> 'domain';

ALTER TABLE "Shop"
  DROP CONSTRAINT IF EXISTS "Shop_membershipPolicy_check";

ALTER TABLE "Shop"
  ADD CONSTRAINT "Shop_membershipPolicy_check"
  CHECK ("membershipPolicy" IN ('invite-only', 'domain'));

ALTER TABLE "Shop"
  DROP CONSTRAINT IF EXISTS "Shop_membershipDomainRequired_check";

ALTER TABLE "Shop"
  ADD CONSTRAINT "Shop_membershipDomainRequired_check"
  CHECK (
    ("membershipPolicy" = 'invite-only' AND "membershipEmailDomain" IS NULL)
    OR ("membershipPolicy" = 'domain' AND "membershipEmailDomain" IS NOT NULL)
  );
