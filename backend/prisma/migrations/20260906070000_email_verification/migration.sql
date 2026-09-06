ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "emailVerificationOtpHash" TEXT;
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "emailVerificationOtpExpiresAt" TIMESTAMP(3);
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "emailVerificationLastSentAt" TIMESTAMP(3);
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "emailVerificationAttempts" INTEGER NOT NULL DEFAULT 0;

UPDATE "User" SET "emailVerified" = true WHERE "emailVerified" = false AND "emailVerificationOtpHash" IS NULL;
