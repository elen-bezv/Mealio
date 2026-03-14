import { NextResponse } from "next/server";

/**
 * Temporary route to verify the server sees Google OAuth env vars.
 * Remove or restrict in production.
 */
export async function GET() {
  const googleId = process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID;
  const googleSecret = process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  return NextResponse.json({
    hasGoogleId: Boolean(googleId),
    hasGoogleSecret: Boolean(googleSecret),
    googleIdLength: googleId?.length ?? 0,
    hint: "If both are false, the server is not reading .env. Try .env.local and restart.",
  });
}
