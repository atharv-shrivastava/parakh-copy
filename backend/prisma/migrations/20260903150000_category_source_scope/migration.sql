ALTER TABLE "Category" ADD COLUMN "sourceType" TEXT NOT NULL DEFAULT 'OFFLINE';
CREATE INDEX "Category_sourceType_idx" ON "Category"("sourceType");
