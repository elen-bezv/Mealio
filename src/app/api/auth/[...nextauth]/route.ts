import NextAuth from "next-auth";
import { getAuthOptions } from "@/lib/auth";

type NextAuthContext = { params: Promise<{ nextauth: string[] }> };

async function runNextAuth(req: Request, context: NextAuthContext) {
  try {
    const handler = NextAuth(getAuthOptions());
    const result = handler(req as any, context as any);
    return result instanceof Promise ? await result : result;
  } catch (err) {
    console.error("[NextAuth] Error:", err);
    throw err;
  }
}

export async function GET(req: Request, context: NextAuthContext) {
  return runNextAuth(req, context);
}

export async function POST(req: Request, context: NextAuthContext) {
  return runNextAuth(req, context);
}
