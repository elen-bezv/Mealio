-- Backfill: ensure every Recipe has at least one RecipeCategoryAssignment (OTHER).
-- Fixes recipes that were left without categories (e.g. after db push without running the multi-category migration backfill).
INSERT INTO "RecipeCategoryAssignment" ("id", "recipeId", "category")
SELECT gen_random_uuid()::text, r.id, 'OTHER'::"RecipeCategory"
FROM "Recipe" r
WHERE NOT EXISTS (SELECT 1 FROM "RecipeCategoryAssignment" rca WHERE rca."recipeId" = r.id);
