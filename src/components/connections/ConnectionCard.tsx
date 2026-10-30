"use client";

import { useState } from "react";
import type { Connection } from "@/contract";
import { connect, disconnect, realtimeLabel } from "./connections-api";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Kuala_Lumpur", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + " MYT";

const statusText: Record<Connection["status"], string> = { connected: "Connected", "not-connected": "Not connected", error: "Needs attention" };

/** One customer tool: status, account label, realtime mechanism, last sync, event log, connect / disconnect. */
export function ConnectionCard({ c, onChanged }: { c: Connection; onChanged: (next: Connection | null) => void }) {
  const [busy, setBusy] = useState<"connect" | "disconnect" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onConnect() {
    setBusy("connect");
    setError(null);
    try {
      const r = await connect(c.provider);
      if (r.kind === "redirect") {
        window.location.assign(r.url);
        return;
      }
      onChanged({ ...c, status: "connected", account: "sample account (mock mode)", lastSyncAt: new Date().toISOString() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the connection.");
    }
    setBusy(null);
  }

  async function onDisconnect() {
    setBusy("disconnect");
    setError(null);
    try {
      await disconnect(c.provider);
      onChanged(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not disconnect.");
    }
    setBusy(null);
  }

  const connected = c.status === "connected";
  return (
    <li data-testid="connection-card" data-provider={c.provider} data-status={c.status} className="rounded-[var(--radius)] border border-rule bg-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl">{c.name}</h3>
          <p className="mt-1 text-sm">
            <span data-testid="conn-status" data-status={c.status} className={c.status === "error" ? "font-semibold text-guard" : connected ? "font-semibold text-ok" : "text-muted"}>
              {statusText[c.status]}
            </span>
            {c.account && <> · <span data-testid="conn-account">{c.account}</span></>}
          </p>
        </div>
        {c.category === "ooh" ? (
          <span data-testid="conn-builtin" className="text-sm text-muted">Built in: exported from each plan</span>
        ) : connected || c.status === "error" ? (
          <span className="flex gap-2">
            {c.status === "error" && (
              <button data-testid="conn-reconnect" type="button" onClick={onConnect} disabled={busy !== null} className="rounded-[var(--radius)] bg-ink px-3 py-1.5 text-sm font-semibold text-ground disabled:opacity-50">
                {busy === "connect" ? "Opening…" : "Reconnect"}
              </button>
            )}
            <button data-testid="conn-disconnect" type="button" onClick={onDisconnect} disabled={busy !== null} className="rounded-[var(--radius)] border border-rule px-3 py-1.5 text-sm font-semibold disabled:opacity-50">
              {busy === "disconnect" ? "Disconnecting…" : "Disconnect"}
            </button>
          </span>
        ) : (
          <button data-testid="conn-connect" type="button" onClick={onConnect} disabled={busy !== null} className="rounded-[var(--radius)] bg-ink px-3 py-1.5 text-sm font-semibold text-ground disabled:opacity-50">
            {busy === "connect" ? "Opening…" : `Connect ${c.name}`}
          </button>
        )}
      </div>
      <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[8rem_1fr]">
        <dt className="text-muted">Read-back</dt>
        <dd data-testid="conn-realtime" data-realtime={c.realtime}>{realtimeLabel[c.realtime] ?? c.realtime}</dd>
        <dt className="text-muted">Last sync</dt>
        <dd data-testid="conn-last-sync">{c.lastSyncAt ? when(c.lastSyncAt) : "never"}</dd>
      </dl>
      {error && <p data-testid="conn-error" role="alert" className="mt-2 text-sm text-guard">{error}</p>}
      <details className="mt-3" open={c.events.length > 0 && c.events.length <= 3}>
        <summary className="cursor-pointer text-sm font-semibold">Event log ({c.events.length})</summary>
        {c.events.length === 0 ? (
          <p data-testid="conn-events-empty" className="mt-2 text-sm text-muted">Nothing sent or received yet.</p>
        ) : (
          <ol data-testid="conn-events" className="mt-2 divide-y divide-rule text-sm">
            {c.events.map((e, i) => (
              <li key={`${e.at}-${i}`} data-testid="conn-event" data-direction={e.direction} className="grid grid-cols-[3rem_1fr] gap-2 py-1.5">
                <span className="font-mono text-xs uppercase">{e.direction === "out" ? "→ out" : "← in"}</span>
                <span>
                  {e.summary}
                  <span className="block font-mono text-xs text-muted">{when(e.at)}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </details>
    </li>
  );
}
