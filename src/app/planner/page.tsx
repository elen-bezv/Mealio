"use client";

import { useState, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer, Card, Button, Input } from "@/components/ui";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { DAYS, MEAL_SLOTS, MEAL_SLOT_LABELS, type MealSlot } from "@/types";

type MealPlanRecipe = { dayOfWeek: number; mealSlot: string; recipeId: string; recipe?: { id: string; title?: string; displayTitle?: string } };
type Plan = {
  id: string;
  name: string | null;
  weekStart: string;
  mealPlanRecipes: MealPlanRecipe[];
};

async function fetchPlans(): Promise<Plan[]> {
  const r = await fetch("/api/meal-plans");
  if (!r.ok) throw new Error("Failed to fetch");
  return r.json();
}

async function fetchPlan(id: string): Promise<Plan> {
  const r = await fetch(`/api/meal-plans/${id}`);
  if (!r.ok) throw new Error("Failed to fetch plan");
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

async function updatePlan(
  id: string,
  data: { name?: string; weekStart: string; slots: { dayOfWeek: number; mealSlot: string; recipeId: string }[] }
) {
  const r = await fetch(`/api/meal-plans/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Failed to update plan");
  return r.json();
}

async function deletePlan(id: string) {
  const r = await fetch(`/api/meal-plans/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error("Failed to delete plan");
}

async function repeatPlan(sourcePlanId: string, newWeekStart?: string) {
  const r = await fetch("/api/meal-plans/repeat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourcePlanId, newWeekStart }),
  });
  if (!r.ok) throw new Error("Failed to repeat plan");
  return r.json() as Promise<Plan>;
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


function formatWeekStart(weekStart: string | Date): string {
  const d = typeof weekStart === "string" ? new Date(weekStart) : weekStart;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function getDefaultWeekStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
}

export default function PlannerPage() {
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [planName, setPlanName] = useState("");
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(getDefaultWeekStart);
  const gridSectionRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: plans } = useQuery({ queryKey: ["meal-plans"], queryFn: fetchPlans });
  const { data: recipes } = useQuery({ queryKey: ["recipes"], queryFn: fetchRecipes });

  const createMutation = useMutation({
    mutationFn: createPlan,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["meal-plans"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updatePlan>[1] }) => updatePlan(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["meal-plans"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: deletePlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-plans"] });
      setEditingPlanId(null);
      setSelected({});
      setPlanName("");
      setWeekStart(getDefaultWeekStart());
    },
  });

  const repeatMutation = useMutation({
    mutationFn: ({ sourcePlanId, newWeekStart }: { sourcePlanId: string; newWeekStart?: string }) =>
      repeatPlan(sourcePlanId, newWeekStart),
    onSuccess: (newPlan) => {
      queryClient.invalidateQueries({ queryKey: ["meal-plans"] });
      openPlanInGrid(newPlan);
    },
  });

  const listMutation = useMutation({
    mutationFn: createListFromPlan,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["shopping-lists"] });
      router.push(`/shopping?list=${data.id}`);
    },
  });

  function openPlanInGrid(plan: Plan) {
    const sel: Record<string, string> = {};
    for (const r of plan.mealPlanRecipes) {
      const dayStr = DAYS[r.dayOfWeek];
      if (dayStr) sel[`${dayStr}-${r.mealSlot}`] = r.recipeId;
    }
    setSelected(sel);
    setPlanName(plan.name ?? "");
    setWeekStart(new Date(plan.weekStart));
    setEditingPlanId(plan.id);
    setTimeout(() => gridSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }

  async function handleOpenSavedPlan(planId: string) {
    const plan = await fetchPlan(planId);
    openPlanInGrid(plan);
  }

  function clearGrid() {
    setSelected({});
    setPlanName("");
    setEditingPlanId(null);
    setWeekStart(getDefaultWeekStart());
  }

  const allRecipes = Array.isArray(recipes) ? recipes : [];

  const slotsForSubmit = Object.entries(selected)
    .filter(([, recipeId]) => recipeId)
    .map(([key, recipeId]) => {
      const [dayStr, slot] = key.split("-");
      const dayOfWeek = DAYS.indexOf(dayStr as (typeof DAYS)[number]);
      return { dayOfWeek: dayOfWeek >= 0 ? dayOfWeek : 0, mealSlot: slot, recipeId };
    });

  const handleSave = () => {
    if (editingPlanId) {
      updateMutation.mutate({
        id: editingPlanId,
        data: {
          name: planName || undefined,
          weekStart: weekStart.toISOString(),
          slots: slotsForSubmit,
        },
      });
    } else {
      createMutation.mutate({
        name: planName || undefined,
        weekStart: weekStart.toISOString(),
        slots: slotsForSubmit,
      });
    }
  };

  const handleDelete = (planId: string) => {
    if (typeof window !== "undefined" && !window.confirm("Delete this meal plan? This cannot be undone.")) return;
    deleteMutation.mutate(planId);
  };

  return (
    <AppLayout>
      <PageContainer>
        <header className="page-header">
          <h1 className="page-title">Weekly Planner</h1>
          <p className="page-subtitle">
            Plan Breakfast, Lunch, Dinner, and Dessert / Snack for the week.
          </p>
        </header>

        <div className="flex flex-wrap items-center gap-[var(--spacing-4)] planner-name-row" style={{ marginBottom: "var(--spacing-6)" }}>
          <div className="planner-input-wrap">
            <Input
              placeholder="Plan name (optional)"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              className="max-w-xs"
            />
          </div>
          <span className="text-[var(--text-secondary)]" style={{ fontSize: "var(--text-body-sm)" }}>
            Week of {formatWeekStart(weekStart)}
          </span>
          <Button
            onClick={handleSave}
            disabled={
              (createMutation.isPending || updateMutation.isPending) ||
              (editingPlanId ? false : slotsForSubmit.length === 0)
            }
          >
            {createMutation.isPending || updateMutation.isPending
              ? "Saving…"
              : editingPlanId
                ? "Update plan"
                : "Save plan"}
          </Button>
          {editingPlanId && (
            <Button variant="secondary" size="sm" onClick={clearGrid}>
              New plan
            </Button>
          )}
        </div>

        <div ref={gridSectionRef} className="overflow-x-auto" style={{ marginBottom: "var(--spacing-8)" }}>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border-b border-[var(--border-subtle)] p-4 text-left text-[var(--text-tertiary)]" style={{ fontSize: "var(--text-body-sm)" }}>Day</th>
                  {MEAL_SLOTS.map((s) => (
                    <th key={s} className="border-b border-[var(--border-subtle)] p-4 text-left text-[var(--text-tertiary)]" style={{ fontSize: "var(--text-body-sm)" }}>
                      {MEAL_SLOT_LABELS[s]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day) => (
                  <tr key={day}>
                    <td className="border-b border-[var(--border-subtle)] p-4 font-semibold text-[var(--text-body)]">{day}</td>
                    {MEAL_SLOTS.map((slot) => (
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
                          {allRecipes.map((r: { id: string; title?: string; displayTitle?: string }) => (
                            <option key={r.id} value={r.id}>{r.displayTitle ?? r.title ?? r.id}</option>
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
            <p className="text-[var(--text-body-sm)] text-[var(--text-secondary)]" style={{ marginBottom: "var(--spacing-4)" }}>
              Open a plan to see the full week and edit it. Use Repeat plan to copy it to a new week. Create shopping list to generate a list from that plan.
            </p>
            <div className="flex flex-wrap gap-[var(--spacing-4)]">
              {(plans as Plan[]).map((p) => {
                const recipeCount = p.mealPlanRecipes?.length ?? 0;
                return (
                  <Card
                    key={p.id}
                    interactive
                    className="cursor-pointer"
                    style={{ padding: "var(--spacing-4)", minWidth: "280px" }}
                    onClick={() => handleOpenSavedPlan(p.id)}
                  >
                    <div style={{ marginBottom: "var(--spacing-3)" }}>
                      {p.name ? (
                        <p className="font-semibold text-[var(--text-body)]">{p.name}</p>
                      ) : null}
                      <p className="text-[var(--text-body-sm)] text-[var(--text-secondary)]">
                        Week of {formatWeekStart(p.weekStart)}
                      </p>
                      <p className="text-[var(--text-body-sm)] text-[var(--text-tertiary)]">
                        {recipeCount} recipe{recipeCount !== 1 ? "s" : ""} · Breakfast, Lunch, Dinner, Dessert / Snack
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-[var(--spacing-2)]" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        onClick={() => handleOpenSavedPlan(p.id)}
                      >
                        Open
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => repeatMutation.mutate({ sourcePlanId: p.id })}
                        disabled={repeatMutation.isPending}
                      >
                        Repeat plan
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => listMutation.mutate(p.id)}
                        disabled={listMutation.isPending}
                      >
                        Create shopping list
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(p.id)}
                        disabled={deleteMutation.isPending}
                      >
                        Delete
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </PageContainer>
    </AppLayout>
  );
}
