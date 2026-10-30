import Link from "next/link";
import type { Evidence } from "@/contract";
import { runHref } from "@/lib/routes";

const kindLabel: Record<Evidence["kind"], string> = {
  "qloo-heatmap": "Qloo heatmap",
  "qloo-tag": "Qloo tags",
  "qloo-brand": "Qloo brands",
  "qloo-demographics": "Qloo audience",
  "photo-read": "Site photo (Super VL)",
  "tavily-event": "Tavily events",
};

/** Every number behind this pick; each opens the run step that produced it. */
export function EvidenceList({ evidence, runId }: { evidence: Evidence[]; runId: string }) {
  return (
    <section data-testid="evidence-list" className="flex flex-col gap-1.5">
      <h2 className="text-base">Evidence</h2>
      {evidence.length === 0 ? <p className="text-[0.85rem] text-muted">No evidence recorded.</p> : null}
      <ul className="flex flex-col divide-y divide-rule-2 rounded border border-rule bg-panel">
        {evidence.map((e, i) => (
          <li key={i} data-testid={`evidence-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-2.5 py-1.5 text-[0.85rem]">
            <span className="w-full shrink-0 text-[0.75rem] text-muted sm:w-40">{kindLabel[e.kind]}</span>
            <span className="min-w-0 flex-1">{e.label}</span>
            {e.value !== null ? <span className="tnum">{e.value.toFixed(2)}</span> : null}
            <Link href={`${runHref(runId)}#${encodeURIComponent(e.sourceRef)}`} data-testid={`evidence-source-${i}`} className="text-[0.75rem] text-info underline">
              source {e.sourceRef}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
