"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";

export interface ItemResult {
  itemId: string;
  ingredientName: string;
  status: "FOUND" | "NOT_FOUND" | "UNCERTAIN";
  matchedProductName?: string;
  matchScore?: number;
  storeName: string;
  selectionReason?: string;
}

export interface MissingItemsReport {
  added: ItemResult[];
  notFound: ItemResult[];
  uncertain: ItemResult[];
  storeName: string;
  storeKey: string;
}

interface ShoppingCompletedModalProps {
  report: MissingItemsReport;
  storeConnectionId: string;
  shoppingListId: string;
  otherStores: { id: string; displayName: string; storeKey: string }[];
  onClose: () => void;
  onRetry: (storeConnectionId: string) => void;
  onSubstitute: (itemId: string, ingredientName: string, currentQuery: string) => void;
  onOpenStoreSearch?: (storeKey: string, ingredientName: string) => void;
}

export function ShoppingCompletedModal({
  report,
  storeConnectionId,
  shoppingListId,
  otherStores,
  onClose,
  onRetry,
  onSubstitute,
  onOpenStoreSearch,
}: ShoppingCompletedModalProps) {
  const [retryStoreId, setRetryStoreId] = useState(storeConnectionId);
  const [editingItem, setEditingItem] = useState<{ itemId: string; name: string; query: string } | null>(null);

  const hasMissing = report.notFound.length > 0 || report.uncertain.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-2xl bg-[var(--bg-secondary)] shadow-xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[var(--bg-tertiary)] p-6">
          <h2 className="text-xl font-semibold">Shopping Completed</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {report.storeName} · {report.added.length} added to cart
          </p>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-6 space-y-6">
          {report.added.length > 0 && (
            <section>
              <h3 className="section-title mb-2 text-[var(--accent)]" style={{ fontSize: "var(--text-body-sm)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Items added to cart
              </h3>
              <ul className="space-y-2 text-[var(--text-secondary)]">
                {report.added.map((r) => (
                  <li key={r.itemId}>
                    <span>{r.ingredientName}</span>
                    {r.matchedProductName && (
                      <span className="block text-[var(--text-body-sm)] text-[var(--text-tertiary)]">
                        → {r.matchedProductName}
                        {r.selectionReason && ` · ${r.selectionReason}`}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {report.notFound.length > 0 && (
            <section>
              <h3 className="section-title mb-2 text-red-400" style={{ fontSize: "var(--text-body-sm)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Items not found in store
              </h3>
              <ul className="space-y-2 text-[var(--text-secondary)]">
                {report.notFound.map((r) => (
                  <li key={r.itemId} className="flex flex-wrap items-center gap-2">
                    <span>{r.ingredientName}</span>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setEditingItem({ itemId: r.itemId, name: r.ingredientName, query: "" })} className="!p-0 !min-h-0 text-[var(--accent)]">
                        Substitute
                      </Button>
                      {onOpenStoreSearch && (
                        <Button variant="ghost" size="sm" onClick={() => onOpenStoreSearch(report.storeKey, r.ingredientName)} className="!p-0 !min-h-0 text-[var(--accent)]">
                          Search on store
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {report.uncertain.length > 0 && (
            <section>
              <h3 className="section-title mb-2 text-amber-400" style={{ fontSize: "var(--text-body-sm)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Items needing confirmation
              </h3>
              <ul className="space-y-2 text-[var(--text-secondary)]">
                {report.uncertain.map((r) => (
                  <li key={r.itemId} className="flex flex-wrap items-center gap-2">
                    <span>{r.ingredientName}</span>
                    {r.matchedProductName && (
                      <span className="text-[var(--text-body-sm)] text-[var(--text-tertiary)]">
                        (similar: {r.matchedProductName})
                      </span>
                    )}
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setEditingItem({ itemId: r.itemId, name: r.ingredientName, query: r.matchedProductName ?? "" })} className="!p-0 !min-h-0 text-[var(--accent)]">
                        Substitute
                      </Button>
                      {onOpenStoreSearch && (
                        <Button variant="ghost" size="sm" onClick={() => onOpenStoreSearch(report.storeKey, r.ingredientName)} className="!p-0 !min-h-0 text-[var(--accent)]">
                          Search on store
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {editingItem && (
            <Card style={{ padding: "var(--spacing-4)", background: "var(--bg-surface-hover)" }}>
              <p className="input-helper mb-2">Substitute for: {editingItem.name}</p>
              <input
                type="text"
                value={editingItem.query}
                onChange={(e) => setEditingItem((p) => p ? { ...p, query: e.target.value } : null)}
                placeholder="e.g. dried basil"
                className="input w-full"
                style={{ marginBottom: "var(--spacing-3)" }}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => { onSubstitute(editingItem.itemId, editingItem.name, editingItem.query); setEditingItem(null); }}>
                  Save & use for retry
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setEditingItem(null)}>
                  Cancel
                </Button>
              </div>
            </Card>
          )}

          {hasMissing && (
            <section className="border-t border-[var(--border-subtle)] pt-4" style={{ paddingTop: "var(--spacing-4)" }}>
              <h3 className="section-title" style={{ marginBottom: "var(--spacing-2)" }}>Retry missing items</h3>
              <p className="input-helper" style={{ marginBottom: "var(--spacing-3)" }}>
                Try alternative product names or another store.
              </p>
              {otherStores.length > 0 && (
                <select
                  value={retryStoreId}
                  onChange={(e) => setRetryStoreId(e.target.value)}
                  className="select w-full"
                  style={{ marginBottom: "var(--spacing-3)" }}
                >
                  <option value={storeConnectionId}>{report.storeName} (current)</option>
                  {otherStores.filter((s) => s.id !== storeConnectionId).map((s) => (
                    <option key={s.id} value={s.id}>{s.displayName ?? s.storeKey}</option>
                  ))}
                </select>
              )}
              <Button className="w-full" onClick={() => onRetry(retryStoreId)}>
                Retry missing items
              </Button>
            </section>
          )}
        </div>

        <div className="border-t border-[var(--border-subtle)]" style={{ padding: "var(--spacing-4)" }}>
          <Button variant="secondary" className="w-full" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
