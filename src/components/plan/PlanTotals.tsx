import type { Plan, Run } from "@/contract";
import { cents, usd } from "@/components/ui/format";
import { toolCalls } from "./plan-derive";

export function PlanTotals({ plan, run }: { plan: Plan; run: Run | null }) {
  const cells: [string, string, string][] = [
    ["tool calls", run ? String(toolCalls(run)) : "…", "totals-tool-calls"],
    ["cost of this plan", run ? cents(run.costUsd) : "…", "totals-cost"],
    ["faces scored", String(plan.scoredCount), "totals-scored"],
    ["dropped", String(plan.droppedCount), "totals-dropped"],
  ];
  return (
    <div className="flex flex-col gap-1 border-t border-rule pt-3">
      <p data-testid="totals-headline" className="text-xl font-bold tnum">
        {plan.picks.length} faces · {usd(plan.spendUsd)}
      </p>
      <dl className="grid grid-cols-2 gap-x-4 text-[0.78rem] sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
        {cells.map(([k, v, id]) => (
          <div key={id}>
            <dt className="text-muted">{k}</dt>
            <dd data-testid={id} className="tnum">
              {v}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
