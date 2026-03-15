"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer, Card, Button, Input } from "@/components/ui";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

type PantryItem = {
  id: string;
  ingredientName: string;
  normalizedIngredientName: string;
  quantity: string;
  unit: string | null;
  expirationDate: string | null;
  lastUpdated: string;
};

async function fetchPantry() {
  const r = await fetch("/api/pantry");
  if (!r.ok) throw new Error("Failed to fetch");
  return r.json();
}

async function createPantryItem(data: {
  ingredientName: string;
  quantity: string;
  unit?: string;
  expirationDate?: string;
}) {
  const r = await fetch("/api/pantry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error((await r.json()).error ?? "Failed to add");
  return r.json();
}

async function updatePantryItem(
  id: string,
  data: { ingredientName?: string; quantity?: string; unit?: string; expirationDate?: string | null }
) {
  const r = await fetch(`/api/pantry/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error((await r.json()).error ?? "Failed to update");
  return r.json();
}

async function deletePantryItem(id: string) {
  const r = await fetch(`/api/pantry/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error("Failed to delete");
}

async function deletePantryItemsBulk(ids: string[]) {
  const r = await fetch("/api/pantry", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!r.ok) throw new Error((await r.json()).error ?? "Failed to delete");
  return r.json() as Promise<{ deleted: number }>;
}

async function deleteAllPantryItems() {
  const r = await fetch("/api/pantry/all", { method: "DELETE" });
  if (!r.ok) throw new Error((await r.json()).error ?? "Failed to delete all");
  return r.json() as Promise<{ deleted: number }>;
}

function formatExpiration(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { dateStyle: "short" });
}

function isExpiringSoon(dateStr: string | null, withinDays = 3): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= withinDays;
}

type ConfirmState = null | { type: "bulk"; count: number } | { type: "deleteAll"; count: number };

export default function PantryPage() {
  const t = useTranslations("pantry");
  const tCommon = useTranslations("common");
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [form, setForm] = useState({
    ingredientName: "",
    quantity: "1",
    unit: "",
    expirationDate: "",
  });
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["pantry"],
    queryFn: fetchPantry,
  });

  const createMutation = useMutation({
    mutationFn: createPantryItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pantry"] });
      setAddOpen(false);
      setForm({ ingredientName: "", quantity: "1", unit: "", expirationDate: "" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updatePantryItem>[1] }) =>
      updatePantryItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pantry"] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deletePantryItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pantry"] }),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: deletePantryItemsBulk,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pantry"] });
      setSelectedIds(new Set());
      setConfirmState(null);
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: deleteAllPantryItems,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pantry"] });
      setSelectedIds(new Set());
      setConfirmState(null);
    },
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const items = items as PantryItem[];
    if (selectedIds.size === items.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(items.map((i) => i.id)));
  };

  const openEdit = (item: PantryItem) => {
    setEditingId(item.id);
    setForm({
      ingredientName: item.ingredientName,
      quantity: item.quantity,
      unit: item.unit ?? "",
      expirationDate: item.expirationDate ? item.expirationDate.slice(0, 10) : "",
    });
  };

  return (
    <AppLayout>
      <PageContainer>
        <header className="page-header">
          <h1 className="page-title">{t("title")}</h1>
          <p className="page-subtitle">{t("subtitle")}</p>
        </header>

        <div className="flex flex-wrap items-center gap-[var(--spacing-3)]" style={{ marginBottom: "var(--spacing-6)" }}>
          <Button onClick={() => setAddOpen(true)}>{t("addItem")}</Button>
          {items.length > 0 && (
            <Button
              variant="secondary"
              className="!text-red-400 !border-red-500/40"
              onClick={() => setConfirmState({ type: "deleteAll", count: (items as PantryItem[]).length })}
            >
              {t("deleteAll")}
            </Button>
          )}
        </div>

        {selectedIds.size > 0 && (
          <div
            className="card flex flex-wrap items-center justify-between gap-[var(--spacing-4)]"
            style={{ marginBottom: "var(--spacing-4)", padding: "var(--spacing-4)" }}
          >
            <span className="text-[var(--text-body-sm)] text-[var(--text-secondary)]">
              {t("selectedCount", { count: selectedIds.size })}
            </span>
            <div className="flex flex-wrap gap-[var(--spacing-2)]">
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setConfirmState({ type: "bulk", count: selectedIds.size })}
                disabled={bulkDeleteMutation.isPending}
              >
                {bulkDeleteMutation.isPending ? tCommon("loading") : t("deleteSelected")}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setSelectedIds(new Set())}>
                {t("clearSelection")}
              </Button>
            </div>
          </div>
        )}

        {(addOpen || editingId) && (
          <Card style={{ marginBottom: "var(--spacing-8)" }}>
            <h2 className="section-title">{editingId ? t("editItem") : t("addItem")}</h2>
            <div className="grid gap-[var(--spacing-4)] sm:grid-cols-2">
              <Input label={t("ingredientName")} value={form.ingredientName} onChange={(e) => setForm((f) => ({ ...f, ingredientName: e.target.value }))} placeholder="e.g. Eggs, Olive oil" />
              <Input label={t("quantity")} value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} placeholder="6, 500, 1" />
              <Input label={t("unit")} value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} placeholder="g, ml, L, kg" />
              <Input label={t("expirationDate")} type="date" value={form.expirationDate} onChange={(e) => setForm((f) => ({ ...f, expirationDate: e.target.value }))} />
            </div>
            <div className="flex flex-wrap gap-[var(--spacing-3)]" style={{ marginTop: "var(--spacing-4)" }}>
              <Button
                onClick={() => {
                  if (editingId) updateMutation.mutate({ id: editingId, data: { ingredientName: form.ingredientName, quantity: form.quantity, unit: form.unit || undefined, expirationDate: form.expirationDate || null } });
                  else createMutation.mutate({ ingredientName: form.ingredientName, quantity: form.quantity, unit: form.unit || undefined, expirationDate: form.expirationDate || undefined });
                }}
                disabled={!form.ingredientName.trim() || createMutation.isPending || updateMutation.isPending}
              >
                {tCommon("save")}
              </Button>
              <Button variant="secondary" onClick={() => { setAddOpen(false); setEditingId(null); setForm({ ingredientName: "", quantity: "1", unit: "", expirationDate: "" }); }}>
                {tCommon("cancel")}
              </Button>
            </div>
          </Card>
        )}

        {isLoading ? (
          <p className="text-[var(--text-secondary)]">{tCommon("loading")}</p>
        ) : items.length === 0 ? (
          <Card style={{ padding: "var(--spacing-8)" }}>
            <p className="text-[var(--text-secondary)]">{t("noItems")}</p>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-[var(--spacing-3)]" style={{ marginBottom: "var(--spacing-3)" }}>
              <label className="flex items-center gap-2 cursor-pointer text-[var(--text-body-sm)] text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={selectedIds.size === (items as PantryItem[]).length && (items as PantryItem[]).length > 0}
                  onChange={selectAll}
                  className="rounded border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--accent)] focus:ring-[var(--accent)]"
                  style={{ width: "var(--spacing-4)", height: "var(--spacing-4)" }}
                />
                {t("selectAll")}
              </label>
            </div>
            <ul className="grid gap-[var(--spacing-3)] sm:grid-cols-2 lg:grid-cols-3" style={{ marginBottom: "var(--spacing-8)" }}>
              {(items as PantryItem[]).map((item) => (
                <li
                  key={item.id}
                  className="card flex items-center justify-between gap-[var(--spacing-3)]"
                  style={{
                    padding: "var(--spacing-4)",
                    borderColor: selectedIds.has(item.id) ? "var(--accent)" : undefined,
                    boxShadow: selectedIds.has(item.id) ? "0 0 0 2px var(--accent-muted)" : undefined,
                  }}
                >
                  <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      className="rounded border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--accent)] focus:ring-[var(--accent)] flex-shrink-0"
                      style={{ width: "var(--spacing-4)", height: "var(--spacing-4)" }}
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--text-body)]" style={{ marginBottom: "var(--spacing-1)" }}>{item.ingredientName}</p>
                      <p className="text-[var(--text-body-sm)] text-[var(--text-secondary)]">
                        {item.quantity} {item.unit ?? ""}
                        {item.expirationDate && (
                          <span className={isExpiringSoon(item.expirationDate) ? "text-amber-400" : ""}>
                            {" · "}{formatExpiration(item.expirationDate)}
                            {isExpiringSoon(item.expirationDate) && ` (${t("expiresSoon")})`}
                          </span>
                        )}
                      </p>
                    </div>
                  </label>
                  <div className="flex gap-[var(--spacing-2)] flex-shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(item)}>{t("editItem")}</Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (confirm(t("confirmDeleteOne"))) deleteMutation.mutate(item.id);
                      }}
                    >
                      {t("deleteItem")}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {confirmState && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.7)" }}
            onClick={() => !bulkDeleteMutation.isPending && !deleteAllMutation.isPending && setConfirmState(null)}
          >
            <div
              className="card max-w-md w-full"
              style={{ padding: "var(--spacing-6)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="section-title" style={{ marginBottom: "var(--spacing-2)" }}>
                {confirmState.type === "deleteAll" ? t("confirmDeleteAllTitle") : t("confirmBulkDeleteTitle")}
              </h2>
              <p className="text-[var(--text-body)] text-[var(--text-secondary)]" style={{ marginBottom: "var(--spacing-6)" }}>
                {confirmState.type === "deleteAll"
                  ? t("confirmDeleteAllMessage", { count: confirmState.count })
                  : t("confirmBulkDeleteMessage", { count: confirmState.count })}
              </p>
              <div className="flex flex-wrap gap-[var(--spacing-3)]">
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (confirmState.type === "deleteAll") {
                      deleteAllMutation.mutate();
                    } else {
                      bulkDeleteMutation.mutate(Array.from(selectedIds));
                    }
                  }}
                  disabled={bulkDeleteMutation.isPending || deleteAllMutation.isPending}
                >
                  {bulkDeleteMutation.isPending || deleteAllMutation.isPending ? tCommon("loading") : t("confirmDelete")}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setConfirmState(null)}
                  disabled={bulkDeleteMutation.isPending || deleteAllMutation.isPending}
                >
                  {tCommon("cancel")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </PageContainer>
    </AppLayout>
  );
}
