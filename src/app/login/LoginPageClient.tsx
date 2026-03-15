"use client";

import { signIn } from "next-auth/react";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, ButtonSubmit, Input } from "@/components/ui";

/** NextAuth OAuth error query param values (see https://next-auth.js.org/configuration/pages#error-page) */
const OAUTH_ERROR_CODES = [
  "OAuthSignin",
  "OAuthCallback",
  "OAuthCreateAccount",
  "OAuthAccountNotLinked",
  "Callback",
  "AccessDenied",
  "Configuration",
] as const;

function isOAuthError(error: string | null): error is (typeof OAUTH_ERROR_CODES)[number] {
  return error != null && OAUTH_ERROR_CODES.includes(error as (typeof OAUTH_ERROR_CODES)[number]);
}

/** Short label for debugging; falls back to the raw code. */
function oauthErrorLabel(error: string): string {
  const labels: Record<string, string> = {
    OAuthSignin: "OAuthSignin (redirect to provider failed)",
    OAuthCallback: "OAuthCallback (callback handler error)",
    OAuthCreateAccount: "OAuthCreateAccount (create user failed)",
    OAuthAccountNotLinked: "OAuthAccountNotLinked (email already used with another provider)",
    Callback: "Callback (general callback error)",
    AccessDenied: "AccessDenied (user denied or access restricted)",
    Configuration: "Configuration (provider or server misconfigured)",
  };
  return labels[error] ?? error;
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const errorParam = searchParams.get("error");
  const isOAuthErrorParam = errorParam === "google" || isOAuthError(errorParam);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.ok) router.push(callbackUrl);
  }

  async function handleGoogleSignIn() {
    setGoogleError(null);
    setGoogleLoading(true);
    try {
      await signIn("google", { callbackUrl });
      // If we get here, NextAuth did not redirect (e.g. provider misconfigured or error returned)
      setGoogleLoading(false);
    } catch (err) {
      setGoogleLoading(false);
      setGoogleError(err instanceof Error ? err.message : "Google sign-in failed");
    }
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-[var(--page-padding-x)] py-[var(--spacing-12)]"
      style={{ background: "var(--bg-page)" }}
    >
      <div
        className="w-full max-w-[400px] animate-fade-in card"
        style={{ padding: "var(--spacing-8)" }}
      >
        <h1 className="page-title" style={{ marginBottom: "var(--spacing-2)" }}>
          Mealio
        </h1>
        <p className="page-subtitle" style={{ marginBottom: "var(--spacing-8)" }}>
          Recipe to cart, across stores.
        </p>

        {isOAuthErrorParam && (
          <div
            className="card border-amber-500/30 bg-amber-500/10"
            style={{ padding: "var(--spacing-4)", marginBottom: "var(--spacing-6)" }}
            role="alert"
          >
            <p className="font-medium text-amber-400" style={{ marginBottom: "var(--spacing-2)" }}>
              Google sign-in didn’t complete
              {errorParam && errorParam !== "google" && (
                <span className="ml-2 font-normal text-amber-300/90">({oauthErrorLabel(errorParam)})</span>
              )}
            </p>
            <p className="text-[var(--text-body-sm)] text-[var(--text-secondary)]" style={{ marginBottom: "var(--spacing-3)" }}>
              Usually this is due to:
            </p>
            <ul className="list-inside list-disc text-[var(--text-body-sm)] text-[var(--text-secondary)]" style={{ marginBottom: "var(--spacing-3)" }}>
              <li>
                Redirect URI in Google Cloud Console must be exactly:{" "}
                <code className="rounded bg-black/20 px-1">
                  {typeof window !== "undefined" ? `${window.location.origin}/api/auth/callback/google` : "https://your-domain.com/api/auth/callback/google"}
                </code>
              </li>
              <li>
                <code className="rounded bg-black/20 px-1">NEXTAUTH_URL</code> on Vercel must match this site (e.g. <code className="rounded bg-black/20 px-1">https://mealio-gules.vercel.app</code>). Redeploy after changing env.
              </li>
              <li>
                <code className="rounded bg-black/20 px-1">AUTH_SECRET</code> and <code className="rounded bg-black/20 px-1">ENCRYPTION_KEY</code> must be real secrets (e.g. from <code className="rounded bg-black/20 px-1">openssl rand -base64 32</code>), not placeholders.
              </li>
              <li>
                <code className="rounded bg-black/20 px-1">DATABASE_URL</code> must be the full Postgres connection string from Vercel Postgres. Database must be migrated (<code className="rounded bg-black/20 px-1">npm run db:push</code>).
              </li>
            </ul>
            <p className="text-[var(--text-body-sm)] text-[var(--text-tertiary)]">
              {typeof window !== "undefined" && window.location.hostname === "localhost"
                ? "Check the terminal where npm run dev is running for the exact error."
                : "Check Vercel → Project → Logs for the exact error (e.g. State cookie was missing, DATABASE_URL, or OAuth). Try in an incognito window after fixing env."}
            </p>
          </div>
        )}

        <form onSubmit={handleCredentials} className="flex flex-col gap-[var(--spacing-4)]">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <ButtonSubmit type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </ButtonSubmit>
        </form>

        <div
          className="mt-[var(--spacing-6)] border-t border-[var(--border-default)] pt-[var(--spacing-6)]"
        >
          {googleError && (
            <p className="input-helper text-red-400" style={{ marginBottom: "var(--spacing-3)" }} role="alert">
              {googleError}
            </p>
          )}
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
          >
            {googleLoading ? "Redirecting to Google…" : "Continue with Google"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function LoginPageClient() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--bg-page)" }}>
          <div className="spinner" aria-hidden />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
