"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer, Card, Button } from "@/components/ui";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

async function fetchBuiltInRecipes() {
  const r = await fetch("/api/recipes?builtIn=true");
  if (!r.ok) throw new Error("Failed to fetch");
  return r.json();
}

async function createListFromIngredients(ingredients: { name: string; quantity: string; unit?: string }[]) {
  const res = await fetch("/api/shopping-lists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ingredients, name: "From Ready Recipe" }),
  });
  if (!res.ok) throw new Error("Failed to create list");
  return res.json();
}

const CATEGORIES = ["BREAKFAST", "LUNCH", "DINNER", "DESSERT", "SNACK", "OTHER"];

export default function ReadyRecipesPage() {
  const [category, setCategory] = useState<string | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: recipes, isLoading } = useQuery({
    queryKey: ["recipes", "builtIn"],
    queryFn: fetchBuiltInRecipes,
  });

  const addToListMutation = useMutation({
    mutationFn: createListFromIngredients,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["shopping-lists"] });
      router.push(`/shopping?list=${data.id}`);
    },
  });

  const filtered = Array.isArray(recipes)
    ? category
      ? recipes.filter((r: { category: string }) => r.category === category)
      : recipes
    : [];

  return (
    <AppLayout>
      <PageContainer>
        <header className="page-header">
          <h1 className="page-title">Ready Recipes</h1>
          <p className="page-subtitle">
            Add built-in recipes to your meal plan or shopping list.
          </p>
        </header>

        <div className="flex flex-wrap gap-2" style={{ marginBottom: "var(--spacing-6)" }}>
          <Button
            variant={category === null ? "primary" : "secondary"}
            size="sm"
            onClick={() => setCategory(null)}
            className="rounded-full"
          >
            All
          </Button>
          {CATEGORIES.map((c) => (
            <Button
              key={c}
              variant={category === c ? "primary" : "secondary"}
              size="sm"
              onClick={() => setCategory(c)}
              className="rounded-full"
            >
              {c}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <p className="text-[var(--text-secondary)]">Loading…</p>
        ) : (
          <div className="grid gap-[var(--spacing-4)] sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((r: {
              id: string;
              title: string;
              description: string | null;
              category: string;
              recipeIngredients: { quantity: string; unit: string | null; ingredient: { name: string } }[];
            }) => (
              <Card key={r.id} interactive>
                <h3 className="font-semibold text-[var(--text-body)]">{r.title}</h3>
                {r.description && (
                  <p className="input-helper mt-1">{r.description}</p>
                )}
                <p className="text-[var(--text-body-sm)] text-[var(--text-secondary)]" style={{ marginTop: "var(--spacing-2)" }}>
                  {r.recipeIngredients?.length ?? 0} ingredients
                </p>
                <Button
                  size="sm"
                  onClick={() =>
                    addToListMutation.mutate(
                      r.recipeIngredients?.map((ri: { quantity: string; unit: string | null; ingredient: { name: string } }) => ({
                        name: ri.ingredient.name,
                        quantity: ri.quantity,
                        unit: ri.unit ?? undefined,
                      })) ?? []
                    )
                  }
                  disabled={addToListMutation.isPending}
                  style={{ marginTop: "var(--spacing-4)" }}
                >
                  Add to shopping list
                </Button>
              </Card>
            ))}
          </div>
        )}
      </PageContainer>
    </AppLayout>
  );
}
