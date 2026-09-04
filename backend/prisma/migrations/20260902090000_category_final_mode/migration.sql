ALTER TABLE "Category"
ADD COLUMN "isFinalProductType" BOOLEAN NOT NULL DEFAULT false;

WITH RECURSIVE category_tree AS (
  SELECT id, "parentId", 1 AS depth
  FROM "Category"
  WHERE "parentId" IS NULL

  UNION ALL

  SELECT c.id, c."parentId", ct.depth + 1
  FROM "Category" c
  INNER JOIN category_tree ct ON c."parentId" = ct.id
)
UPDATE "Category" c
SET "isFinalProductType" = true
FROM category_tree ct
WHERE c.id = ct.id
  AND ct.depth = 3;

CREATE INDEX "Category_isFinalProductType_idx" ON "Category"("isFinalProductType");
