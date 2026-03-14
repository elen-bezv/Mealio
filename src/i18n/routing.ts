import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["uk", "en", "he"],
  defaultLocale: "uk",
  localePrefix: "never",
});

export const LOCALE_NAMES: Record<string, string> = {
  uk: "Українська",
  en: "English",
  he: "עברית",
};
