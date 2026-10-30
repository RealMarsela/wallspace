import type { RunStep } from "@/contract";
import { ModelChip } from "@/components/ui/ModelChip";
import { Pill } from "@/components/ui/Pill";
import { cents, ms, tokens } from "@/components/ui/format";

/** One agent step: which model, what it did, with which tool, how long, how many tokens, what it cost. */
export function StepRow({ step, index, highlighted }: { step: RunStep; index: number; highlighted: boolean }) {
  return (
    <li
      id={step.id}
      data-testid={`run-step-${step.id}`}
      data-role={step.role}
      data-status={step.status}
      data-cached={step.cached}
      className={`grid grid-cols-[28px_1fr] gap-2 border-b border-rule-2 px-2 py-2.5 sm:grid-cols-[28px_minmax(0,1fr)_200px] ${highlighted ? "bg-heat-soft" : ""}`}
    >
      <span className="pt-0.5 text-right text-[0.75rem] tnum text-muted">{index + 1}</span>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <ModelChip role={step.role} model={step.model} />
          <strong className="text-[0.9rem]">{step.title}</strong>
          {step.cached ? <span data-testid={`run-step-cached-${step.id}`}><Pill tone="info">cached</Pill></span> : null}
          {step.status !== "ok" ? <span data-testid={`run-step-status-${step.id}`}><Pill tone={step.status === "error" ? "guard" : "neutral"}>{step.status}</Pill></span> : null}
        </div>
        {step.tool ? <code className="text-[0.75rem] text-info">{step.tool}</code> : null}
        <p className="text-[0.85rem] text-ink-2">{step.summary}</p>
      </div>
      <dl className="col-start-2 grid grid-cols-3 gap-x-2 text-[0.72rem] tnum sm:col-start-3 sm:grid-cols-2">
        <dt className="text-muted">time</dt>
        <dd data-testid={`run-step-ms-${step.id}`}>{ms(step.ms)}</dd>
        <dt className="text-muted">tokens</dt>
        <dd>
          {step.tokensIn === null && step.tokensOut === null ? "–" : `${tokens(step.tokensIn)} in / ${tokens(step.tokensOut)} out`}
        </dd>
        <dt className="text-muted">cost</dt>
        <dd data-testid={`run-step-cost-${step.id}`}>{step.costUsd === null ? "–" : cents(step.costUsd)}</dd>
        <dt className="text-muted">request</dt>
        <dd className="truncate font-mono" title={step.requestId ?? undefined} data-testid={`run-step-request-${step.id}`}>
          {step.requestId ?? "–"}
        </dd>
      </dl>
    </li>
  );
}
