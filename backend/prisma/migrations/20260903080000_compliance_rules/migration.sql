CREATE TABLE "ComplianceRule" (
  "id" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "ruleCode" TEXT NOT NULL,
  "ruleNumber" TEXT NOT NULL,
  "subclause" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "defaultSeverity" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "isBuiltin" BOOLEAN NOT NULL DEFAULT false,
  "definition" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdById" TEXT,
  CONSTRAINT "ComplianceRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ComplianceRule_ruleId_key" ON "ComplianceRule"("ruleId");
CREATE INDEX "ComplianceRule_ruleCode_idx" ON "ComplianceRule"("ruleCode");
CREATE INDEX "ComplianceRule_enabled_idx" ON "ComplianceRule"("enabled");
CREATE INDEX "ComplianceRule_category_idx" ON "ComplianceRule"("category");
CREATE INDEX "ComplianceRule_isBuiltin_idx" ON "ComplianceRule"("isBuiltin");
CREATE INDEX "ComplianceRule_createdById_idx" ON "ComplianceRule"("createdById");

ALTER TABLE "ComplianceRule" ADD CONSTRAINT "ComplianceRule_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
