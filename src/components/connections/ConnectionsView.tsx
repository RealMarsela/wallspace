"use client";

import { useState, useSyncExternalStore } from "react";
import type { Connection } from "@/contract";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { useAsync } from "@/components/ui/useAsync";
import { api } from "@/lib/api-client";
import { isMock } from "@/components/site/request";
import { ConnectionCard } from "./ConnectionCard";
import { categoryLabel, categoryOrder } from "./connections-api";

/** The customer-tools page, driven entirely by GET /api/connections. */
export function ConnectionsView() {
  const res = useAsync(() => api.connections(), "connections");
  const [local, setLocal] = useState<Record<string, Connection>>({});
  const search = useSyncExternalStore(noSubscribe, () => window.location.search, () => "");
  const notice = noticeFrom(search);

  if (res.status === "loading") return <div data-testid="connections-loading" className="space-y-3"><Skeleton className="h-28" /><Skeleton className="h-28" /></div>;
  if (res.status === "error")
    return <ErrorState title="Connections did not load" message={res.error.message} action={<button data-testid="connections-retry" className="underline" onClick={res.retry}>Try again</button>} />;

  const list = res.data.connections.map((c) => local[c.provider] ?? c);
  if (list.length === 0) return <EmptyState title="No tools available" message="No connectors are configured on this deployment yet." />;

  const cats = [...categoryOrder, ...new Set(list.map((c) => c.category).filter((k) => !categoryOrder.includes(k)))];
  const update = (c: Connection) => (next: Connection | null) => {
    if (next) setLocal((l) => ({ ...l, [c.provider]: next }));
    else {
      setLocal((l) => ({ ...l, [c.provider]: { ...c, status: "not-connected", account: null } }));
      if (!isMock()) {
        setLocal((l) => {
          const rest = { ...l };
          delete rest[c.provider];
          return rest;
        });
        res.retry();
      }
    }
  };

  return (
    <div data-testid="connections">
      {notice && (
        <p data-testid="connections-notice" data-tone={notice.tone} role="status" className={`mb-4 rounded-[var(--radius)] border p-3 text-sm ${notice.tone === "ok" ? "border-ok text-ok" : "border-warn text-warn"}`}>
          {notice.text}
        </p>
      )}
      <p className="mb-4 flex flex-wrap items-center gap-3 text-sm text-muted">
        <span data-testid="connections-count">
          {list.filter((c) => c.status === "connected").length} of {list.length} connected
        </span>
        <button data-testid="connections-refresh" type="button" onClick={() => { setLocal({}); res.retry(); }} className="underline">
          Refresh
        </button>
        {isMock() && <span data-testid="connections-mock">Mock mode: sample accounts, nothing leaves the browser.</span>}
      </p>
      {cats.map((cat) => {
        const items = list.filter((c) => c.category === cat);
        if (items.length === 0) return null;
        return (
          <section key={cat} data-testid="connections-group" data-category={cat} aria-labelledby={`cat-${cat}`} className="mb-8">
            <h2 id={`cat-${cat}`} className="text-2xl">{categoryLabel[cat] ?? cat}</h2>
            <ul className="mt-3 grid gap-3 md:grid-cols-2">
              {items.map((c) => <ConnectionCard key={c.provider} c={c} onChanged={update(c)} />)}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

const noSubscribe = () => () => {};

// Composio's callback lands here with ?connected=<provider> or ?pending=<provider>.
function noticeFrom(search: string): { tone: "ok" | "warn"; text: string } | null {
  const q = new URLSearchParams(search);
  const ok = q.get("connected");
  const pending = q.get("pending");
  if (ok) return { tone: "ok", text: `${ok} is connected.` };
  if (pending) return { tone: "warn", text: `${pending} has not confirmed yet. Refresh in a moment, or connect again.` };
  return null;
}
