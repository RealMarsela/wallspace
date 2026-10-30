"use client";

import Link from "next/link";
import { useState } from "react";
import type { AudienceCard, Face } from "@/contract";
import { useAsync } from "@/components/ui/useAsync";
import { api } from "@/lib/api-client";
import { pitchSheet, sendPitch } from "./owner-api";

type SendState = { status: "idle" } | { status: "sending" } | { status: "sent"; detail: string } | { status: "error"; message: string };

/** Pitch-sheet actions: mail it through a connected mail tool, open it in the visitor's mail app, or download it. */
export function PitchSheet({ face, card, ownerName }: { face: Face; card: AudienceCard; ownerName: string }) {
  const conns = useAsync(() => api.connections(), "connections");
  const mail = (conns.data?.connections ?? []).filter((c) => c.category === "mail" && c.status === "connected");
  const [brand, setBrand] = useState(card.brands[0]?.name ?? "");
  const [to, setTo] = useState("");
  const [provider, setProvider] = useState("");
  const [state, setState] = useState<SendState>({ status: "idle" });

  const sheet = pitchSheet(face, card, ownerName);
  const subject = `${face.id} ${face.name}: the audience around this face over-indexes on ${brand || "your brand"}`;
  const via = provider || mail[0]?.provider || "";
  const validTo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to);

  function download() {
    const url = URL.createObjectURL(new Blob([sheet], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `wallspace-pitch-${face.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function send() {
    if (!via || !validTo) return;
    setState({ status: "sending" });
    try {
      const r = await sendPitch(face.id, { provider: via, to, brand, note: sheet });
      setState({ status: "sent", detail: `Sent via ${r.provider}${r.externalId ? ` (id ${r.externalId})` : ""}.` });
    } catch (e) {
      setState({ status: "error", message: e instanceof Error ? e.message : "Could not send." });
    }
  }

  return (
    <section data-testid="pitch-sheet" aria-labelledby="pitch-h" className="mt-8 border-t border-rule pt-6">
      <h2 id="pitch-h" className="text-2xl">Pitch sheet</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-semibold">Brand to pitch</span>
          <select data-testid="pitch-brand" value={brand} onChange={(e) => setBrand(e.target.value)} className="mt-1 w-full rounded-[var(--radius)] border border-rule bg-panel px-3 py-2">
            {card.brands.map((b) => <option key={b.qlooId} value={b.name}>{b.name}</option>)}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-semibold">Brand contact email</span>
          <input data-testid="pitch-to" type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="partnerships@brand.example" className="mt-1 w-full rounded-[var(--radius)] border border-rule bg-panel px-3 py-2" />
        </label>
        <label className="block text-sm">
          <span className="font-semibold">Send with</span>
          <select data-testid="pitch-provider" value={via} onChange={(e) => setProvider(e.target.value)} disabled={mail.length === 0} className="mt-1 w-full rounded-[var(--radius)] border border-rule bg-panel px-3 py-2">
            {mail.length === 0 && <option value="">No mail tool connected</option>}
            {mail.map((c) => <option key={c.provider} value={c.provider}>{c.name}{c.account ? ` · ${c.account}` : ""}</option>)}
          </select>
          {conns.status === "ready" && mail.length === 0 && (
            <span className="mt-1 block text-muted">
              Connect Gmail or Outlook on <Link data-testid="pitch-link-connections" className="underline" href="/app/connections">Connections</Link>.
            </span>
          )}
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button data-testid="pitch-send" type="button" onClick={send} disabled={!via || !validTo || state.status === "sending"} className="rounded-[var(--radius)] bg-ink px-4 py-2 font-semibold text-ground disabled:opacity-50">
          {state.status === "sending" ? "Sending…" : "Send pitch"}
        </button>
        <a data-testid="pitch-mailto" href={`mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(sheet)}`} className="rounded-[var(--radius)] border border-rule px-4 py-2 font-semibold">
          Open in my mail app
        </a>
        <button data-testid="pitch-download" type="button" onClick={download} className="rounded-[var(--radius)] border border-rule px-4 py-2 font-semibold">
          Download pitch sheet
        </button>
      </div>
      <p data-testid="pitch-status" data-state={state.status} role="status" className="mt-2 text-sm">
        {state.status === "sent" && <span className="text-ok">{state.detail}</span>}
        {state.status === "error" && <span className="text-guard">{state.message}</span>}
      </p>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-semibold">Preview the sheet</summary>
        <pre data-testid="pitch-preview" className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-[var(--radius)] border border-rule bg-panel p-3 font-mono text-xs">{sheet}</pre>
      </details>
    </section>
  );
}
