"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/States";
import { useAsync } from "@/components/ui/useAsync";
import { api, type PlanData } from "@/lib/api-client";
import { brandTitle } from "@/components/plan/plan-derive";
import { BlockCard } from "./BlockCard";
import { blockFor, defaultPair } from "./compare-derive";

/** Same audience, two blocks: affinity, block tastes and the different line each face got. */
export function CompareView({ planId }: { planId?: string }) {
  const state = useAsync<PlanData>(async () => api.plan(planId ?? (await api.samplePlanId())), planId ?? "sample");
  if (state.status === "loading") return <div data-testid="compare-loading" className="skeleton m-4 h-96" />;
  if (state.status === "error")
    return (
      <div className="p-6" data-testid="compare-error">
        <ErrorState title="Compare not loaded" message={state.error.message} action={<Button data-testid="compare-retry" onClick={state.retry}>Try again</Button>} />
      </div>
    );
  return <CompareLoaded data={state.data} />;
}

function CompareLoaded({ data }: { data: PlanData }) {
  const initial = defaultPair(data);
  const [ids, setIds] = useState<[string, string] | null>(initial);
  if (!ids) return <div className="p-6"><ErrorState title="Nothing to compare" message="This plan has no picks yet." /></div>;
  const a = blockFor(data, ids[0]);
  const b = blockFor(data, ids[1]);
  if (!a || !b) return null;
  const faces = [...data.faces].sort((x, y) => x.neighbourhood.localeCompare(y.neighbourhood));
  const hi = a.affinity >= b.affinity ? a : b;
  const lo = hi === a ? b : a;
  const ratio = lo.affinity > 0 ? hi.affinity / lo.affinity : null;
  return (
    <div data-testid="compare-view" className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl">Same audience, two blocks</h1>
        <p className="text-ink-2">
          {brandTitle(data.brief.brandName)}: fans of {data.brief.loves.join(", ")}.
        </p>
      </header>
      <p data-testid="compare-ratio" className="rounded border border-rule bg-panel p-3 text-[0.95rem]">
        {ratio === null ? (
          "No audience measured around one of these faces."
        ) : (
          <>
            The audience is <strong className="tnum">{ratio.toFixed(1)}×</strong> as concentrated around {hi.face.neighbourhood} ({hi.face.id}) as around {lo.face.neighbourhood} ({lo.face.id}).
            {a.pick && b.pick ? " The lines differ because the blocks over-index on different things." : ""}
          </>
        )}
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <BlockCard side="a" block={a} faces={faces} planId={data.plan.id} onPick={(id) => setIds([id, ids[1]])} />
        <BlockCard side="b" block={b} faces={faces} planId={data.plan.id} onPick={(id) => setIds([ids[0], id])} />
      </div>
      <Button data-testid="compare-swap" className="self-start" onClick={() => setIds([ids[1], ids[0]])}>
        Swap
      </Button>
    </div>
  );
}
