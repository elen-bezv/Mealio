"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer, Card, Button, Input, Textarea } from "@/components/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { ParseRecipeProResult, StructuredRecipe, ParserWarning, StructuredIngredient } from "@/types";

type InputMode = "url" | "text" | "file";

async function parseRecipePro(payload: {
  type: InputMode;
  url?: string;
  text?: string;
  file?: File;
}): Promise<ParseRecipeProResult> {
  if (payload.type === "file" && payload.file) {
    const form = new FormData();
    form.set("file", payload.file);
    const r = await fetch("/api/parse-recipe-pro", { method: "POST", body: form });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error ?? "Parse failed");
    return data;
  }
  if (payload.type === "url" && payload.url) {
    const r = await fetch("/api/parse-recipe-pro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "url", url: payload.url }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error ?? "Parse failed");
    return data;
  }
  if (payload.text) {
    const r = await fetch("/api/parse-recipe-pro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "text", text: payload.text }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error ?? "Parse failed");
    return data;
  }
  throw new Error("Missing input");
}

async function saveRecipe(data: {
  title: string;
  description?: string;
  sourceUrl?: string;
  sourceType?: string;
  ingredients: StructuredIngredient[];
  instructions?: string[];
}) {
  const r = await fetch("/api/recipes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: data.title,
      description: data.description,
      category: "OTHER",
      sourceUrl: data.sourceUrl,
      sourceType: data.sourceType,
      instructions: data.instructions,
      ingredients: data.ingredients.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        category: i.category,
        preparation: i.preparation,
        rawLine: i.preparation ? `${i.rawLine ?? ""} (${i.preparation})`.trim() || undefined : i.rawLine,
      })),
    }),
  });
  if (!r.ok) throw new Error((await r.json()).error ?? "Save failed");
  return r.json();
}

async function overwriteRecipe(
  recipeId: string,
  data: {
    title: string;
    description?: string;
    ingredients: StructuredIngredient[];
  }
) {
  const r = await fetch(`/api/recipes/${recipeId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: data.title,
      description: data.description,
      ingredients: data.ingredients.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        category: i.category,
      })),
    }),
  });
  if (!r.ok) throw new Error((await r.json()).error ?? "Update failed");
  return r.json();
}

export default function ImportPage() {
  const [mode, setMode] = useState<InputMode>("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParseRecipeProResult | null>(null);
  const [duplicateAction, setDuplicateAction] = useState<"overwrite" | "copy" | "cancel" | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();

  const parseMutation = useMutation({
    mutationFn: parseRecipePro,
    onSuccess: (data) => setPreview(data),
    onError: () => setPreview(null),
  });

  const isFailedImport = preview?.parseStatus === "failed";
  const showPreviewCard = preview && !isFailedImport && preview.recipe;

  const saveMutation = useMutation({
    mutationFn: saveRecipe,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      router.push("/library");
    },
  });

  const overwriteMutation = useMutation({
    mutationFn: ({ recipeId, data }: { recipeId: string; data: { title: string; description?: string; ingredients: StructuredIngredient[] } }) =>
      overwriteRecipe(recipeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      router.push("/library");
    },
  });

  const handleParse = () => {
    if (mode === "url" && url.trim()) parseMutation.mutate({ type: "url", url: url.trim() });
    else if (mode === "text" && text.trim()) parseMutation.mutate({ type: "text", text: text.trim() });
    else if (mode === "file" && file) parseMutation.mutate({ type: "file", file });
  };

  const handleSave = () => {
    if (!preview?.recipe) return;
    const { recipe, duplicateRecipeId, duplicateRecipeTitle } = preview;
    if (duplicateRecipeId && duplicateAction === "cancel") return;
    if (duplicateRecipeId && duplicateAction === "overwrite") {
      overwriteMutation.mutate({
        recipeId: duplicateRecipeId,
        data: {
          title: recipe.title,
          description: recipe.description,
          ingredients: recipe.ingredients,
        },
      });
      return;
    }
    saveMutation.mutate({
      title: recipe.title,
      description: recipe.description,
      sourceUrl: recipe.sourceUrl,
      sourceType: recipe.sourceType,
      instructions: recipe.instructions,
      ingredients: recipe.ingredients,
    });
  };

  const applySuggestion = (ingredientIndex: number, suggestion: string) => {
    if (!preview?.recipe) return;
    const match = suggestion.match(/(\d+)\s*(.*)/);
    const qty = match ? match[1] : "";
    const unit = match ? match[2].trim() : suggestion;
    const ing = preview.recipe.ingredients[ingredientIndex];
    if (ing) {
      if (qty) ing.quantity = qty;
      if (unit && !ing.unit) ing.unit = unit;
    }
    setPreview({ ...preview });
  };

  return (
    <AppLayout>
      <PageContainer>
        <header className="page-header">
          <h1 className="page-title">Import Recipe</h1>
          <p className="page-subtitle">
            Paste a link, paste text, or upload a photo or PDF. We’ll extract the recipe and let you confirm before saving.
          </p>
        </header>

        <Card style={{ marginBottom: "var(--spacing-6)" }}>
          <div className="flex flex-wrap gap-[var(--spacing-2)]" style={{ marginBottom: "var(--spacing-4)" }}>
            {(["url", "text", "file"] as const).map((m) => (
              <Button
                key={m}
                variant={mode === m ? "primary" : "secondary"}
                size="sm"
                onClick={() => setMode(m)}
              >
                {m === "url" ? "Website / Instagram / TikTok" : m === "text" ? "Paste text" : "Upload image or PDF"}
              </Button>
            ))}
          </div>

          {mode === "url" && (
            <div style={{ marginBottom: "var(--spacing-4)" }}>
              <Input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          )}
          {mode === "text" && (
            <div style={{ marginBottom: "var(--spacing-4)" }}>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste recipe text..."
                rows={8}
              />
            </div>
          )}
          {mode === "file" && (
            <div className="input-wrap">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-[var(--text-secondary)] file:mr-4 file:rounded-[var(--radius-sm)] file:border-0 file:bg-[var(--accent)] file:px-4 file:py-2 file:text-[var(--text-inverse)] file:font-medium"
              />
              <p className="input-helper">JPG, PNG, WebP, HEIC, or PDF</p>
            </div>
          )}

          <div className="flex flex-wrap gap-[var(--spacing-3)]">
            <Button
              onClick={handleParse}
              disabled={parseMutation.isPending || (mode === "url" && !url.trim()) || (mode === "text" && !text.trim()) || (mode === "file" && !file)}
            >
              {parseMutation.isPending ? "Analyzing…" : "Import recipe"}
            </Button>
          </div>

          {parseMutation.isError && (
            <p className="input-helper text-red-400" role="alert" style={{ marginTop: "var(--spacing-4)" }}>{(parseMutation.error as Error).message}</p>
          )}
        </Card>

        {isFailedImport && preview?.errorMessage && (
          <Card className="card border-red-500/30 bg-red-500/10" style={{ marginBottom: "var(--spacing-6)", padding: "var(--spacing-6)" }}>
            <h2 className="section-title text-red-400" style={{ marginBottom: "var(--spacing-2)" }}>Import failed</h2>
            <p className="text-[var(--text-body)] text-[var(--text-secondary)]" style={{ marginBottom: "var(--spacing-4)" }}>
              {preview.errorMessage}
            </p>
            <p className="text-[var(--text-body-sm)] text-[var(--text-tertiary)]" style={{ marginBottom: "var(--spacing-4)" }}>
              You can try pasting the recipe text directly, or use a different source or screenshot.
            </p>
            <Button variant="secondary" onClick={() => setPreview(null)}>
              Try again
            </Button>
          </Card>
        )}

        {showPreviewCard && (
          <Card style={{ marginBottom: "var(--spacing-6)" }}>
            <h2 className="section-title">Preview</h2>

            {preview.parseStatus === "partial" && preview.errorMessage && (
              <div className="card border-amber-500/30 bg-amber-500/10" style={{ padding: "var(--spacing-4)", marginBottom: "var(--spacing-6)" }} role="alert">
                <p className="text-[var(--text-body-sm)] text-amber-400">{preview.errorMessage}</p>
              </div>
            )}

            {preview.duplicateRecipeId && !duplicateAction && (
              <div className="card border-amber-500/30 bg-amber-500/10" style={{ padding: "var(--spacing-4)", marginBottom: "var(--spacing-6)" }}>
                <p className="font-medium text-amber-400">
                  A recipe with a similar title already exists: “{preview.duplicateRecipeTitle}”
                </p>
                <div className="flex flex-wrap gap-[var(--spacing-3)]">
                  <Button size="sm" variant="secondary" onClick={() => setDuplicateAction("overwrite")} className="!bg-amber-500/20 !text-amber-400 !border-amber-500/30">
                    Overwrite existing
                  </Button>
                  <Button size="sm" onClick={() => setDuplicateAction("copy")}>
                    Create copy
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setDuplicateAction("cancel")}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {preview.warnings && (
              <div className="card" style={{ padding: "var(--spacing-4)", marginBottom: "var(--spacing-6)" }}>
                <h3 className="input-label" style={{ marginBottom: "var(--spacing-2)" }}>Suggestions</h3>
                {preview.warnings.suggested?.map((s, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 py-1">
                    <span className="text-[var(--text-body-sm)] text-[var(--text-secondary)]">
                      {preview.recipe.ingredients[s.ingredientIndex]?.name}: {s.suggestion}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => applySuggestion(s.ingredientIndex, s.suggestion)} className="!p-0 !min-h-0 text-[var(--accent)]">
                      Apply
                    </Button>
                  </div>
                ))}
                {preview.warnings.missingSteps && (
                  <p className="input-helper text-amber-400">Instructions could not be extracted; you may add them after saving.</p>
                )}
              </div>
            )}

            <div className="input-wrap">
              <label className="input-label">Title</label>
              <p className="font-semibold text-[var(--text-body)]">{preview.recipe.title}</p>
            </div>
            {preview.recipe.description && (
              <div className="input-wrap">
                <label className="input-label">Description</label>
                <p className="text-[var(--text-body)] text-[var(--text-secondary)]">{preview.recipe.description}</p>
              </div>
            )}

            <div className="input-wrap">
              <label className="input-label">Ingredients</label>
              <ul className="list-inside list-disc text-[var(--text-body)] text-[var(--text-secondary)]" style={{ marginTop: "var(--spacing-2)" }}>
                {preview.recipe.ingredients.map((ing, i) => (
                  <li key={i}>
                    {ing.name} – {ing.quantity} {ing.unit ?? ""}
                    {ing.preparation ? ` (${ing.preparation})` : ""}
                  </li>
                ))}
              </ul>
            </div>

            {preview.recipe.instructions?.length > 0 && (
              <div style={{ marginBottom: "var(--spacing-6)" }}>
                <label className="input-label" style={{ display: "block", marginBottom: "var(--spacing-2)" }}>Instructions</label>
                <ol className="list-inside list-decimal text-[var(--text-body)] text-[var(--text-secondary)]" style={{ marginTop: "var(--spacing-2)" }}>
                  {preview.recipe.instructions.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>
            )}

            <div className="flex flex-wrap gap-[var(--spacing-3)]">
              <Button
                onClick={handleSave}
                disabled={
                  saveMutation.isPending ||
                  overwriteMutation.isPending ||
                  (!!preview.duplicateRecipeId && duplicateAction === "cancel")
                }
              >
                {saveMutation.isPending || overwriteMutation.isPending ? "Saving…" : "Save to library"}
              </Button>
              <Button variant="secondary" onClick={() => setPreview(null)}>
                Start over
              </Button>
            </div>
          </Card>
        )}
      </PageContainer>
    </AppLayout>
  );
}
