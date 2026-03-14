import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Pass-through only. With localePrefix: "never" we use a flat app/ (no [locale]).
// createMiddleware would rewrite / → /uk and cause 404. Locale comes from
// cookie in src/i18n/request.ts instead.
export function proxy(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
