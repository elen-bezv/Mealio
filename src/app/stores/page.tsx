"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer, Card, Button } from "@/components/ui";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { STORE_CONFIG } from "@/agent/stores";

async function fetchConnections() {
  const r = await fetch("/api/store-connections");
  if (!r.ok) throw new Error("Failed to fetch");
  return r.json();
}

async function deleteConnection(id: string) {
  const r = await fetch(`/api/store-connections/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error("Failed to disconnect");
}

const STORE_KEYS = ["walmart", "instacart", "tesco", "shufersal", "tivtaam"] as const;
const STORE_OPTIONS = STORE_KEYS
  .filter((key) => key in STORE_CONFIG)
  .map((key) => ({ key, name: STORE_CONFIG[key].name, baseUrl: STORE_CONFIG[key].baseUrl }));

export default function StoresPage() {
  const queryClient = useQueryClient();

  const { data: connections } = useQuery({
    queryKey: ["store-connections"],
    queryFn: fetchConnections,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteConnection,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["store-connections"] }),
  });

  return (
    <AppLayout>
      <PageContainer>
        <header className="page-header">
          <h1 className="page-title">Store Connections</h1>
          <p className="page-subtitle">
            Connect grocery stores. Log in once; we store your session securely and the agent can add items to your cart.
          </p>
        </header>

        <Card style={{ marginBottom: "var(--spacing-8)" }}>
          <h2 className="section-title">How it works</h2>
          <ol className="list-inside list-decimal text-[var(--text-secondary)]" style={{ fontSize: "var(--text-body-sm)", lineHeight: "var(--leading-relaxed)" }}>
            <li className="mb-2">Click &quot;Connect store&quot; and choose a store.</li>
            <li className="mb-2">A browser window opens; log in on the store site.</li>
            <li className="mb-2">We save your session (cookies) encrypted. We never store your password.</li>
            <li>When you click &quot;Shop for ingredients&quot; on a list, the agent uses this session to add items to your cart.</li>
          </ol>
        </Card>

        <div className="section">
          <div className="grid gap-[var(--spacing-4)] sm:grid-cols-2" style={{ marginBottom: "var(--spacing-8)" }}>
            {STORE_OPTIONS.map((store) => (
              <Card key={store.key} style={{ padding: "var(--spacing-4)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--spacing-3)" }}>
                <span className="font-semibold text-[var(--text-body)]">{store.name}</span>
                {connections?.some((c: { storeKey: string }) => c.storeKey === store.key) ? (
                  <span className="text-[var(--text-body-sm)] text-[var(--accent)]">Connected</span>
                ) : (
                  <a href={store.baseUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">
                    Open site to log in
                  </a>
                )}
              </Card>
            ))}
          </div>

          <h2 className="section-title">Your connections</h2>
          {Array.isArray(connections) && connections.length > 0 ? (
            <ul className="space-y-3">
              {connections.map((c: { id: string; storeKey: string; displayName: string; lastUsedAt: string | null }) => (
                <li key={c.id} className="card flex flex-wrap items-center justify-between gap-3" style={{ padding: "var(--spacing-4)" }}>
                  <div>
                    <span className="font-semibold text-[var(--text-body)]">{c.displayName ?? c.storeKey}</span>
                    {c.lastUsedAt && (
                      <span className="ml-3 text-[var(--text-body-sm)] text-[var(--text-tertiary)]">
                        Last used {new Date(c.lastUsedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(c.id)} disabled={deleteMutation.isPending}>
                    Disconnect
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[var(--text-secondary)]" style={{ marginBottom: "var(--spacing-6)" }}>
              No stores connected. Log in on a store site; then use the &quot;Shop for ingredients&quot; flow to save your session after login.
            </p>
          )}

          <p className="input-helper" style={{ marginTop: "var(--spacing-6)" }}>
            Session data is encrypted with ENCRYPTION_KEY. To fully connect a store, run the agent once (e.g. from Shopping List) after logging in; the agent will capture and save your session.
          </p>
        </div>
      </PageContainer>
    </AppLayout>
  );
}
