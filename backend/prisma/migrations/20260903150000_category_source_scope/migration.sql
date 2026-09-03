ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "sourceType" TEXT NOT NULL DEFAULT 'OFFLINE';
CREATE INDEX IF NOT EXISTS "Category_sourceType_idx" ON "Category"("sourceType");
