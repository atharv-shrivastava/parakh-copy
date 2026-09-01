ALTER TABLE "Product"
ADD COLUMN "complianceStatus" TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
ADD COLUMN "violationReason" TEXT;

CREATE INDEX "Product_complianceStatus_idx" ON "Product"("complianceStatus");
