-- CreateTable
CREATE TABLE "RecipeCategoryAssignment" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "category" "RecipeCategory" NOT NULL,

    CONSTRAINT "RecipeCategoryAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecipeCategoryAssignment_recipeId_category_key" ON "RecipeCategoryAssignment"("recipeId", "category");
CREATE INDEX "RecipeCategoryAssignment_recipeId_idx" ON "RecipeCategoryAssignment"("recipeId");

-- Backfill and drop column only if Recipe has a category column (e.g. existing DB before multi-category)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Recipe' AND column_name = 'category') THEN
    INSERT INTO "RecipeCategoryAssignment" ("id", "recipeId", "category")
    SELECT gen_random_uuid()::text, "id", COALESCE("Recipe"."category", 'OTHER'::"RecipeCategory") FROM "Recipe";
    ALTER TABLE "Recipe" DROP COLUMN "category";
  END IF;
END $$;

-- AddForeignKey
ALTER TABLE "RecipeCategoryAssignment" ADD CONSTRAINT "RecipeCategoryAssignment_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
