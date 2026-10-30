import Link from "next/link";
import type { Run } from "@/contract";
import { ModelChip } from "@/components/ui/ModelChip";
import { cents, ms } from "@/components/ui/format";
import { roleUsage } from "./plan-derive";
import { runHref } from "@/lib/routes";

/** Compact "which model did what" panel beside the map. */
export function RunPanel({ run, error }: { run: Run | null; error?: string | null }) {
  if (error) return <p data-testid="run-panel-error" className="text-[0.8rem] text-guard">Run not available: {error}</p>;
  if (!run) return <div className="skeleton h-32" data-testid="run-panel-loading" />;
  return (
    <section data-testid="run-panel" className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base">Which model did what</h2>
        <Link href={runHref(run.id)} data-testid="run-panel-open" className="text-[0.8rem] text-info underline">
          watch the run
        </Link>
      </div>
      <ul className="flex flex-col divide-y divide-rule-2 rounded border border-rule bg-panel">
        {roleUsage(run).map((u) => (
          <li key={u.role} data-testid={`run-panel-role-${u.role}`} className="grid grid-cols-[auto_1fr_auto] items-start gap-2 px-2 py-1.5">
            <ModelChip role={u.role} model={u.model} />
            <span className="min-w-0 text-[0.78rem] text-ink-2">
              {u.titles.join("; ")}
              {u.steps > u.titles.length ? <span className="text-muted"> · {u.steps} steps</span> : null}
            </span>
            <span className="text-right text-[0.72rem] tnum text-muted">
              {ms(u.ms)}
              <br />
              {u.costUsd > 0 ? cents(u.costUsd) : "–"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
