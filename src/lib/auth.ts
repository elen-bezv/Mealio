import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./db";
import type { Adapter } from "next-auth/adapters";
import { APP_LOCALES, type AppLocale } from "./constants";

/** Read Google OAuth env at call time (avoids stale env when module loads before .env). */
function getGoogleEnv() {
  const id = process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID || "";
  const secret = process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET || "";
  return { id, secret, configured: Boolean(id && secret) };
}

/** True when AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET (or GOOGLE_* fallback) are set. */
export const isGoogleConfigured = Boolean(
  getGoogleEnv().configured
);

/** Get current session; throws if not authenticated. Use in protected API routes. */
export async function getRequireSession() {
  const session = await getServerSession(getAuthOptions());
  if (!session?.user) throw new Error("Unauthorized");
  return session;
}

/** Get current user id; throws if not authenticated. Use in protected API routes. */
export async function getRequireUserId(): Promise<string> {
  const session = await getRequireSession();
  const id = (session.user as { id?: string }).id;
  if (!id) throw new Error("Unauthorized");
  return id;
}

/** Get user's preferred locale (uk | en | he). Used by recipe and cookbook APIs. */
export async function getUserLocale(userId: string): Promise<AppLocale> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { locale: true },
  });
  const locale = user?.locale ?? "uk";
  return APP_LOCALES.includes(locale as AppLocale) ? (locale as AppLocale) : "uk";
}

/** Build auth options with env read at call time (so .env is always current). */
export function getAuthOptions(): NextAuthOptions {
  const { id: googleClientId, secret: googleClientSecret, configured: googleConfigured } = getGoogleEnv();
  const baseUrl = process.env.NEXTAUTH_URL ?? "";
  const isSecure = baseUrl.startsWith("https://");

  return {
    adapter: PrismaAdapter(prisma) as Adapter,
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
    trustHost: true,
    useSecureCookies: isSecure,
    session: {
      strategy: "jwt",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      updateAge: 24 * 60 * 60,   // extend session if used within 24h
    },
    pages: { signIn: "/login" },
    providers: [
      ...(googleConfigured
        ? [
            GoogleProvider({
              clientId: googleClientId,
              clientSecret: googleClientSecret,
              authorization: {
                params: { prompt: "consent", access_type: "offline", response_type: "code" },
              },
            }),
          ]
        : []),
      CredentialsProvider({
        name: "credentials",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
          // Demo: accept any email for dev; in production use bcrypt + User table
          if (!credentials?.email) return null;
          let user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });
          if (!user) {
            user = await prisma.user.create({
              data: {
                email: credentials.email,
                name: credentials.email.split("@")[0],
              },
            });
          }
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
          };
        },
      }),
    ],
    callbacks: {
      async jwt({ token, user }) {
        if (user) token.id = user.id;
        return token;
      },
      async session({ session, token }) {
        if (session.user) (session.user as { id?: string }).id = token.id as string;
        return session;
      },
      async redirect({ url, baseUrl }) {
        if (url.startsWith("/")) return `${baseUrl}${url}`;
        if (new URL(url).origin === baseUrl) return url;
        return baseUrl;
      },
    },
  };
}

/** Options for getServerSession in API routes. Prefer getAuthOptions() for auth route (per-request env). */
export const authOptions = getAuthOptions();

