# Grocery App — System Architecture

This document describes the modular domain architecture. All AI logic flows through the central AI service layer; ingredient handling goes through the unified ingredient engine.

---

## 1. Directory Structure

```
src/
├── app/                    # Next.js App Router (pages + API routes)
│   ├── api/                # API by domain: auth, recipes, meal-plans,
│   │                       # shopping-lists, pantry, store-connections, agent
│   ├── (pages)             # UI: dashboard, import, library, planner,
│   │                       # shopping, pantry, stores, settings, login
│   ├── layout.tsx
│   └── providers.tsx
├── components/             # Shared UI (layout, shopping modals, SyncLocale)
├── i18n/                   # next-intl: routing, request config, locale names
├── lib/                    # Core utilities (no domain logic)
│   ├── auth.ts             # NextAuth config + getRequireUserId, getUserLocale
│   ├── constants.ts        # APP_LOCALES, source types
│   ├── db.ts               # Prisma client
│   ├── encryption.ts       # Store session encryption
│   ├── ingredient-normalize.ts  # Canonical names (dictionary + fuzzy)
│   ├── ingredient-db.ts    # getOrCreateIngredient (unified ingredient persistence)
│   ├── openai.ts           # OpenAI client
│   ├── unit-conversion.ts  # toPreferredUnit, formatQuantity, addQuantities
│   └── url-fetch.ts        # Fetch + parse page text (for URL/Instagram/TikTok)
├── services/               # Domain and AI services
│   ├── ai/                 # Central AI layer (re-exports + wrappers)
│   │   ├── index.ts
│   │   ├── ingredientExtractor.ts
│   │   ├── recipeParser.ts
│   │   ├── translationService.ts
│   │   ├── ingredientNormalizer.ts
│   │   ├── unitConversion.ts
│   │   └── productSelection.ts
│   ├── cookbook-pdf.ts     # PDF text extraction + recipe boundary detection
│   ├── pantry-matching.ts  # Subtract pantry from merged list (normalize + units)
│   ├── recipe-creation.ts  # createRecipeFromStructured (unified recipe + translation + ingredients)
│   ├── recipe-parser-pro.ts
│   ├── recipe-translation.ts
│   ├── ingredient-extraction.ts
│   └── shopping-list.ts    # Merge, pantry subtract, create list
├── agent/                  # Grocery automation (Playwright)
│   ├── run.ts
│   ├── stores.ts
│   └── tools/
├── types/                  # Shared TypeScript types
├── modules/                 # Domain entry points (re-export from services/lib)
│   ├── recipes/
│   ├── ingredients/
│   ├── shopping/
│   └── pantry/
```

Database: **Prisma** at project root (`prisma/schema.prisma`). No separate `/database` folder.

---

## 2. Core Domains

| Domain | Responsibility | Key entry points |
|--------|----------------|------------------|
| **Recipe system** | CRUD, creation from structured input, translations, tags | `POST/GET/PATCH/DELETE /api/recipes`, `services/recipe-creation.ts` |
| **Recipe parser (Pro)** | URL / Instagram / TikTok / image / PDF / text → StructuredRecipe | `services/recipe-parser-pro.ts`, `POST /api/parse-recipe-pro` |
| **PDF import** | Parse PDF → extract recipes → insert into Recipe Library | `services/cookbook-pdf.ts`, `POST /api/recipes/import-pdf` |
| **Meal planner** | Weekly plans, meal slots | `GET/POST/PATCH/DELETE /api/meal-plans` |
| **Shopping list** | Merge ingredients, pantry adjustment, list CRUD | `services/shopping-list.ts`, `POST/GET /api/shopping-lists` |
| **Pantry** | Inventory, matching (normalize + subtract) | `services/pantry-matching.ts`, `GET/POST/PATCH/DELETE /api/pantry` |
| **Grocery agent** | Playwright: search, add to cart, missing report | `agent/run.ts`, `POST /api/agent/shop`, `POST /api/agent/retry-missing` |
| **Translation** | UI i18n (uk/en/he), recipe translation, RTL | `i18n/`, `services/recipe-translation.ts` |
| **Stores** | Store config, encrypted connections | `agent/stores.ts`, `GET/POST/DELETE /api/store-connections` |
| **Users** | Auth (NextAuth), locale | `lib/auth.ts`, `GET /api/me`, `PATCH /api/me/locale` |

---

## 3. Central AI Service Layer

All AI usage goes through **`services/ai/`**:

- **ingredientExtractor** — extract ingredients from text/URL/image (`ingredient-extraction.ts`).
- **recipeParser** — Pro parser: URL/image/PDF/text → StructuredRecipe (`recipe-parser-pro.ts`).
- **translationService** — detect language, translate recipe (`recipe-translation.ts`).
- **ingredientNormalizer** — canonical names (`lib/ingredient-normalize.ts`).
- **unitConversion** — toPreferredUnit, formatQuantity (`lib/unit-conversion.ts`).
- **productSelection** — choose best product/quantity for agent (`agent/tools/product-selection.ts`).

No AI logic should live in API routes or ad-hoc modules; they call into this layer.

---

## 4. Unified Ingredient Engine

Single responsibility: **normalization**, **merge**, **unit conversion**, **persistence**.

- **Normalization:** `lib/ingredient-normalize.ts` — `normalizeIngredientName`, `getCanonicalKey`.
- **Persistence:** `lib/ingredient-db.ts` — `getOrCreateIngredient(name, category?)` using normalized/canonical name so all domains share the same Ingredient rows.
- **Merge + units:** `services/shopping-list.ts` — `mergeIngredients()` uses normalize + `lib/unit-conversion.ts` (`toPreferredUnit`, `formatQuantity`, `addQuantities`).

Used by: recipe creation, PDF import, shopping list generator, pantry comparison, grocery agent.

---

## 5. Recipe System

- **Model (Prisma):** `Recipe` (title, description, originalLanguage, sourceType, …), `RecipeTranslation` (per locale), `RecipeIngredient` (quantity, unit, translatedDisplayName).
- **Source types:** manual, website, instagram, tiktok, image, pdf, text.
- **Creation:** One path — **`services/recipe-creation.ts`** `createRecipeFromStructured(userId, input, options)`. Used by:
  - `POST /api/recipes` (manual/import payload)
  - `POST /api/recipes/import-pdf` (PDF: parse → create one recipe per extracted item → Recipe Library)

Ensures: language detection, original + user-locale translation, `getOrCreateIngredient` + `RecipeIngredient` with `translatedDisplayName`.

---

## 6. Shopping Pipeline

1. **Recipes / meal plan** → collect ingredients.
2. **Ingredient engine** → normalize, merge duplicates, unit conversion.
3. **Pantry** → subtract pantry quantities (same normalization + units).
4. **Shopping list** → create list (already adjusted).
5. **Grocery agent** → run on list (with optional second pantry pass for latest inventory).

Implemented in: `createShoppingListFromIngredients(..., { subtractPantry: true })`, then `POST /api/agent/shop` (which re-applies pantry before running).

---

## 7. Grocery Automation Agent

- **Entry:** `POST /api/agent/shop` (storeConnectionId, shoppingListId).
- **Flow:** Load list → load pantry → subtract pantry → run Playwright (search, product selection, add to cart).
- **Report:** Items added, items not found, items needing confirmation (Missing Items Report).

---

## 8. Multi-Language

- **UI:** next-intl; locales uk (default), en, he; RTL for Hebrew; `messages/{uk,en,he}.json`.
- **Recipe:** Store `originalLanguage`; `RecipeTranslation` per locale; `RecipeIngredient.translatedDisplayName` (JSON by locale). Auto-translate on import and on first view for a locale.

---

## 9. Database (Prisma)

Main tables: **User**, **Recipe**, **RecipeTranslation**, **RecipeTag**, **Ingredient**, **RecipeIngredient**, **MealPlan**, **MealPlanRecipe**, **ShoppingList**, **ShoppingListItem**, **PantryItem**, **StoreConnection**, **Account**, **Session**. (Cookbook table exists for legacy/backward compatibility but is not used in the product; PDF import goes to Recipe Library via `POST /api/recipes/import-pdf`.)

- **Ingredient:** Use `getOrCreateIngredient` with normalized name; set `canonicalName` for consistency with pantry matching.
- **PantryItem:** `ingredientName` + `normalizedIngredientName` (no FK to Ingredient); matching via same canonical keys as shopping.

---

## 10. Conventions

- **Auth:** Use `getRequireUserId()` or `getRequireSession()` from `lib/auth.ts` in protected API routes.
- **Locale:** Use `getUserLocale(userId)` from `lib/auth.ts`; use `APP_LOCALES` from `lib/constants.ts`.
- **Typing:** Strict TypeScript; shared types in `types/index.ts`.
- **Naming:** camelCase in code; API request/response bodies camelCase.

---

## 11. Refactor Summary (Done)

- Duplicate `formatMergedQuantity` removed; use `formatQuantity` from `lib/unit-conversion.ts`.
- Shared **recipe creation** in `services/recipe-creation.ts`; used by `POST /api/recipes` and `POST /api/recipes/import-pdf`.
- **getOrCreateIngredient** in `lib/ingredient-db.ts`; recipe creation and shopping-list use it; normalization applied when creating Ingredient.
- **getRequireUserId** and **getUserLocale** in `lib/auth.ts`; **APP_LOCALES** in `lib/constants.ts`; APIs use them.
- **Central AI layer** at `services/ai/` (re-exports existing AI/ingredient/unit code).
- **ARCHITECTURE.md** (this file) documents structure and boundaries.
