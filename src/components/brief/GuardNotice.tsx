import type { GuardVerdict } from "@/contract";

export type GuardState = { phase: "idle" } | { phase: "checking" } | { phase: "done"; verdict: GuardVerdict } | { phase: "error"; message: string };

/** Live taste-only guard result under the brief. Blocked shows the refusal and a taste-based version to use. */
export function GuardNotice({ state, onUseSuggestion }: { state: GuardState; onUseSuggestion: (s: string) => void }) {
  const status = state.phase === "done" ? state.verdict.status : state.phase;
  return (
    <div data-testid="guard-verdict" data-status={status} aria-live="polite" className="min-h-[2.5rem] text-[0.85rem]">
      {state.phase === "idle" ? <span className="text-muted">The live guard checks the brief as you type.</span> : null}
      {state.phase === "checking" ? <span className="text-muted">Checking…</span> : null}
      {state.phase === "error" ? <span className="text-warn">Guard unavailable ({state.message}). It runs again when you start the plan.</span> : null}
      {state.phase === "done" && state.verdict.status === "pass" ? <span className="text-picked-ink">Taste only. Good to go.</span> : null}
      {state.phase === "done" && state.verdict.status !== "pass" ? (
        <div className={`flex flex-col gap-1 rounded border p-2.5 ${state.verdict.status === "blocked" ? "border-guard bg-guard-soft" : "border-warn bg-warn-soft"}`}>
          <strong data-testid="guard-headline">
            {state.verdict.status === "blocked" ? "Wallspace doesn't target by identity." : "Reworded to describe tastes."}
          </strong>
          {state.verdict.reasons.map((r) => (
            <span key={r} data-testid="guard-reason">
              {r}
            </span>
          ))}
          {state.verdict.suggestion ? (
            <span className="flex flex-wrap items-center gap-2">
              Try instead: <em data-testid="guard-suggestion">{state.verdict.suggestion}</em>
              <button type="button" data-testid="guard-use-suggestion" onClick={() => onUseSuggestion(state.verdict.suggestion ?? "")} className="rounded border border-ink px-2 py-0.5 text-[0.8rem]">
                Use this
              </button>
            </span>
          ) : null}
          <span className="text-[0.72rem] text-muted">Live guard: our code applying the NeMo Guardrails policy. NeMo Guardrails re-checks every line at sign-off.</span>
        </div>
      ) : null}
    </div>
  );
}
