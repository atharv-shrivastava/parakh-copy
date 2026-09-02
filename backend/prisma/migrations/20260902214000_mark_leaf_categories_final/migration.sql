UPDATE "Category" c SET "isFinal" = TRUE WHERE NOT EXISTS (SELECT 1 FROM "Category" child WHERE child."parentId" = c."id");
