"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer, Card, Button, Input } from "@/components/ui";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

async function fetchCookbooks() {
  const r = await fetch("/api/cookbooks");
  if (!r.ok) throw new Error("Failed to fetch");
  return r.json();
}

export default function CookbooksPage() {
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const { data: cookbooks, isLoading } = useQuery({
    queryKey: ["cookbooks"],
    queryFn: fetchCookbooks,
  });

  const handleUpload = async () => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      if (name.trim()) form.set("name", name.trim());
      const r = await fetch("/api/cookbooks/upload", { method: "POST", body: form });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error ?? "Upload failed");
      }
      const data = await r.json();
      router.push(`/cookbooks/${data.cookbookId}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <AppLayout>
      <PageContainer>
        <header className="page-header">
          <h1 className="page-title">Cookbooks</h1>
          <p className="page-subtitle">
            Upload PDF cookbooks and import recipes into your library. Max 200 MB per file.
          </p>
        </header>

        <Card style={{ marginBottom: "var(--spacing-8)" }}>
          <h2 className="section-title">Upload cookbook</h2>
          <div className="input-wrap" style={{ marginBottom: "var(--spacing-4)" }}>
            <Input
              placeholder="Cookbook name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="max-w-md"
            />
          </div>
          <div className="input-wrap" style={{ marginBottom: "var(--spacing-4)" }}>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-[var(--text-secondary)] file:mr-4 file:rounded-[var(--radius-md)] file:border-0 file:bg-[var(--accent)] file:px-4 file:py-2 file:text-[var(--text-inverse)] file:font-medium"
            />
          </div>
          {error && <p className="input-helper text-red-400" style={{ marginBottom: "var(--spacing-3)" }}>{error}</p>}
          <Button onClick={handleUpload} disabled={uploading || !file}>
            {uploading ? "Processing PDF…" : "Upload and detect recipes"}
          </Button>
        </Card>

        <div className="section">
          <h2 className="section-title">Your cookbooks</h2>
          {isLoading ? (
            <p className="text-[var(--text-secondary)]">Loading…</p>
          ) : cookbooks?.length === 0 ? (
            <p className="text-[var(--text-secondary)]">No cookbooks yet. Upload a PDF to get started.</p>
          ) : (
            <div className="grid gap-[var(--spacing-4)] sm:grid-cols-2 lg:grid-cols-3">
              {cookbooks?.map((c: { id: string; name: string; status: string; _count?: { recipes: number } }) => (
                <Card
                  key={c.id}
                  interactive
                  onClick={() => router.push(`/cookbooks/${c.id}`)}
                  style={{ textAlign: "left" }}
                >
                  <h3 className="font-semibold text-[var(--text-body)]">{c.name}</h3>
                  <p className="input-helper mt-1">
                    {c.status === "ready" ? `${c._count?.recipes ?? 0} recipes imported` : c.status}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </div>
      </PageContainer>
    </AppLayout>
  );
}
