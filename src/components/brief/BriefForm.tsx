"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CreateBriefRequest } from "@/contract";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api-client";
import { GuardNotice } from "./GuardNotice";
import { LovesInput } from "./LovesInput";
import { guardProbe, presets } from "./presets";
import { useLiveGuard } from "./useLiveGuard";

const field = "h-10 rounded border border-rule bg-panel px-3 text-[0.9rem] outline-none focus:border-ink-2";

export function BriefForm() {
  const router = useRouter();
  const first = presets[0];
  const [brandName, setBrandName] = useState(first.brandName);
  const [loves, setLoves] = useState<string[]>(first.loves);
  const [audienceText, setAudienceText] = useState(first.audienceText);
  const [budget, setBudget] = useState("40000");
  const [flightStart, setFlightStart] = useState("2026-11-16");
  const [weeks, setWeeks] = useState("4");
  const [brandVoice, setBrandVoice] = useState(first.brandVoice);
  const [busy, setBusy] = useState<null | "brief" | "plan">(null);
  const [error, setError] = useState<string | null>(null);
  const guard = useLiveGuard([audienceText, ...loves].join(". "), loves);
  const blocked = guard.phase === "done" && guard.verdict.status === "blocked";

  function applyPreset(id: string) {
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    setBrandName(p.brandName);
    setLoves(p.loves);
    setAudienceText(p.audienceText);
    setBrandVoice(p.brandVoice);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const input = CreateBriefRequest.safeParse({
      brandName: brandName.trim(),
      audienceText: audienceText.trim(),
      loves,
      budgetUsd: Number(budget),
      flightStart,
      flightWeeks: Number(weeks),
      brandVoice: brandVoice.trim() || null,
    });
    if (!input.success) {
      setError(input.error.issues.map((i) => `${i.path.join(".") || "brief"}: ${i.message}`).join("; "));
      return;
    }
    try {
      setBusy("brief");
      const { brief, guard: verdict } = await api.createBrief(input.data);
      if (verdict.status === "blocked") {
        setError(`The guard blocked this brief: ${verdict.reasons.join(" ")}`);
        return;
      }
      setBusy("plan");
      const { runId } = await api.startPlan(brief.id);
      router.push(`/app/runs/${encodeURIComponent(runId)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the plan.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <form data-testid="brief-form" onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[0.8rem] text-muted">Start from</span>
        {presets.map((p) => (
          <Button key={p.id} size="sm" data-testid={`preset-${p.id}`} onClick={() => applyPreset(p.id)}>
            {p.label}
          </Button>
        ))}
        <Button size="sm" variant="quiet" data-testid="preset-guard-probe" onClick={() => setAudienceText(guardProbe)} title="See how the guard handles identity targeting">
          Test the guard: &ldquo;{guardProbe}&rdquo;
        </Button>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-[0.85rem] font-semibold">Brand</span>
        <input data-testid="brief-brand" value={brandName} onChange={(e) => setBrandName(e.target.value)} className={field} required />
      </label>
      <LovesInput value={loves} onChange={setLoves} />
      <label className="flex flex-col gap-1">
        <span className="text-[0.85rem] font-semibold">Audience, in your words</span>
        <textarea data-testid="brief-audience" value={audienceText} onChange={(e) => setAudienceText(e.target.value)} rows={3} maxLength={2000} className="rounded border border-rule bg-panel px-3 py-2 text-[0.9rem] outline-none focus:border-ink-2" />
      </label>
      <GuardNotice state={guard} onUseSuggestion={(s) => setAudienceText(s)} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-[0.85rem] font-semibold">Budget (USD)</span>
          <input data-testid="brief-budget" type="number" min={1000} step={500} inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[0.85rem] font-semibold">Flight starts</span>
          <input data-testid="brief-flight-start" type="date" value={flightStart} onChange={(e) => setFlightStart(e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[0.85rem] font-semibold">Weeks</span>
          <input data-testid="brief-weeks" type="number" min={1} max={52} value={weeks} onChange={(e) => setWeeks(e.target.value)} className={field} />
        </label>
      </div>
      <p className="text-[0.8rem] text-muted">City: Atlanta (the demo inventory).</p>
      <label className="flex flex-col gap-1">
        <span className="text-[0.85rem] font-semibold">Brand voice (optional)</span>
        <input data-testid="brief-voice" value={brandVoice} onChange={(e) => setBrandVoice(e.target.value)} className={field} />
      </label>
      {error ? (
        <p role="alert" data-testid="brief-error" className="text-[0.85rem] text-guard">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="picked" size="lg" data-testid="brief-submit" disabled={busy !== null || blocked}>
          {busy === "brief" ? "Saving brief…" : busy === "plan" ? "Starting the run…" : "Start the plan"}
        </Button>
        {blocked ? <span className="text-[0.8rem] text-guard">Rephrase as tastes to continue.</span> : null}
      </div>
    </form>
  );
}
