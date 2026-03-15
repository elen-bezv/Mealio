"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer, Card, Button, Input, Textarea, LoadingFallback } from "@/components/ui";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import type { ParseRecipeResult, RecipeCategory } from "@/types";

const RECIPE_CATEGORIES: RecipeCategory[] = ["BREAKFAST", "LUNCH", "DINNER", "DESSERT", "SNACK", "OTHER"];
const CATEGORY_LABELS: Record<RecipeCategory, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
  DESSERT: "Dessert",
  SNACK: "Snack",
  OTHER: "Other",
};

type RecipeItem = {
  id: string;
  title: string;
  displayTitle?: string;
  categories: string[];
  recipeIngredients: { length: number }[];
};

async function fetchRecipes() {
  const r = await fetch("/api/recipes");
  if (!r.ok) throw new Error("Failed to fetch");
  return r.json();
}

async function parseRecipe(body: { text?: string; url?: string }) {
  const r = await fetch("/api/parse-recipe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("Parse failed");
  return r.json() as Promise<ParseRecipeResult>;
}

async function createRecipe(data: {
  title: string;
  description?: string;
  categories: RecipeCategory[];
  ingredients: { name: string; quantity: string; unit?: string; category?: string }[];
}) {
  const r = await fetch("/api/recipes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Failed to save");
  return r.json();
}

async function deleteRecipe(id: string) {
  const r = await fetch(`/api/recipes/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error((await r.json()).error ?? "Delete failed");
}

function LibraryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [inputMode, setInputMode] = useState<"text" | "url">("text");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [parsed, setParsed] = useState<ParseRecipeResult | null>(null);
  const [parseLoading, setParseLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<RecipeCategory | null>(null);
  const [saveCategories, setSaveCategories] = useState<RecipeCategory[]>(["OTHER"]);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const importedCount = searchParams.get("imported");

  useEffect(() => {
    if (searchParams.get("upload") === "1") setUploadOpen(true);
  }, [searchParams]);

  useEffect(() => {
    if (!menuOpenId) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpenId(null);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpenId]);

  const { data: recipes, isLoading } = useQuery({
    queryKey: ["recipes"],
    queryFn: fetchRecipes,
  });

  const saveMutation = useMutation({
    mutationFn: createRecipe,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      setParsed(null);
      setUploadOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRecipe,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      setMenuOpenId(null);
    },
  });

  const recipesList = Array.isArray(recipes) ? recipes : [];
  const filtered =
    selectedCategory == null
      ? recipesList
      : recipesList.filter((r: RecipeItem) => {
          const cats = Array.isArray(r.categories) && r.categories.length > 0 ? r.categories : ["OTHER"];
          return cats.includes(selectedCategory);
        });

  async function handleParse() {
    setParseLoading(true);
    try {
      const result = await parseRecipe(inputMode === "url" ? { url } : { text });
      setParsed(result);
    } finally {
      setParseLoading(false);
    }
  }

  return (
    <AppLayout>
      <PageContainer>
        {importedCount != null && Number(importedCount) > 0 && (
          <div className="card border-[var(--accent)]/30 bg-[var(--accent-muted)]" style={{ padding: "var(--spacing-4)", marginBottom: "var(--spacing-6)" }} role="status">
            <p className="text-[var(--text-body)] text-[var(--accent)]">
              Added {importedCount} recipe{Number(importedCount) !== 1 ? "s" : ""} to your library.
            </p>
          </div>
        )}

        <header className="page-header" style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "var(--spacing-4)", marginBottom: "var(--spacing-6)" }}>
          <div>
            <h1 className="page-title">Recipe Library</h1>
            <p className="page-subtitle">
              Your recipes by category. Import or create, then browse, edit, and add to planner or shopping list.
            </p>
          </div>
          <Button onClick={() => setUploadOpen(true)}>Upload recipe</Button>
        </header>

        {uploadOpen && (
          <Card style={{ marginBottom: "var(--spacing-8)" }}>
            <div className="flex flex-wrap gap-[var(--spacing-2)]" style={{ marginBottom: "var(--spacing-4)" }}>
              <Button variant={inputMode === "text" ? "primary" : "secondary"} size="sm" onClick={() => setInputMode("text")}>
                Paste text
              </Button>
              <Button variant={inputMode === "url" ? "primary" : "secondary"} size="sm" onClick={() => setInputMode("url")}>
                Website URL
              </Button>
            </div>
            {inputMode === "text" ? (
              <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste recipe here..." rows={6} />
            ) : (
              <Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
            )}
            <div className="flex flex-wrap gap-[var(--spacing-3)]" style={{ marginTop: "var(--spacing-4)" }}>
              <Button onClick={handleParse} disabled={parseLoading || (inputMode === "text" ? !text.trim() : !url.trim())}>
                {parseLoading ? "Extracting…" : "Extract ingredients"}
              </Button>
              <Button variant="secondary" onClick={() => setUploadOpen(false)}>Cancel</Button>
            </div>
            {parsed && (
              <div className="card mt-6" style={{ padding: "var(--spacing-4)", background: "var(--bg-input)" }}>
                <h3 className="font-semibold text-[var(--text-section)]" style={{ marginBottom: "var(--spacing-2)" }}>{parsed.title}</h3>
                <p className="input-helper" style={{ marginBottom: "var(--spacing-4)" }}>{parsed.ingredients.length} ingredients</p>
                <div className="input-wrap" style={{ marginBottom: "var(--spacing-4)" }}>
                  <label className="input-label">Categories</label>
                  <div className="flex flex-wrap gap-2" style={{ marginTop: "var(--spacing-2)" }}>
                    {RECIPE_CATEGORIES.map((c) => {
                      const selected = saveCategories.includes(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            setSaveCategories((prev) =>
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
                  <p className="input-helper" style={{ marginTop: "var(--spacing-1)" }}>Select one or more. If none, Other is used.</p>
                </div>
                <ul className="list-inside list-disc text-[var(--text-body-sm)] text-[var(--text-secondary)]" style={{ marginBottom: "var(--spacing-4)" }}>
                  {parsed.ingredients.map((i, idx) => (
                    <li key={idx}>{i.name} – {i.quantity} {i.unit ?? ""}</li>
                  ))}
                </ul>
                <Button onClick={() => saveMutation.mutate({ title: parsed.title, description: parsed.description, categories: saveCategories.length ? saveCategories : ["OTHER"], ingredients: parsed.ingredients })} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving…" : "Save to library"}
                </Button>
              </div>
            )}
          </Card>
        )}

        <div className="flex flex-wrap gap-2" style={{ marginBottom: "var(--spacing-6)" }}>
          <Button
            variant={selectedCategory === null ? "primary" : "secondary"}
            size="sm"
            onClick={() => setSelectedCategory(null)}
            className="rounded-full"
          >
            All
          </Button>
          {RECIPE_CATEGORIES.map((c) => (
            <Button
              key={c}
              variant={selectedCategory === c ? "primary" : "secondary"}
              size="sm"
              onClick={() => setSelectedCategory(c)}
              className="rounded-full"
            >
              {CATEGORY_LABELS[c]}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <p className="text-[var(--text-secondary)]">Loading…</p>
        ) : (
          <div className="grid gap-[var(--spacing-4)] sm:grid-cols-2 lg:grid-cols-3" style={{ marginBottom: "var(--spacing-8)" }}>
            {filtered.map((r: RecipeItem) => (
              <div
                key={r.id}
                className="card card-interactive cursor-pointer"
                style={{ position: "relative", padding: "var(--spacing-4)" }}
                onClick={() => router.push(`/library/${r.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/library/${r.id}`);
                  }
                }}
              >
                <div
                  ref={menuOpenId === r.id ? menuRef : undefined}
                  className="absolute"
                  style={{ top: "var(--spacing-2)", right: "var(--spacing-2)" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="rounded p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    aria-label="Recipe menu"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId((id) => (id === r.id ? null : r.id));
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <circle cx="12" cy="6" r="1.5" />
                      <circle cx="12" cy="12" r="1.5" />
                      <circle cx="12" cy="18" r="1.5" />
                    </svg>
                  </button>
                  {menuOpenId === r.id && (
                    <div
                      className="card border-[var(--border-default)]"
                      style={{
                        position: "absolute",
                        right: 0,
                        top: "100%",
                        marginTop: "var(--spacing-1)",
                        minWidth: "140px",
                        padding: "var(--spacing-1)",
                        zIndex: 10,
                        background: "var(--bg-card)",
                      }}
                    >
                      <button
                        type="button"
                        className="block w-full rounded px-3 py-2 text-left text-[var(--text-body-sm)] text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-body)]"
                        onClick={() => {
                          setMenuOpenId(null);
                          router.push(`/library/${r.id}`);
                        }}
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        className="block w-full rounded px-3 py-2 text-left text-[var(--text-body-sm)] text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-body)]"
                        onClick={() => {
                          setMenuOpenId(null);
                          router.push(`/library/${r.id}?edit=1`);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="block w-full rounded px-3 py-2 text-left text-[var(--text-body-sm)] text-red-400 hover:bg-red-500/10"
                        onClick={() => {
                          setMenuOpenId(null);
                          if (typeof window !== "undefined" && window.confirm("Delete this recipe?")) {
                            deleteMutation.mutate(r.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        {deleteMutation.isPending ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  )}
                </div>
                <h3 className="font-semibold text-[var(--text-body)] pr-8" style={{ marginBottom: "var(--spacing-1)" }}>{r.displayTitle ?? r.title}</h3>
                <p className="text-[var(--text-tertiary)]" style={{ fontSize: "var(--text-body-sm)" }}>
                  {(r.categories ?? []).length
                    ? (r.categories as string[]).map((c) => CATEGORY_LABELS[c as RecipeCategory] ?? c).join(", ")
                    : "Other"}
                  {" · "}{r.recipeIngredients?.length ?? 0} ingredients
                </p>
              </div>
            ))}
            {filtered.length === 0 && !uploadOpen && (
              <p className="col-span-full text-[var(--text-secondary)]" style={{ padding: "var(--spacing-6)" }}>
                {recipesList.length === 0
                  ? "No recipes yet. Import a recipe or use Upload recipe to get started."
                  : selectedCategory
                    ? `No recipes in ${CATEGORY_LABELS[selectedCategory]}. Try another category or add a recipe.`
                    : "No recipes yet. Import a recipe or use Upload recipe to get started."}
              </p>
            )}
          </div>
        )}
      </PageContainer>
    </AppLayout>
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <LibraryContent />
    </Suspense>
  );
}
