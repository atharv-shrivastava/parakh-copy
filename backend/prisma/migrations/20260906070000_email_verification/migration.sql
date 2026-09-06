ALTER TABLE "User"
  ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "emailVerificationOtpHash" TEXT,
  ADD COLUMN "emailVerificationOtpExpiresAt" TIMESTAMP(3),
  ADD COLUMN "emailVerificationLastSentAt" TIMESTAMP(3),
  ADD COLUMN "emailVerificationAttempts" INTEGER NOT NULL DEFAULT 0;

UPDATE "User" SET "emailVerified" = true;
