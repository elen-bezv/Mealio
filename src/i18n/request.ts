import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async () => {
  const store = await cookies();
  let locale = store.get("NEXT_LOCALE")?.value || routing.defaultLocale;
  if (!routing.locales.includes(locale as "uk" | "en" | "he")) {
    locale = routing.defaultLocale;
  }
  const messages = (await import(`../../messages/${locale}.json`)).default;
  return { locale, messages };
});
