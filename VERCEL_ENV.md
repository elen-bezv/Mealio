# Vercel environment variables for Mealio

Add these in **Vercel → your Mealio project → Settings → Environment Variables**.  
Use **Production** (and optionally Preview) for each.

| Variable | Where to get the value |
|----------|-------------------------|
| `DATABASE_URL` | **Full** Postgres URL from Vercel Storage (e.g. copy from `database_PRISMA_DATABASE_URL` or the DB’s Connect tab). Paste the entire string—no truncation. Not `localhost`. |
| `AUTH_SECRET` | Copy from your local `.env` or `.env.local` (same value as local). Or generate: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Your deployment URL, e.g. **`https://mealio-gules.vercel.app`** or `https://mealio.vercel.app` (must match the URL in the redirect URI) |
| `AUTH_TRUST_HOST` | Set to **`true`** so NextAuth trusts Vercel’s proxy (fixes “State cookie was missing” on Google sign-in) |
| `AUTH_GOOGLE_ID` | Copy from your local `.env` or `.env.local` |
| `AUTH_GOOGLE_SECRET` | Copy from your local `.env` or `.env.local` |
| `ENCRYPTION_KEY` | Copy from your local `.env` (same 32+ character secret as local) |
| `OPENAI_API_KEY` | Copy from your local `.env` if you use recipe parsing (starts with `sk-...`) |

**After adding:**

1. **Google redirect URI**  
   In [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → your OAuth 2.0 Client ID → **Authorized redirect URIs**, add **exactly** the URL your app shows on the login page when Google sign-in fails, e.g.:  
   - `https://mealio-gules.vercel.app/api/auth/callback/google` (default Vercel URL), or  
   - `https://mealio.vercel.app/api/auth/callback/google` (if you use that domain).  
   Add every URL you use (production + preview if needed). Save the OAuth client.

2. **Database**  
   In Vercel: **Storage** → **Create Database** → Postgres. In the new DB’s tab, copy the connection string (e.g. `POSTGRES_URL`) and in **Settings → Environment Variables** set `DATABASE_URL` to that value (overwrite any `localhost` value). Then run migrations from your machine: set `DATABASE_URL` in your local `.env` to that same Vercel Postgres URL, run `npm run db:push` and `npm run db:seed`, then switch `.env` back to your local DB if you use one.

3. **Redeploy**  
   Vercel → Deployments → ⋮ on latest → Redeploy so new env vars are used.
