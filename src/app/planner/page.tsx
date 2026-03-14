"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer, Card, Button, Input } from "@/components/ui";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { DAYS, type MealSlot } from "@/types";

async function fetchPlans() {
  const r = await fetch("/api/meal-plans");
  if (!r.ok) throw new Error("Failed to fetch");
  return r.json();
}

async function fetchRecipes() {
  const r = await fetch("/api/recipes");
  if (!r.ok) throw new Error("Failed to fetch");
  return r.json();
}

async function createPlan(data: {
  name?: string;
  weekStart: string;
  slots: { dayOfWeek: number; mealSlot: string; recipeId: string }[];
}) {
  const r = await fetch("/api/meal-plans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Failed to create plan");
  return r.json();
}

async function createListFromPlan(mealPlanId: string) {
  const r = await fetch("/api/shopping-lists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mealPlanId }),
  });
  if (!r.ok) throw new Error("Failed to create list");
  return r.json();
}

const SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "dessert"];

export default function PlannerPage() {
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [planName, setPlanName] = useState("");
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: plans } = useQuery({ queryKey: ["meal-plans"], queryFn: fetchPlans });
  const { data: recipes } = useQuery({ queryKey: ["recipes"], queryFn: fetchRecipes });

  const createMutation = useMutation({
    mutationFn: createPlan,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["meal-plans"] }),
  });

  const listMutation = useMutation({
    mutationFn: createListFromPlan,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["shopping-lists"] });
      router.push(`/shopping?list=${data.id}`);
    },
  });

  const userRecipes = Array.isArray(recipes) ? recipes.filter((r: { isBuiltIn?: boolean }) => !r.isBuiltIn) : [];
  const builtIn = Array.isArray(recipes) ? recipes.filter((r: { isBuiltIn?: boolean }) => r.isBuiltIn) : [];
  const allRecipes = [...userRecipes, ...builtIn];

  const slotsForSubmit = Object.entries(selected)
    .filter(([, recipeId]) => recipeId)
    .map(([key, recipeId]) => {
      const [dayStr, slot] = key.split("-");
      const dayOfWeek = DAYS.indexOf(dayStr as (typeof DAYS)[number]);
      return { dayOfWeek: dayOfWeek >= 0 ? dayOfWeek : 0, mealSlot: slot, recipeId };
    });

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);

  return (
    <AppLayout>
      <PageContainer>
        <header className="page-header">
          <h1 className="page-title">Weekly Planner</h1>
          <p className="page-subtitle">
            Plan breakfast, lunch, dinner (and optional dessert) for the week.
          </p>
        </header>

        <div className="flex flex-wrap items-center gap-[var(--spacing-4)]" style={{ marginBottom: "var(--spacing-6)" }}>
          <Input
            placeholder="Plan name (optional)"
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
            className="max-w-xs"
          />
          <Button
            onClick={() =>
              createMutation.mutate({
                name: planName || undefined,
                weekStart: weekStart.toISOString(),
                slots: slotsForSubmit,
              })
            }
            disabled={createMutation.isPending || slotsForSubmit.length === 0}
          >
            {createMutation.isPending ? "Saving…" : "Save plan"}
          </Button>
        </div>

        <div className="overflow-x-auto" style={{ marginBottom: "var(--spacing-8)" }}>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border-b border-[var(--border-subtle)] p-4 text-left text-[var(--text-tertiary)]" style={{ fontSize: "var(--text-body-sm)" }}>Day</th>
                  {SLOTS.map((s) => (
                    <th key={s} className="border-b border-[var(--border-subtle)] p-4 text-left capitalize text-[var(--text-tertiary)]" style={{ fontSize: "var(--text-body-sm)" }}>
                      {s}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day) => (
                  <tr key={day}>
                    <td className="border-b border-[var(--border-subtle)] p-4 font-semibold text-[var(--text-body)]">{day}</td>
                    {SLOTS.map((slot) => (
                      <td key={slot} className="border-b border-[var(--border-subtle)] p-4">
                        <select
                          value={selected[`${day}-${slot}`] ?? ""}
                          onChange={(e) =>
                            setSelected((prev) => ({
                              ...prev,
                              [`${day}-${slot}`]: e.target.value,
                            }))
                          }
                          className="select w-full"
                        >
                          <option value="">—</option>
                          {allRecipes.map((r: { id: string; title: string }) => (
                            <option key={r.id} value={r.id}>{r.title}</option>
                          ))}
                        </select>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        {Array.isArray(plans) && plans.length > 0 && (
          <div className="section">
            <h2 className="section-title">Saved plans</h2>
            <div className="flex flex-wrap gap-[var(--spacing-4)]">
              {plans.map((p: { id: string; name: string | null; weekStart: string }) => (
                <Card key={p.id} style={{ padding: "var(--spacing-4)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--spacing-3)" }}>
                  <span className="text-[var(--text-secondary)]" style={{ fontSize: "var(--text-body)" }}>
                    {p.name ?? new Date(p.weekStart).toLocaleDateString()}
                  </span>
                  <Button size="sm" onClick={() => listMutation.mutate(p.id)} disabled={listMutation.isPending}>
                    Create shopping list
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        )}
      </PageContainer>
    </AppLayout>
  );
}
