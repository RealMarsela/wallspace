import type { Plan } from "@/contract";
import { pct, usd } from "@/components/ui/format";

const swatches = ["var(--h4)", "var(--h3)", "var(--h2)", "var(--h1)", "var(--picked)", "var(--picked-ink)", "var(--ink-2)", "var(--muted)"];

/** Budget by neighbourhood: one stacked bar plus a list. */
export function BudgetSplit({ plan }: { plan: Plan }) {
  const split = [...plan.split].sort((a, b) => b.usd - a.usd);
  return (
    <section data-testid="budget-split" className="flex flex-col gap-1.5">
      <h2 className="text-base">Budget split</h2>
      {split.length === 0 ? <p data-testid="budget-empty" className="text-[0.8rem] text-muted">No split recorded for this plan.</p> : null}
      <div className="flex h-3 overflow-hidden rounded-sm" role="img" aria-label={split.map((s) => `${s.neighbourhood} ${pct(s.share)}`).join(", ")}>
        {split.map((s, i) => (
          <i key={s.neighbourhood} className="block h-full" style={{ flex: s.usd, background: swatches[i % swatches.length] }} />
        ))}
      </div>
      <ul className="grid grid-cols-1 gap-x-4 text-[0.8rem] sm:grid-cols-2">
        {split.map((s, i) => (
          <li key={s.neighbourhood} data-testid="budget-row" className="flex items-center gap-2">
            <i aria-hidden className="block size-2.5 shrink-0" style={{ background: swatches[i % swatches.length] }} />
            <span className="min-w-0 flex-1 truncate">{s.neighbourhood}</span>
            <span className="tnum">{usd(s.usd)}</span>
            <span className="w-9 text-right tnum text-muted">{pct(s.share)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
