import type { Brief, Plan } from "@/contract";
import { Pill, SampleStamp } from "@/components/ui/Pill";
import { flightRange, usd } from "@/components/ui/format";
import { brandTitle } from "./plan-derive";

const statusPill: Record<Plan["status"], { tone: "picked" | "heat" | "info" | "guard"; text: string }> = {
  running: { tone: "heat", text: "running" },
  ready: { tone: "picked", text: "ready for sign-off" },
  "awaiting-nemo": { tone: "info", text: "signed off · NeMo check queued" },
  "nemo-checked": { tone: "picked", text: "NeMo checked" },
  failed: { tone: "guard", text: "run failed" },
};

export function PlanStatusPill({ status }: { status: Plan["status"] }) {
  const st = statusPill[status];
  return (
    <span data-testid="plan-status" data-status={status}>
      <Pill tone={st.tone}>{st.text}</Pill>
    </span>
  );
}

export function PlanHeader({ plan, brief }: { plan: Plan; brief: Brief }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="eyebrow">{plan.sample ? "Sample plan (pre-computed)" : "Plan"}</span>
        <PlanStatusPill status={plan.status} />
        {plan.lastRescanAt ? (
          <span data-testid="plan-last-rescan" className="text-[0.72rem] text-muted">
            re-scanned {new Date(plan.lastRescanAt).toUTCString().slice(5, 22)} UTC
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <h1 data-testid="plan-brand" className="text-2xl">
          {brandTitle(brief.brandName)}
        </h1>
        {brief.brandSample ? <SampleStamp>sample brand</SampleStamp> : null}
      </div>
      <div className="flex flex-wrap gap-1" data-testid="plan-loves">
        <span className="text-[0.8rem] text-muted">Fans of</span>
        {brief.loves.map((l) => (
          <Pill key={l} tone="heat">
            {l}
          </Pill>
        ))}
      </div>
      <p data-testid="plan-brief-line" className="text-[0.8rem] text-ink-2">
        Atlanta · {usd(brief.budgetUsd)} · {brief.flightWeeks}-week flight {flightRange(brief.flightStart, brief.flightWeeks)}
      </p>
    </div>
  );
}
