"use client";

import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer, Card } from "@/components/ui";

export default function DashboardPage() {
  const cards = [
    { href: "/import", title: "Import recipe", desc: "Paste link (blog, Instagram, TikTok), text, or upload photo/PDF. AI structures the recipe." },
    { href: "/cookbooks", title: "Cookbooks", desc: "Upload PDF cookbooks; detect and import multiple recipes at once." },
    { href: "/library", title: "Recipe library", desc: "Your saved recipes, tagged and categorized." },
    { href: "/ready-recipes", title: "Ready recipes", desc: "Built-in recipes to add to your plan or list." },
    { href: "/planner", title: "Weekly planner", desc: "Plan breakfast, lunch, dinner for the week." },
    { href: "/shopping", title: "Shopping list", desc: "Merged ingredients, ready to send to a store." },
    { href: "/pantry", title: "Pantry", desc: "Track what you have at home; lists auto-subtract pantry." },
    { href: "/stores", title: "Stores", desc: "Connect Walmart, Instacart, Tesco; agent fills cart." },
  ];

  return (
    <AppLayout>
      <PageContainer>
        <header className="page-header">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Upload recipes, plan meals, and shop across stores.
          </p>
        </header>

        <div
          className="grid gap-[var(--spacing-6)] sm:grid-cols-2 lg:grid-cols-3"
          style={{ marginBottom: "var(--spacing-8)" }}
        >
          {cards.map(({ href, title, desc }) => (
            <Link key={href} href={href}>
              <Card interactive>
                <h2 className="font-semibold text-[var(--text-section)] text-[var(--accent)]" style={{ marginBottom: "var(--spacing-2)" }}>
                  {title}
                </h2>
                <p className="text-[var(--text-secondary)]" style={{ fontSize: "var(--text-body-sm)", lineHeight: "var(--leading-normal)" }}>
                  {desc}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      </PageContainer>
    </AppLayout>
  );
}
