"use client";

import { useEffect } from "react";

/** On mount, if user has locale in profile but cookie is missing, set cookie and reload so SSR uses it. */
export function SyncLocale() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const hasCookie = document.cookie.includes("NEXT_LOCALE=");
    if (hasCookie) return;
    fetch("/api/me")
      .then((r) => r.ok ? r.json() : null)
      .then((me) => {
        if (me?.locale) {
          document.cookie = `NEXT_LOCALE=${me.locale};path=/;max-age=31536000`;
          window.location.reload();
        }
      })
      .catch(() => {});
  }, []);
  return null;
}
