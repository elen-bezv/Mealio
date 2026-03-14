import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async () => {
  let locale = routing.defaultLocale;
  try {
    const store = await cookies();
    const cookieLocale = store.get("NEXT_LOCALE")?.value;
    if (cookieLocale && routing.locales.includes(cookieLocale as "uk" | "en" | "he")) {
      locale = cookieLocale;
    }
  } catch {
    // cookies() can fail in some Edge contexts
  }
  let messages: Record<string, unknown> = {};
  try {
    messages = (await import(`../../messages/${locale}.json`)).default;
  } catch {
    // fallback if message file fails to load (e.g. path on Vercel)
    try {
      messages = (await import(`../../messages/uk.json`)).default;
    } catch {
      // no messages
    }
  }
  return { locale, messages };
});
