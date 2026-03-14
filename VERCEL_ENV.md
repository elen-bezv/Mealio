# Vercel environment variables for Mealio

Add these in **Vercel → your Mealio project → Settings → Environment Variables**.  
Use **Production** (and optionally Preview) for each.

| Variable | Where to get the value |
|----------|-------------------------|
| `DATABASE_URL` | **Vercel Postgres:** Project → Storage → your Postgres DB → copy the connection string (e.g. `POSTGRES_URL`). Paste as `DATABASE_URL`. |
| `AUTH_SECRET` | Copy from your local `.env` or `.env.local` (same value as local). Or generate: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Your production URL: **`https://mealio.vercel.app`** (or your custom domain, e.g. `https://mealio.com`) |
| `AUTH_GOOGLE_ID` | Copy from your local `.env` or `.env.local` |
| `AUTH_GOOGLE_SECRET` | Copy from your local `.env` or `.env.local` |
| `ENCRYPTION_KEY` | Copy from your local `.env` (same 32+ character secret as local) |
| `OPENAI_API_KEY` | Copy from your local `.env` if you use recipe parsing (starts with `sk-...`) |

**After adding:**

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → your OAuth client → **Authorized redirect URIs**, add:  
   `https://mealio.vercel.app/api/auth/callback/google`  
   (or your custom domain instead of `mealio.vercel.app`).

2. Redeploy the project (Vercel → Deployments → ⋮ on latest → Redeploy) so the new env vars are used.
