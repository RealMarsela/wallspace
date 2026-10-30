"use client";
import { useEffect, useMemo, useState } from "react";
import type { Plan, Run } from "@/contract";
import { PlanMap } from "@/components/map/PlanMap";
import { Button, LinkButton } from "@/components/ui/Button";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useAsync } from "@/components/ui/useAsync";
import { ApiFailure, api, type PlanData } from "@/lib/api-client";
import { runHref } from "@/lib/routes";
import { BudgetSplit } from "./BudgetSplit";
import { PicksList } from "./PicksList";
import { PlanActions } from "./PlanActions";
import { PlanHeader } from "./PlanHeader";
import { PlanTotals } from "./PlanTotals";
import { RunPanel } from "./RunPanel";
import { SelectedFace } from "./SelectedFace";
import { pickRows } from "./plan-derive";

/** The plan view: map with audience heat and picks, side panel with picks, totals, budget, run and actions.
 *  With no planId it shows the pre-computed sample plan (the /app landing view). */
export function PlanView({ planId }: { planId?: string }) {
  const state = useAsync<PlanData>(async () => api.plan(planId ?? (await api.samplePlanId())), planId ?? "sample");
  if (state.status === "loading") return <PlanSkeleton />;
  if (state.status === "error" && state.error instanceof ApiFailure && state.error.code === "empty")
    return (
      <div className="p-6" data-testid="plan-none">
        <EmptyState title="No plans yet" message="The sample plan is not loaded yet. Start a plan from a brief." action={<LinkButton href="/app/new" testId="plan-none-new" variant="picked">New brief</LinkButton>} />
      </div>
    );
  if (state.status === "error")
    return (
      <div className="p-6" data-testid="plan-error">
        <ErrorState
          title="Plan not loaded"
          message={state.error.message}
          action={
            <div className="flex gap-2">
              <Button data-testid="plan-retry" onClick={state.retry}>Try again</Button>
              <LinkButton href="/app/new" testId="plan-error-new">New brief</LinkButton>
            </div>
          }
        />
      </div>
    );
  return <PlanLoaded data={state.data} onReload={state.retry} />;
}

function PlanLoaded({ data, onReload }: { data: PlanData; onReload: () => void }) {
  const [plan, setPlan] = useState<Plan>(data.plan);
  const [run, setRun] = useState<Run | null>(null);
  const [runErr, setRunErr] = useState<string | null>(null);
  const rows = useMemo(() => pickRows({ ...data, plan }), [data, plan]);
  const [selected, setSelected] = useState<string | null>(rows[0]?.pick.faceId ?? null);
  const mapPicks = useMemo(() => data.plan.picks.map((p) => ({ faceId: p.faceId, rank: p.rank })), [data.plan.picks]);

  useEffect(() => {
    let live = true;
    api.run(data.plan.runId).then(
      (r) => live && setRun(r.run),
      (e: unknown) => live && setRunErr(e instanceof Error ? e.message : "unknown error"),
    );
    return () => {
      live = false;
    };
  }, [data.plan.runId]);

  const select = (id: string) => {
    setSelected(id);
    document.getElementById(`pick-${id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };
  const selectedRow = rows.find((r) => r.pick.faceId === selected) ?? null;

  if (rows.length === 0 && (plan.status === "running" || plan.status === "failed"))
    return (
      <div className="p-6" data-testid={plan.status === "running" ? "plan-running" : "plan-failed"}>
        <EmptyState
          title={plan.status === "running" ? "This plan is still being built" : "This plan run failed"}
          message={plan.status === "running" ? "The agent has not picked faces yet. Follow the run, or reload in a moment." : "The run stopped before it picked faces. The run trace shows the step that failed."}
          action={
            <div className="flex gap-2">
              <LinkButton href={runHref(plan.runId)} testId="plan-open-run">Open the run</LinkButton>
              <Button data-testid="plan-reload" onClick={onReload}>Reload</Button>
            </div>
          }
        />
      </div>
    );
  if (rows.length === 0)
    return (
      <div className="p-6" data-testid="plan-empty">
        <ErrorState title="No faces picked" message="This plan has no picks. The run may have dropped every face for thin evidence." />
      </div>
    );

  return (
    <div data-testid="plan-view" data-plan-id={plan.id} className="grid flex-1 lg:flex-none lg:h-[calc(100dvh-48px)] lg:grid-cols-[1fr_420px] lg:grid-rows-[minmax(0,1fr)]">
      <div className="relative h-[45vh] min-h-[280px] lg:h-full">
        <PlanMap heat={data.plan.heat} faces={data.faces} picks={mapPicks} selectedFaceId={selected} onSelectFace={select} />
      </div>
      <aside data-testid="plan-panel" className="flex flex-col gap-5 border-l border-rule bg-panel p-4 lg:overflow-y-auto">
        <PlanHeader plan={plan} brief={data.brief} />
        <PlanTotals plan={plan} run={run} />
        {selectedRow ? <SelectedFace row={selectedRow} planId={plan.id} /> : null}
        <PicksList rows={rows} planId={plan.id} selected={selected} onSelect={select} droppedNote={`then ${Math.max(0, plan.scoredCount - rows.length - plan.droppedCount)} faces scored lower, ${plan.droppedCount} dropped`} />
        <BudgetSplit plan={plan} />
        <RunPanel run={run} error={runErr} />
        <PlanActions plan={plan} onPlan={setPlan} />
      </aside>
    </div>
  );
}

function PlanSkeleton() {
  return (
    <div data-testid="plan-loading" aria-busy="true" className="grid flex-1 lg:flex-none lg:h-[calc(100dvh-48px)] lg:grid-cols-[1fr_420px] lg:grid-rows-[minmax(0,1fr)]">
      <div className="skeleton h-[45vh] !rounded-none lg:h-full" />
      <div className="flex flex-col gap-3 p-4">
        <div className="skeleton h-6 w-1/2" />
        <div className="skeleton h-8 w-3/4" />
        <div className="skeleton h-40" />
        <div className="skeleton h-64" />
      </div>
    </div>
  );
}
