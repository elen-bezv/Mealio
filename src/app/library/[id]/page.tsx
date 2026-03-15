"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer, Card, Button, Input, Textarea, LoadingFallback } from "@/components/ui";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import type { RecipeCategory } from "@/types";

const RECIPE_CATEGORIES: RecipeCategory[] = ["BREAKFAST", "LUNCH", "DINNER", "DESSERT", "SNACK", "OTHER"];
const CATEGORY_LABELS: Record<RecipeCategory, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
  DESSERT: "Dessert",
  SNACK: "Snack",
  OTHER: "Other",
};

type RecipeIngredient = {
  id: string;
  quantity: string;
  unit: string | null;
  displayName: string;
  ingredient: { name: string; category?: string | null };
};

type RecipeDetail = {
  id: string;
  title: string;
  description: string | null;
  categories: string[];
  displayTitle: string;
  displayDescription: string | null;
  displayInstructions: string[] | null;
  recipeIngredients: RecipeIngredient[];
  isBuiltIn: boolean;
};

async function fetchRecipe(id: string): Promise<RecipeDetail> {
  const r = await fetch(`/api/recipes/${id}`);
  if (!r.ok) {
    if (r.status === 404) throw new Error("Recipe not found");
    throw new Error("Failed to load recipe");
  }
  return r.json();
}

async function updateRecipe(
  id: string,
  data: {
    title: string;
    description?: string | null;
    categories?: RecipeCategory[];
    ingredients: { name: string; quantity: string; unit?: string | null }[];
  }
) {
  const r = await fetch(`/api/recipes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: data.title,
      description: data.description ?? null,
      categories: data.categories,
      ingredients: data.ingredients.map((ing) => ({
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit ?? null,
      })),
    }),
  });
  if (!r.ok) throw new Error((await r.json()).error ?? "Update failed");
  return r.json();
}

async function deleteRecipe(id: string) {
  const r = await fetch(`/api/recipes/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error((await r.json()).error ?? "Delete failed");
}

async function addRecipeIngredientsToShoppingList(
  name: string,
  ingredients: RecipeIngredient[]
): Promise<{ id: string }> {
  const r = await fetch("/api/shopping-lists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: name ? `Recipe: ${name}` : "My list",
      ingredients: ingredients.map((ri) => ({
        name: ri.displayName,
        quantity: ri.quantity,
        unit: ri.unit ?? undefined,
        category: ri.ingredient?.category ?? undefined,
      })),
    }),
  });
  if (!r.ok) throw new Error((await r.json()).error ?? "Failed to add to shopping list");
  return r.json();
}

export default function RecipeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const id = params.id as string;
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategories, setEditCategories] = useState<RecipeCategory[]>(["OTHER"]);
  const [editIngredients, setEditIngredients] = useState<{ name: string; quantity: string; unit?: string | null }[]>([]);

  const { data: recipe, isLoading, error } = useQuery({
    queryKey: ["recipe", id],
    queryFn: () => fetchRecipe(id),
    enabled: !!id,
  });

  useEffect(() => {
    if (recipe) {
      setEditTitle(recipe.displayTitle);
      setEditDescription(recipe.displayDescription ?? "");
      const raw = recipe.categories ?? ((recipe as unknown as { category?: string }).category ? [(recipe as unknown as { category: string }).category] : []);
      const cats = raw.filter((c): c is RecipeCategory => RECIPE_CATEGORIES.includes(c as RecipeCategory));
      setEditCategories(cats.length ? cats : ["OTHER"]);
      setEditIngredients(
        recipe.recipeIngredients.map((ri) => ({
          name: ri.displayName,
          quantity: ri.quantity,
          unit: ri.unit ?? undefined,
        }))
      );
    }
  }, [recipe]);

  useEffect(() => {
    if (searchParams.get("edit") === "1") setEditMode(true);
  }, [searchParams]);

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof updateRecipe>[1]) => updateRecipe(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipe", id] });
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      setEditMode(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteRecipe(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      router.push("/library");
    },
  });

  const addToListMutation = useMutation({
    mutationFn: () =>
      addRecipeIngredientsToShoppingList(recipe!.displayTitle, recipe!.recipeIngredients),
    onSuccess: (list) => {
      queryClient.invalidateQueries({ queryKey: ["shopping-lists"] });
      router.push(`/shopping?list=${list.id}`);
    },
  });

  if (isLoading || !id) return <LoadingFallback />;
  if (error || !recipe) {
    return (
      <AppLayout>
        <PageContainer>
          <p className="text-red-400">{(error as Error)?.message ?? "Recipe not found."}</p>
          <Button variant="secondary" onClick={() => router.push("/library")} style={{ marginTop: "var(--spacing-4)" }}>
            Back to library
          </Button>
        </PageContainer>
      </AppLayout>
    );
  }

  const canEdit = !recipe.isBuiltIn;

  return (
    <AppLayout>
      <PageContainer>
        <header className="page-header" style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "var(--spacing-4)", marginBottom: "var(--spacing-6)" }}>
          <Button variant="secondary" onClick={() => router.push("/library")}>
            ← Back to library
          </Button>
          <div className="flex flex-wrap gap-[var(--spacing-2)]">
            {canEdit && !editMode && (
              <Button variant="secondary" onClick={() => setEditMode(true)}>
                Edit
              </Button>
            )}
            {canEdit && editMode && (
              <>
                <Button
                  onClick={() =>
                    updateMutation.mutate({
                      title: editTitle,
                      description: editDescription || null,
                      categories: editCategories.length ? editCategories : ["OTHER"],
                      ingredients: editIngredients,
                    })
                  }
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? "Saving…" : "Save"}
                </Button>
                <Button variant="secondary" onClick={() => setEditMode(false)}>
                  Cancel
                </Button>
              </>
            )}
            {canEdit && (
              <Button
                variant="secondary"
                className="!text-red-400 !border-red-500/40"
                onClick={() => {
                  if (typeof window !== "undefined" && window.confirm("Delete this recipe?")) deleteMutation.mutate();
                }}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </Button>
            )}
          </div>
        </header>

        <Card style={{ padding: "var(--spacing-6)", marginBottom: "var(--spacing-6)" }}>
          {!editMode ? (
            <>
              <h1 className="page-title" style={{ marginBottom: "var(--spacing-2)" }}>{recipe.displayTitle}</h1>
              <p className="text-[var(--text-body-sm)] text-[var(--text-tertiary)]" style={{ marginBottom: "var(--spacing-4)" }}>
                {(recipe.categories ?? []).length
                  ? (recipe.categories as string[]).map((c) => CATEGORY_LABELS[c as RecipeCategory] ?? c).join(", ")
                  : "Other"}
              </p>
              {recipe.displayDescription && (
                <p className="text-[var(--text-body)] text-[var(--text-secondary)]" style={{ marginBottom: "var(--spacing-6)" }}>
                  {recipe.displayDescription}
                </p>
              )}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--spacing-3)", marginBottom: "var(--spacing-3)" }}>
                <h2 className="section-title" style={{ marginBottom: 0 }}>Ingredients</h2>
                {recipe.recipeIngredients.length > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => addToListMutation.mutate()}
                    disabled={addToListMutation.isPending}
                  >
                    {addToListMutation.isPending ? "Adding…" : "Add to shopping list"}
                  </Button>
                )}
              </div>
              <ul className="list-inside list-disc text-[var(--text-body)] text-[var(--text-secondary)]" style={{ marginBottom: "var(--spacing-6)" }}>
                {recipe.recipeIngredients.map((ri) => (
                  <li key={ri.id}>
                    {ri.displayName} – {ri.quantity} {ri.unit ?? ""}
                  </li>
                ))}
              </ul>
              {recipe.displayInstructions && recipe.displayInstructions.length > 0 && (
                <>
                  <h2 className="section-title" style={{ marginBottom: "var(--spacing-3)" }}>Instructions</h2>
                  <ol className="list-inside list-decimal text-[var(--text-body)] text-[var(--text-secondary)]">
                    {recipe.displayInstructions.map((step, i) => (
                      <li key={i} style={{ marginBottom: "var(--spacing-2)" }}>{step}</li>
                    ))}
                  </ol>
                </>
              )}
            </>
          ) : (
            <>
              <div className="input-wrap" style={{ marginBottom: "var(--spacing-4)" }}>
                <label className="input-label">Title</label>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </div>
              <div className="input-wrap" style={{ marginBottom: "var(--spacing-4)" }}>
                <label className="input-label">Categories</label>
                <div className="flex flex-wrap gap-2" style={{ marginTop: "var(--spacing-2)" }}>
                  {RECIPE_CATEGORIES.map((c) => {
                    const selected = editCategories.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setEditCategories((prev) =>
                            selected ? prev.filter((x) => x !== c) : [...prev, c]
                          );
                        }}
                        className="rounded-full px-3 py-1.5 text-[var(--text-body-sm)] font-medium transition-colors"
                        style={{
                          background: selected ? "var(--accent)" : "var(--bg-input)",
                          color: selected ? "var(--text-inverse)" : "var(--text-secondary)",
                          border: selected ? "none" : "1px solid var(--border-default)",
                        }}
                      >
                        {CATEGORY_LABELS[c]}
                      </button>
                    );
                  })}
                </div>
                <p className="input-helper" style={{ marginTop: "var(--spacing-1)" }}>
                  Select one or more. Used for filtering in Recipe Library.
                </p>
              </div>
              <div className="input-wrap" style={{ marginBottom: "var(--spacing-4)" }}>
                <label className="input-label">Description</label>
                <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} />
              </div>
              <h3 className="input-label" style={{ marginBottom: "var(--spacing-2)" }}>Ingredients</h3>
              <div className="flex flex-col gap-2" style={{ marginBottom: "var(--spacing-4)" }}>
                {editIngredients.map((ing, i) => (
                  <div key={i} className="flex flex-wrap gap-2 items-center">
                    <Input
                      placeholder="Name"
                      value={ing.name}
                      onChange={(e) => {
                        const next = [...editIngredients];
                        next[i] = { ...next[i], name: e.target.value };
                        setEditIngredients(next);
                      }}
                      className="flex-1 min-w-0"
                    />
                    <Input
                      placeholder="Qty"
                      value={ing.quantity}
                      onChange={(e) => {
                        const next = [...editIngredients];
                        next[i] = { ...next[i], quantity: e.target.value };
                        setEditIngredients(next);
                      }}
                      style={{ width: "4rem" }}
                    />
                    <Input
                      placeholder="Unit"
                      value={ing.unit ?? ""}
                      onChange={(e) => {
                        const next = [...editIngredients];
                        next[i] = { ...next[i], unit: e.target.value || null };
                        setEditIngredients(next);
                      }}
                      style={{ width: "5rem" }}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="!text-red-400"
                      onClick={() => setEditIngredients(editIngredients.filter((_, j) => j !== i))}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setEditIngredients([...editIngredients, { name: "", quantity: "1", unit: null }])}
                >
                  Add ingredient
                </Button>
              </div>
            </>
          )}
        </Card>
      </PageContainer>
    </AppLayout>
  );
}
