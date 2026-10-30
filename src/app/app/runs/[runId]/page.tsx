import { Suspense } from "react";
import { RunTrace } from "@/components/run/RunTrace";

export default function RunPage({ params }: PageProps<"/app/runs/[runId]">) {
  return (
    <Suspense fallback={<div data-testid="run-loading" className="p-6">Loading run…</div>}>
      {params.then(({ runId }) => (
        <RunTrace runId={decodeURIComponent(runId)} />
      ))}
    </Suspense>
  );
}
