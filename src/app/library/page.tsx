"use client";

import { useState, useEffect, Suspense } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer, Card, Button, Input, Textarea, LoadingFallback } from "@/components/ui";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import type { ParseRecipeResult } from "@/types";

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
  category: string;
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

function LibraryContent() {
  const searchParams = useSearchParams();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [inputMode, setInputMode] = useState<"text" | "url">("text");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [parsed, setParsed] = useState<ParseRecipeResult | null>(null);
  const [parseLoading, setParseLoading] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (searchParams.get("upload") === "1") setUploadOpen(true);
  }, [searchParams]);

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

  const userRecipes = Array.isArray(recipes) ? recipes.filter((r: { isBuiltIn?: boolean }) => !r.isBuiltIn) : [];

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
        <header className="page-header" style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "var(--spacing-4)" }}>
          <div>
            <h1 className="page-title">Recipe Library</h1>
            <p className="page-subtitle">Save and manage your recipes.</p>
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
                <ul className="list-inside list-disc text-[var(--text-body-sm)] text-[var(--text-secondary)]" style={{ marginBottom: "var(--spacing-4)" }}>
                  {parsed.ingredients.map((i, idx) => (
                    <li key={idx}>{i.name} – {i.quantity} {i.unit ?? ""}</li>
                  ))}
                </ul>
                <Button onClick={() => saveMutation.mutate({ title: parsed.title, description: parsed.description, category: "OTHER", ingredients: parsed.ingredients })} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving…" : "Save to library"}
                </Button>
              </div>
            )}
          </Card>
        )}

        {isLoading ? (
          <p className="text-[var(--text-secondary)]">Loading…</p>
        ) : (
          <div className="grid gap-[var(--spacing-4)] sm:grid-cols-2 lg:grid-cols-3" style={{ marginBottom: "var(--spacing-8)" }}>
            {userRecipes.map((r: { id: string; title: string; displayTitle?: string; category: string; recipeIngredients: { length: number }[] }) => (
              <Card key={r.id} interactive>
                <h3 className="font-semibold text-[var(--text-body)]" style={{ marginBottom: "var(--spacing-1)" }}>{r.displayTitle ?? r.title}</h3>
                <p className="text-[var(--text-tertiary)]" style={{ fontSize: "var(--text-body-sm)" }}>{r.category} · {r.recipeIngredients?.length ?? 0} ingredients</p>
              </Card>
            ))}
            {userRecipes.length === 0 && !uploadOpen && (
              <p className="col-span-full text-[var(--text-secondary)]" style={{ padding: "var(--spacing-6)" }}>No recipes yet. Upload a recipe to get started.</p>
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
