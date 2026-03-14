"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { LOCALE_NAMES } from "@/i18n/routing";
import { PageContainer, Card, Button } from "@/components/ui";

async function fetchMe() {
  const r = await fetch("/api/me");
  if (!r.ok) throw new Error("Failed to fetch");
  return r.json();
}

async function setLocale(locale: string) {
  const r = await fetch("/api/me/locale", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale }),
  });
  if (!r.ok) throw new Error("Failed to update");
  return r.json();
}

function setLocaleCookie(locale: string) {
  document.cookie = `NEXT_LOCALE=${locale};path=/;max-age=31536000`;
}

export default function SettingsPage() {
  const t = useTranslations("settings");
  const [saved, setSaved] = useState(false);
  const queryClient = useQueryClient();

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: fetchMe });
  const mutation = useMutation({
    mutationFn: setLocale,
    onSuccess: (_, locale) => {
      setLocaleCookie(locale);
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["me"] });
      setTimeout(() => setSaved(false), 2000);
      window.location.reload();
    },
  });

  const currentLocale = me?.locale || "uk";

  return (
    <AppLayout>
      <PageContainer>
        <header className="page-header">
          <h1 className="page-title">{t("title")}</h1>
        </header>

        <Card style={{ marginBottom: "var(--spacing-8)" }}>
          <label className="input-label" style={{ display: "block", marginBottom: "var(--spacing-3)" }}>
            {t("languageLabel")}
          </label>
          <div className="flex flex-wrap gap-[var(--spacing-3)]">
            {(["uk", "en", "he"] as const).map((locale) => (
              <Button
                key={locale}
                variant={currentLocale === locale ? "primary" : "secondary"}
                size="default"
                onClick={() => mutation.mutate(locale)}
                disabled={mutation.isPending || currentLocale === locale}
              >
                {LOCALE_NAMES[locale]}
              </Button>
            ))}
          </div>
          {saved && (
            <p className="input-helper text-[var(--accent)]" style={{ marginTop: "var(--spacing-3)" }}>{t("languageSaved")}</p>
          )}
        </Card>
      </PageContainer>
    </AppLayout>
  );
}
