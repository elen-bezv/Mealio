"use client";

import { useState, useEffect, Suspense } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer, Card, Button, LoadingFallback } from "@/components/ui";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ShoppingCompletedModal, type MissingItemsReport } from "@/components/shopping/ShoppingCompletedModal";
import { STORE_CONFIG } from "@/agent/stores";

async function fetchLists() {
  const r = await fetch("/api/shopping-lists");
  if (!r.ok) throw new Error("Failed to fetch");
  return r.json();
}

async function toggleItem(listId: string, itemId: string, checked: boolean) {
  const r = await fetch(`/api/shopping-lists/${listId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemId, checked }),
  });
  if (!r.ok) throw new Error("Failed to update");
  return r.json();
}

async function setItemSubstitute(listId: string, itemId: string, alternativeSearchQuery: string) {
  const r = await fetch(`/api/shopping-lists/${listId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemId, alternativeSearchQuery }),
  });
  if (!r.ok) throw new Error("Failed to update");
  return r.json();
}

async function runAgent(storeConnectionId: string, shoppingListId: string) {
  const r = await fetch("/api/agent/shop", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storeConnectionId, shoppingListId }),
  });
  if (!r.ok) {
    const e = await r.json();
    throw new Error(e.error ?? "Agent failed");
  }
  return r.json();
}

async function retryMissingItems(storeConnectionId: string, shoppingListId: string) {
  const r = await fetch("/api/agent/retry-missing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storeConnectionId, shoppingListId }),
  });
  if (!r.ok) {
    const e = await r.json();
    throw new Error(e.error ?? "Retry failed");
  }
  return r.json();
}

async function addListToPantry(shoppingListId: string) {
  const r = await fetch("/api/pantry/from-shopping-list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shoppingListId }),
  });
  if (!r.ok) throw new Error((await r.json()).error ?? "Failed to add to pantry");
  return r.json();
}

function ShoppingContent() {
  const searchParams = useSearchParams();
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [shopStoreId, setShopStoreId] = useState<string | null>(null);
  const [reportModal, setReportModal] = useState<{
    report: MissingItemsReport;
    storeConnectionId: string;
    shoppingListId: string;
  } | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const t = useTranslations("shopping");

  const { data: lists } = useQuery({ queryKey: ["shopping-lists"], queryFn: fetchLists });
  const { data: connections } = useQuery({
    queryKey: ["store-connections"],
    queryFn: async () => {
      const r = await fetch("/api/store-connections");
      if (!r.ok) throw new Error("Failed to fetch");
      return r.json();
    },
  });

  useEffect(() => {
    const listId = searchParams.get("list");
    if (listId) setSelectedListId(listId);
    else if (Array.isArray(lists) && lists.length) setSelectedListId(lists[0].id);
  }, [searchParams, lists]);

  const toggleMutation = useMutation({
    mutationFn: ({ listId, itemId, checked }: { listId: string; itemId: string; checked: boolean }) =>
      toggleItem(listId, itemId, checked),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shopping-lists"] }),
  });

  const substituteMutation = useMutation({
    mutationFn: ({ listId, itemId, alternativeSearchQuery }: { listId: string; itemId: string; alternativeSearchQuery: string }) =>
      setItemSubstitute(listId, itemId, alternativeSearchQuery),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shopping-lists"] }),
  });

  const agentMutation = useMutation({
    mutationFn: ({ storeId, listId }: { storeId: string; listId: string }) =>
      runAgent(storeId, listId),
    onSuccess: (data) => {
      setAgentError(null);
      if (data.report) {
        setReportModal({
          report: data.report,
          storeConnectionId: shopStoreId!,
          shoppingListId: selectedListId!,
        });
      }
    },
    onError: (err: Error) => setAgentError(err.message),
  });

  const retryMutation = useMutation({
    mutationFn: ({ storeId, listId }: { storeId: string; listId: string }) =>
      retryMissingItems(storeId, listId),
    onSuccess: (data) => {
      if (data.report) {
        setReportModal((prev) =>
          prev
            ? {
                ...prev,
                report: data.report,
                storeConnectionId: prev.storeConnectionId,
              }
            : null
        );
        queryClient.invalidateQueries({ queryKey: ["shopping-lists"] });
      }
    },
    onError: (err: Error) => setAgentError(err.message),
  });

  const addToPantryMutation = useMutation({
    mutationFn: addListToPantry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pantry"] });
    },
  });

  const currentList = Array.isArray(lists) ? lists.find((l: { id: string }) => l.id === selectedListId) : null;
  const otherStores = Array.isArray(connections) ? connections : [];

  const handleOpenStoreSearch = (storeKey: string, ingredientName: string) => {
    const config = STORE_CONFIG[storeKey];
    if (!config?.baseUrl) return;
    const searchUrl = `${config.baseUrl.replace(/\/$/, "")}${config.searchPath ?? "/search"}?q=${encodeURIComponent(ingredientName)}`;
    window.open(searchUrl, "_blank");
  };

  return (
    <AppLayout>
      <PageContainer>
        <header className="page-header">
          <h1 className="page-title">Shopping List</h1>
          <p className="page-subtitle">
            Merged ingredients. Choose a store to have the agent add items to cart.
          </p>
        </header>

        <div className="flex flex-wrap items-center gap-[var(--spacing-4)]" style={{ marginBottom: "var(--spacing-6)" }}>
          <select
            value={selectedListId ?? ""}
            onChange={(e) => setSelectedListId(e.target.value || null)}
            className="select"
            style={{ width: "auto", minWidth: "180px" }}
          >
            <option value="">Select list</option>
            {Array.isArray(lists) &&
              lists.map((l: { id: string; name: string }) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
          </select>
          <span className="text-[var(--text-secondary)]" style={{ fontSize: "var(--text-body-sm)" }}>Send to store:</span>
          <select
            value={shopStoreId ?? ""}
            onChange={(e) => setShopStoreId(e.target.value || null)}
            className="select"
            style={{ width: "auto", minWidth: "180px" }}
          >
            <option value="">Select store</option>
            {otherStores.map((c: { id: string; displayName: string; storeKey: string }) => (
              <option key={c.id} value={c.id}>{c.displayName ?? c.storeKey}</option>
            ))}
          </select>
          <Button
            onClick={() => agentMutation.mutate({ storeId: shopStoreId!, listId: selectedListId! })}
            disabled={agentMutation.isPending || !selectedListId || !shopStoreId}
          >
            {agentMutation.isPending ? t("addingToCart") : t("shopForIngredients")}
          </Button>
          <Button
            variant="secondary"
            onClick={() => selectedListId && addToPantryMutation.mutate(selectedListId)}
            disabled={addToPantryMutation.isPending || !selectedListId}
          >
            {t("addToPantry")}
          </Button>
        </div>

        {agentError && (
          <div className="card mb-6 border-red-500/30 bg-red-500/10 text-red-400" style={{ padding: "var(--spacing-4)" }}>
            {agentError}
          </div>
        )}

        {reportModal && (
          <ShoppingCompletedModal
            report={reportModal.report}
            storeConnectionId={reportModal.storeConnectionId}
            shoppingListId={reportModal.shoppingListId}
            otherStores={otherStores}
            onClose={() => setReportModal(null)}
            onRetry={(storeConnectionId) => {
              retryMutation.mutate({
                storeId: storeConnectionId,
                listId: reportModal.shoppingListId,
              });
            }}
            onSubstitute={(itemId, _ingredientName, query) => {
              substituteMutation.mutate({
                listId: reportModal.shoppingListId,
                itemId,
                alternativeSearchQuery: query,
              });
            }}
            onOpenStoreSearch={handleOpenStoreSearch}
          />
        )}

        {currentList && (
          <Card>
            <h2 className="section-title" style={{ marginBottom: "var(--spacing-4)" }}>{currentList.name}</h2>
            <ul className="space-y-2" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {currentList.items?.map((item: {
                id: string;
                checked: boolean;
                quantity: string;
                unit: string | null;
                ingredient: { name: string };
                status?: string;
                matchedProductName?: string | null;
              }) => (
                <li key={item.id} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() =>
                      toggleMutation.mutate({
                        listId: currentList.id,
                        itemId: item.id,
                        checked: !item.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-0"
                  />
                  <span className={item.checked ? "text-[var(--text-tertiary)] line-through" : "text-[var(--text-primary)]"} style={{ fontSize: "var(--text-body)" }}>
                    {item.ingredient.name} – {(item as { mergedQuantity?: string | null }).mergedQuantity ?? `${item.quantity} ${item.unit ?? ""}`.trim()}
                  </span>
                  {item.status && item.status !== "PENDING" && item.status !== "FOUND" && (
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        item.status === "NOT_FOUND"
                          ? "bg-red-500/20 text-red-400"
                          : "bg-amber-500/20 text-amber-400"
                      }`}
                    >
                      {item.status === "NOT_FOUND" ? "Not found" : "Uncertain"}
                      {item.matchedProductName ? ` · ${item.matchedProductName}` : ""}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {Array.isArray(lists) && lists.length === 0 && (
          <p className="text-[var(--text-secondary)]">
            No shopping lists. Create one from a recipe or meal plan.
          </p>
        )}
      </PageContainer>
    </AppLayout>
  );
}

export default function ShoppingPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ShoppingContent />
    </Suspense>
  );
}
