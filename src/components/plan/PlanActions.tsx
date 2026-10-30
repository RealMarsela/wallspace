"use client";
import { useState } from "react";
import type { Plan } from "@/contract";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api-client";
import { SendSheet } from "./SendSheet";

type Note = { tone: "ok" | "err"; text: string } | null;

export function PlanActions({ plan, onPlan }: { plan: Plan; onPlan: (p: Plan) => void }) {
  const [busy, setBusy] = useState<"sign" | "csv" | null>(null);
  const [note, setNote] = useState<Note>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const signed = plan.status === "awaiting-nemo" || plan.status === "nemo-checked";

  async function signOff() {
    setBusy("sign");
    setNote(null);
    try {
      const res = await api.signOff(plan.id);
      onPlan(res.plan);
      setNote({ tone: "ok", text: `Signed off. ${res.queuedLines} lines passed the live guard and are queued for the NeMo Guardrails job, which we start on demand.` });
    } catch (e) {
      setNote({ tone: "err", text: e instanceof Error ? e.message : "Sign-off failed." });
    } finally {
      setBusy(null);
    }
  }

  async function exportCsv() {
    setBusy("csv");
    setNote(null);
    try {
      const blob = await api.exportCsv(plan.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wallspace-${plan.id}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      setNote({ tone: "err", text: e instanceof Error ? e.message : "Export failed." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
        <Button data-testid="action-sign-off" variant="picked" size="lg" onClick={signOff} disabled={busy !== null || signed} className="col-span-2 sm:col-span-1 lg:col-span-2 xl:col-span-1">
          {signed ? "Signed off ✓" : busy === "sign" ? "Signing off…" : "Sign off for print"}
        </Button>
        <Button data-testid="action-send" variant="primary" size="lg" onClick={() => setSendOpen(true)}>
          Send plan
        </Button>
        <Button data-testid="action-export-csv" variant="ghost" size="lg" onClick={exportCsv} disabled={busy !== null}>
          {busy === "csv" ? "Exporting…" : "Export CSV"}
        </Button>
      </div>
      <p data-testid="action-status" data-tone={note?.tone ?? ""} role="status" aria-live="polite" className={`min-h-[1em] text-[0.78rem] ${note?.tone === "err" ? "text-guard" : "text-ink-2"}`}>
        {note?.text}
      </p>
      <SendSheet planId={plan.id} open={sendOpen} onClose={() => setSendOpen(false)} />
    </div>
  );
}
