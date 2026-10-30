import type { Pick } from "@/contract";
import { GuardChip, NemoChip } from "./GuardChip";

/** The three lines written for this face, each with its guard verdicts. */
export function CopyVariants({ pick }: { pick: Pick }) {
  return (
    <section data-testid="copy-variants" className="flex flex-col gap-2">
      <h2 className="text-base">Lines written for this face</h2>
      <ol className="flex flex-col gap-2">
        {pick.copy.map((c, i) => {
          const chosen = i === pick.chosenCopy;
          return (
            <li key={i} data-testid={`copy-line-${i}`} data-chosen={chosen} className={`rounded border p-2.5 ${chosen ? "border-picked" : "border-rule"} bg-panel`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[0.72rem] text-muted">{String.fromCharCode(65 + i)}</span>
                <strong className="flex-1">{c.text}</strong>
                {chosen ? <span data-testid={`copy-chosen-${i}`} className="text-[0.72rem] font-semibold text-picked-ink">on the face</span> : null}
              </div>
              <p className="mt-1 text-[0.82rem] text-ink-2">{c.rationale}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <GuardChip verdict={c.guard} testId={`copy-guard-${i}`} />
                <NemoChip verdict={c.nemo} testId={`copy-nemo-${i}`} />
              </div>
              {c.guard.status !== "pass" && (c.guard.reasons.length || c.guard.suggestion) ? (
                <p data-testid={`copy-guard-detail-${i}`} className="mt-1 text-[0.78rem] text-ink-2">
                  {c.guard.reasons.join(" ")}
                  {c.guard.suggestion ? <> Suggested: &ldquo;{c.guard.suggestion}&rdquo;</> : null}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
