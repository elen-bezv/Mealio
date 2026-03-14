"use client";

import { signIn } from "next-auth/react";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, ButtonSubmit, Input } from "@/components/ui";

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
  const isGoogleCallbackError = errorParam === "google" || errorParam === "OAuthAccountNotLinked";

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

  function handleGoogleSignIn() {
    setGoogleError(null);
    setGoogleLoading(true);
    // Redirect directly to NextAuth's Google sign-in endpoint so the server handles OAuth
    const params = new URLSearchParams({ callbackUrl });
    window.location.href = `/api/auth/signin/google?${params.toString()}`;
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
          Grocery
        </h1>
        <p className="page-subtitle" style={{ marginBottom: "var(--spacing-8)" }}>
          Recipe to cart, across stores.
        </p>

        {isGoogleCallbackError && (
          <div
            className="card border-amber-500/30 bg-amber-500/10"
            style={{ padding: "var(--spacing-4)", marginBottom: "var(--spacing-6)" }}
            role="alert"
          >
            <p className="font-medium text-amber-400" style={{ marginBottom: "var(--spacing-2)" }}>
              Google sign-in didn’t complete
            </p>
            <p className="text-[var(--text-body-sm)] text-[var(--text-secondary)]" style={{ marginBottom: "var(--spacing-3)" }}>
              Usually this is due to:
            </p>
            <ul className="list-inside list-disc text-[var(--text-body-sm)] text-[var(--text-secondary)]" style={{ marginBottom: "var(--spacing-3)" }}>
              <li>Redirect URI in Google Cloud Console must be exactly: <code className="rounded bg-black/20 px-1">http://localhost:3000/api/auth/callback/google</code></li>
              <li>Database must be running and migrated (<code className="rounded bg-black/20 px-1">npm run db:push</code>)</li>
            </ul>
            <p className="text-[var(--text-body-sm)] text-[var(--text-tertiary)]">
              Check the terminal where <code className="rounded bg-black/20 px-1">npm run dev</code> is running for the exact error.
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
