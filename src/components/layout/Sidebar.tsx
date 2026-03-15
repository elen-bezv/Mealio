"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useTranslations } from "next-intl";

const NAV = [
  { href: "/", labelKey: "dashboard" },
  { href: "/import", labelKey: "importRecipe" },
  { href: "/library", labelKey: "recipeLibrary" },
  { href: "/planner", labelKey: "weeklyPlanner" },
  { href: "/shopping", labelKey: "shoppingList" },
  { href: "/pantry", labelKey: "pantry" },
  { href: "/stores", labelKey: "storeConnections" },
  { href: "/settings", labelKey: "settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const t = useTranslations("common");
  const { data: session } = useSession();

  return (
    <aside
      className="fixed left-0 top-0 z-40 flex h-full w-[var(--sidebar-width)] flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-surface)]"
      style={{ padding: "var(--spacing-6)" }}
    >
      <Link
        href="/"
        className="mb-[var(--spacing-8)] block font-semibold text-[var(--text-title)] leading-tight text-[var(--accent)]"
        style={{ fontSize: "var(--text-title)" }}
      >
        {t("appName")}
      </Link>
      <nav className="flex flex-col gap-[var(--spacing-1)]">
        {NAV.map(({ href, labelKey }) => (
          <Link
            key={href}
            href={href}
            className={`rounded-[var(--radius-md)] px-[var(--spacing-4)] py-[var(--spacing-3)] text-[var(--text-body-sm)] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] ${
              pathname === href ? "bg-[var(--bg-surface-hover)] text-[var(--text-primary)]" : ""
            }`}
          >
            {t(labelKey)}
          </Link>
        ))}
      </nav>
      <div style={{ marginTop: "auto", paddingTop: "var(--spacing-8)" }}>
        {session?.user && (
          <div
            className="mb-3 truncate rounded-[var(--radius-md)] px-[var(--spacing-4)] py-[var(--spacing-2)] text-[var(--text-body-sm)] text-[var(--text-secondary)]"
            title={session.user.email ?? undefined}
          >
            {session.user.image && (
              <img
                src={session.user.image}
                alt=""
                className="mr-2 inline-block h-6 w-6 rounded-full align-middle"
              />
            )}
            <span className="truncate align-middle">
              {session.user.name ?? session.user.email ?? "Signed in"}
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="btn btn-ghost w-full justify-start text-[var(--text-tertiary)]"
        >
          {t("signOut")}
        </button>
      </div>
    </aside>
  );
}
