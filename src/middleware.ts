import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Minimal middleware: pass through. Avoids MIDDLEWARE_INVOCATION_FAILED on Vercel
// when no middleware is present or when next-intl would inject one that fails on Edge.
export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
