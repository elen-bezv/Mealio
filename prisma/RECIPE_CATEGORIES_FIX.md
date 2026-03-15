# Fix missing recipes (multi-category migration)

If your Recipe Library is empty after the multi-category refactor, the database is likely missing the `RecipeCategoryAssignment` table or existing recipes have no category rows.

**Do this once:**

1. **Sync the schema** (creates `RecipeCategoryAssignment`, removes old `Recipe.category` column):
   ```bash
   npx prisma db push
   ```

2. **Backfill categories** so every recipe has at least "Other":
   ```bash
   npm run db:backfill-recipe-categories
   ```

After that, reload the app; your recipes should appear again (under "All" and "Other" if they had no category before).
