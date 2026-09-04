ALTER TABLE "Product" ADD COLUMN "sourceType" TEXT NOT NULL DEFAULT 'OFFLINE';
ALTER TABLE "Product" ADD COLUMN "sourceUrl" TEXT;
ALTER TABLE "Product" ADD COLUMN "sourceWebsiteName" TEXT;
ALTER TABLE "Shop" ADD COLUMN "sourceType" TEXT NOT NULL DEFAULT 'OFFLINE';

CREATE INDEX "Product_sourceType_idx" ON "Product"("sourceType");
CREATE INDEX "Shop_sourceType_idx" ON "Shop"("sourceType");
