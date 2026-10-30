"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Connection } from "@/contract";
import { Button } from "@/components/ui/Button";
import { api, type ConnectionsData, type Sent } from "@/lib/api-client";

const verb: Record<Connection["category"], string> = {
  mail: "Email the plan",
  chat: "Post for approval",
  crm: "Create a deal record",
  docs: "Export to a sheet or doc",
  calendar: "Put the flight dates on the calendar",
  ooh: "Send to the media owner",
};

/** Send sheet: pick a connected tool and send the plan there. Connecting tools happens on the Connections page. */
export function SendSheet({ planId, open, onClose }: { planId: string; open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [conns, setConns] = useState<ConnectionsData | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<Sent | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      setSent(null);
      setErr(null);
      api.connections().then(
        (c) => {
          setConns(c);
          setLoadErr(null);
          setProvider((p) => p ?? c.connections.find((x) => x.status === "connected")?.provider ?? null);
        },
        (e: unknown) => setLoadErr(e instanceof Error ? e.message : "Could not load your connections."),
      );
    }
    if (!open && d.open) d.close();
  }, [open]);

  const chosen = conns?.connections.find((c) => c.provider === provider) ?? null;

  async function send() {
    if (!provider) return;
    setSending(true);
    setErr(null);
    try {
      setSent(await api.sendPlan(planId, { provider, to: to.trim() || null, note: note.trim() || null }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Sending failed.");
    } finally {
      setSending(false);
    }
  }

  return (
    <dialog
      data-testid="send-sheet"
      ref={ref}
      onClose={onClose}
      aria-labelledby="send-title"
      className="m-auto w-[min(520px,calc(100vw-24px))] rounded-[6px] border border-rule bg-panel p-0 text-ink shadow-[var(--shadow)] backdrop:bg-black/50 max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none"
    >
      <div className="flex items-center justify-between border-b border-rule px-5 py-3">
        <h2 id="send-title" className="text-[1.4rem]">
          Send plan
        </h2>
        <Button data-testid="send-close" variant="quiet" size="sm" onClick={onClose} aria-label="Close">
          ✕
        </Button>
      </div>
      <div className="flex flex-col gap-4 px-5 py-4">
        {loadErr ? <p data-testid="send-load-error" className="text-[0.85rem] text-guard">{loadErr}</p> : null}
        {!conns && !loadErr ? <div className="skeleton h-32" /> : null}
        {conns ? (
          <fieldset className="flex flex-col gap-1.5">
            <legend className="eyebrow mb-1.5">Where to</legend>
            {conns.connections.map((c) => {
              const ok = c.status === "connected";
              return (
                <label
                  key={c.provider}
                  data-testid={`send-provider-${c.provider}`}
                  data-status={c.status}
                  className={`flex items-center gap-3 rounded-[var(--radius)] border px-3 py-2 ${provider === c.provider ? "border-picked bg-picked-soft/50" : "border-rule"} ${ok ? "cursor-pointer" : "opacity-70"}`}
                >
                  <input data-testid={`send-provider-radio-${c.provider}`} type="radio" name="provider" value={c.provider} disabled={!ok} checked={provider === c.provider} onChange={() => setProvider(c.provider)} className="accent-[var(--picked)]" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.88rem] font-semibold">{c.name}</span>
                    <span className="block truncate font-mono text-[0.66rem] text-muted">
                      {ok ? `${verb[c.category]} · ${c.account ?? "connected"}` : c.status === "error" ? "connection error" : "not connected"}
                    </span>
                  </span>
                  {!ok ? (
                    <Link href="/app/connections" data-testid={`send-connect-${c.provider}`} className="font-mono text-[0.66rem] text-info hover:underline">
                      connect ↗
                    </Link>
                  ) : null}
                </label>
              );
            })}
          </fieldset>
        ) : null}
        {chosen && (chosen.category === "mail" || chosen.category === "chat") ? (
          <label className="flex flex-col gap-1">
            <span className="eyebrow">{chosen.category === "mail" ? "To" : "Channel"}</span>
            <input
              data-testid="send-to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder={chosen.category === "mail" ? "client@brand.com" : "#media-approvals"}
              className="h-10 rounded-[var(--radius)] border border-rule bg-ground px-3 text-[0.9rem] outline-none focus:border-ink-2"
            />
          </label>
        ) : null}
        <label className="flex flex-col gap-1">
          <span className="eyebrow">Note (optional)</span>
          <textarea data-testid="send-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={2000} className="rounded-[var(--radius)] border border-rule bg-ground px-3 py-2 text-[0.9rem] outline-none focus:border-ink-2" />
        </label>
        {sent ? (
          <p data-testid="send-result" role="status" className="rounded-[var(--radius)] bg-picked-soft px-3 py-2 text-[0.85rem] text-picked-ink">
            Sent to {chosen?.name ?? sent.provider}
            {sent.url ? (
              <>
                {" · "}
                <a href={sent.url} target="_blank" rel="noreferrer" className="underline">
                  open it
                </a>
              </>
            ) : sent.externalId ? ` · ref ${sent.externalId}` : ""}
          </p>
        ) : null}
        {err ? <p data-testid="send-error" className="text-[0.85rem] text-guard">{err}</p> : null}
      </div>
      <div className="flex justify-end gap-2 border-t border-rule px-5 py-3">
        <Button data-testid="send-cancel" variant="ghost" onClick={onClose}>
          {sent ? "Done" : "Cancel"}
        </Button>
        <Button data-testid="send-submit" variant="picked" onClick={send} disabled={!provider || sending}>
          {sending ? "Sending…" : sent ? "Send again" : "Send"}
        </Button>
      </div>
    </dialog>
  );
}
