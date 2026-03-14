"use client";

import { AppLayout } from "@/components/layout/AppLayout";

/**
 * Full-page loading state for Suspense boundaries inside the app shell.
 * Uses design-system spinner and consistent padding.
 */
export function LoadingFallback() {
  return (
    <AppLayout>
      <div className="loading-fallback">
        <div className="spinner" aria-hidden />
      </div>
    </AppLayout>
  );
}
