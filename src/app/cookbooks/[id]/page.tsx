"use client";

import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer, Card, Button, Input } from "@/components/ui";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import type { StructuredRecipe } from "@/types";

async function fetchCookbook(id: string) {
  const r = await fetch(`/api/cookbooks/${id}`);
  if (!r.ok) throw new Error("Failed to fetch");
  return r.json();
}

async function importRecipes(cookbookId: string, recipeIndices?: number[]) {
  const r = await fetch(`/api/cookbooks/${cookbookId}/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(recipeIndices != null ? { recipeIndices } : {}),
  });
  if (!r.ok) throw new Error((await r.json()).error ?? "Import failed");
  return r.json();
}

async function renameCookbook(id: string, name: string) {
  const r = await fetch(`/api/cookbooks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!r.ok) throw new Error("Rename failed");
  return r.json();
}

async function deleteCookbook(id: string) {
  const r = await fetch(`/api/cookbooks/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error("Delete failed");
}

export default function CookbookDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [renameValue, setRenameValue] = useState("");
  const [editingName, setEditingName] = useState(false);

  const { data: cookbook, isLoading } = useQuery({
    queryKey: ["cookbook", id],
    queryFn: () => fetchCookbook(id),
    enabled: !!id,
  });

  const importMutation = useMutation({
    mutationFn: (indices?: number[]) => importRecipes(id, indices),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cookbook", id] });
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
    },
  });

  const renameMutation = useMutation({
    mutationFn: (name: string) => renameCookbook(id, name),
    onSuccess: () => {
      setEditingName(false);
      queryClient.invalidateQueries({ queryKey: ["cookbook", id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteCookbook(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cookbooks"] });
      router.push("/cookbooks");
    },
  });

  const parsedRecipes = (cookbook?.parsedRecipes ?? []) as StructuredRecipe[];
  const filtered = useMemo(() => {
    const list = parsedRecipes.map((r, i) => ({ ...r, _index: i }));
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (r) =>
        r.title?.toLowerCase().includes(q) ||
        r.ingredients?.some((i) => i.name?.toLowerCase().includes(q)) ||
        r.description?.toLowerCase().includes(q)
    );
  }, [parsedRecipes, search]);

  const toggleSelect = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const selectAll = () => {
    const indices = filtered.map((r) => (r as StructuredRecipe & { _index: number })._index);
    if (indices.every((i) => selected.has(i))) setSelected(new Set());
    else setSelected(new Set(indices));
  };

  const handleImportSelected = () => {
    const indices = selected.size > 0 ? Array.from(selected).sort((a, b) => a - b) : undefined;
    importMutation.mutate(indices);
  };

  if (!id || (cookbook === undefined && !isLoading)) {
    return (
      <AppLayout>
        <PageContainer>
          <p className="text-[var(--text-secondary)]">Cookbook not found.</p>
        </PageContainer>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageContainer>
        <div className="flex flex-wrap items-center justify-between gap-4" style={{ marginBottom: "var(--spacing-6)" }}>
          <div className="flex flex-wrap items-center gap-3">
            {editingName ? (
              <>
                <Input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="min-w-[200px]"
                />
                <Button size="sm" onClick={() => renameMutation.mutate(renameValue)} disabled={renameMutation.isPending || !renameValue.trim()}>
                  Save
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setEditingName(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <h1 className="page-title" style={{ marginBottom: 0 }}>{cookbook?.name ?? "Cookbook"}</h1>
                <Button variant="ghost" size="sm" onClick={() => { setRenameValue(cookbook?.name ?? ""); setEditingName(true); }}>
                  Rename
                </Button>
              </>
            )}
          </div>
          <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
            Delete cookbook
          </Button>
        </div>

        {cookbook?.recipes?.length > 0 && (
          <Card style={{ marginBottom: "var(--spacing-6)" }}>
            <h2 className="section-title">Imported recipes ({cookbook.recipes.length})</h2>
            <p className="input-helper">These are in your Recipe Library and linked to this cookbook.</p>
            <div className="flex flex-wrap gap-2" style={{ marginTop: "var(--spacing-2)" }}>
              {cookbook.recipes.map((r: { id: string; title: string }) => (
                <Button key={r.id} size="sm" variant="secondary" onClick={() => router.push(`/library`)}>
                  {r.title}
                </Button>
              ))}
            </div>
          </Card>
        )}

        <div className="flex flex-wrap items-center gap-4" style={{ marginBottom: "var(--spacing-4)" }}>
          <Input
            type="search"
            placeholder="Search recipes (e.g. chicken, vegetarian, dessert)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <span className="text-[var(--text-body-sm)] text-[var(--text-tertiary)]">
            Detected: {parsedRecipes.length} recipes
          </span>
        </div>

        <div className="flex flex-wrap gap-3" style={{ marginBottom: "var(--spacing-4)" }}>
          <Button size="sm" variant="secondary" onClick={selectAll}>
            {selected.size === filtered.length ? "Deselect all" : "Select all"}
          </Button>
          <Button
            size="sm"
            onClick={() => handleImportSelected()}
            disabled={importMutation.isPending || parsedRecipes.length === 0}
          >
            {selected.size > 0 ? `Import selected (${selected.size})` : "Import all"}
          </Button>
        </div>

        {isLoading ? (
          <p className="text-[var(--text-secondary)]">Loading…</p>
        ) : (
          <ul className="space-y-2" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {filtered.map((recipe) => {
              const globalIndex = (recipe as StructuredRecipe & { _index: number })._index;
              const isSelected = selected.has(globalIndex);
              return (
                <li key={globalIndex}>
                  <Card style={{ padding: "var(--spacing-4)", display: "flex", alignItems: "flex-start", gap: "var(--spacing-3)" }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(globalIndex)}
                      className="mt-1 h-4 w-4 rounded border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[var(--text-body)]">{recipe.title}</span>
                        {recipe.needsReview && (
                          <span className="rounded px-2 py-0.5 text-xs bg-amber-500/20 text-amber-400">Needs review</span>
                        )}
                      </div>
                      {recipe.ingredients?.length > 0 && (
                        <p className="input-helper mt-1">{recipe.ingredients.length} ingredients</p>
                      )}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}

        {filtered.length === 0 && !isLoading && (
          <p className="text-[var(--text-secondary)]">No recipes match your search.</p>
        )}
      </PageContainer>
    </AppLayout>
  );
}
