import type { GuardVerdict } from "@/contract";
import { Pill } from "@/components/ui/Pill";

const tone = { pass: "picked", blocked: "guard", rewritten: "warn" } as const;

/** Verdict of the live guard or the NeMo Guardrails job on one line of copy. */
export function GuardChip({ verdict, testId }: { verdict: GuardVerdict; testId: string }) {
  const who = verdict.engine === "nemo-guardrails" ? "NeMo" : "live guard";
  return (
    <span data-testid={testId} data-status={verdict.status} data-engine={verdict.engine} title={verdict.reasons.join(" ") || undefined}>
      <Pill tone={tone[verdict.status]}>
        {who}: {verdict.status}
      </Pill>
    </span>
  );
}

export function NemoChip({ verdict, testId }: { verdict: GuardVerdict | null; testId: string }) {
  if (verdict) return <GuardChip verdict={verdict} testId={testId} />;
  return (
    <span data-testid={testId} data-status="pending">
      <Pill title="Checked when the NeMo Guardrails job runs after sign-off">NeMo: not yet checked</Pill>
    </span>
  );
}
