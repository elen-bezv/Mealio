# Grocery — Recipe to Cart

Production-grade AI web app that converts recipes into grocery shopping carts across multiple online stores.

## Features

- **Recipe upload**: Text, image, PDF, or URL → AI extracts and normalizes ingredients
- **Recipe library**: Save, edit, tag, categorize (breakfast/lunch/dinner/dessert)
- **Ready recipes**: Built-in collection; add to meal plan or shopping list
- **Weekly meal planner**: 7× breakfast/lunch/dinner (+ optional dessert); merge ingredients into one list
- **Shopping list**: Merged, normalized ingredients; by category (Vegetables, Dairy, Meat, Pantry, Frozen)
- **Multi-store**: Connect Walmart, Instacart, Tesco (or local stores)
- **AI shopping agent**: Playwright-based agent with MCP-style tools (SearchProduct, AddToCart, GetCartStatus). User logs in once; session stored encrypted; agent fills cart.

## Tech stack

- **Frontend**: Next.js, React, TypeScript, TailwindCSS, React Query, Zustand-ready
- **Backend**: Next.js API routes, PostgreSQL (Prisma)
- **AI**: OpenAI for ingredient extraction
- **Automation**: Playwright, MCP-style tool layer
- **Auth**: NextAuth (Google + credentials), encrypted store sessions

## Setup

1. **Clone and install**

   ```bash
   cd Grocery && npm install
   ```

2. **Environment**

   Copy `.env.example` to `.env` and set:

   - `DATABASE_URL` — PostgreSQL connection string
   - `AUTH_SECRET` — secret for signing session cookies (e.g. `openssl rand -base64 32`)
   - `NEXTAUTH_URL` — base URL of the app (`http://localhost:3000` for dev, `https://your-domain.com` in production)
   - `OPENAI_API_KEY` — for recipe parsing
   - `ENCRYPTION_KEY` — 32+ chars for encrypting store sessions
   - For **Google sign-in**: `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` (see [Google OAuth](#google-oauth) below)

3. **Database**

   The app needs PostgreSQL (auth, recipes, lists, etc.). If you don’t have one yet:

   - **Free cloud DB (easiest):** Go to [Neon](https://neon.tech), sign up, create a project, and copy the connection string. Put it in `.env` as `DATABASE_URL="postgresql://..."`.
   - **Local:** Install PostgreSQL and use `DATABASE_URL="postgresql://user:password@localhost:5432/grocery?schema=public"` (create a DB named `grocery` if needed).

   Then create tables and seed data:

   ```bash
   npm run db:push
   npm run db:seed
   ```

4. **Run**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Sign in with email (any email for demo) or **Continue with Google** (if Google OAuth is configured).

### Google OAuth

To enable **Continue with Google**:

1. **Create OAuth credentials**
   - Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   - Create a project or select one → **APIs & Services** → **Credentials**
   - **Create credentials** → **OAuth client ID**
   - Application type: **Web application**
   - Under **Authorized redirect URIs** add:
     - Local: `http://localhost:3000/api/auth/callback/google`
     - Production: `https://your-domain.com/api/auth/callback/google`

2. **Set environment variables**
   - `AUTH_GOOGLE_ID` — Client ID from the Google credential
   - `AUTH_GOOGLE_SECRET` — Client secret from the Google credential

3. Restart the app. The **Continue with Google** button appears on the login page when both variables are set. Sessions are stored via the Prisma adapter (database); cookies are signed with `AUTH_SECRET` and use secure cookies when `NEXTAUTH_URL` is `https`.

## Project structure

```
src/
  app/              # Next.js App Router (pages + API)
  components/       # UI and layout
  lib/              # db, auth, openai, encryption
  services/         # ingredient extraction, shopping list merge
  agent/            # Playwright agent + MCP-style tools
  types/            # Shared TS types
prisma/
  schema.prisma     # Full schema (Users, Recipes, Ingredients, MealPlans, ShoppingLists, StoreConnections)
```

## User flows

1. **Upload recipes** → Parse (AI) → Shopping list → Choose store → Agent adds to cart
2. **Weekly menu** → Select recipes → Generate plan → Merged list → Choose store → Agent fills cart
3. **Ready recipes** → Add to list → Shop automatically

## Security

- Store logins: only encrypted cookies/tokens are stored; no plain passwords
- Sessions encrypted with `ENCRYPTION_KEY`
- Users can disconnect stores anytime

## Scalability (future)

Schema and modules are designed for:

- Price comparison across stores
- Cheapest basket optimization
- Nutrition tracking
- AI meal suggestions
- Automatic reordering

## Running the agent

The shopping agent runs in Node (Playwright). For serverless, run it in a separate worker or queue. Locally:

```bash
# Optional: run agent script directly (e.g. for testing)
npm run agent
```

API route `POST /api/agent/shop` triggers the agent when the app runs in an environment where Playwright can run (Node server, not edge).
