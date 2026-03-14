"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Sidebar } from "./Sidebar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="spinner" aria-hidden />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main
        className="flex-1 min-w-0"
        style={{
          marginLeft: "var(--sidebar-width)",
          padding: "var(--page-padding-y) var(--page-padding-x) var(--spacing-16)",
        }}
      >
        {children}
      </main>
    </div>
  );
}
