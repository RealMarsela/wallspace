"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Run, RunStep } from "@/contract";
import { Button } from "@/components/ui/Button";
import { ModelChip } from "@/components/ui/ModelChip";
import { Pill } from "@/components/ui/Pill";
import { roleOrder } from "@/components/ui/models";
import { cents, ms } from "@/components/ui/format";
import { api } from "@/lib/api-client";
import { StepRow } from "./StepRow";
import { planHref } from "@/lib/routes";

type Phase = "connecting" | "streaming" | "done" | "error";

/** Live agent trace: steps stream in over the run's WebSocket (mock mode replays the sample run). */
export function RunTrace({ runId }: { runId: string }) {
  const [meta, setMeta] = useState<Run | null>(null);
  const [steps, setSteps] = useState<RunStep[]>([]);
  const [phase, setPhase] = useState<Phase>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [hash, setHash] = useState("");
  const listEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.run(runId).then(
      (r) => setMeta(r.run),
      () => undefined,
    );
  }, [runId]);

  useEffect(() => {
    const stop = api.live(runId, {
      onStep: (s) => {
        setPhase("streaming");
        setSteps((prev) => (prev.some((p) => p.id === s.id) ? prev : [...prev, s]));
      },
      onDone: () => setPhase("done"),
      onError: (m) => {
        setError(m);
        setPhase("error");
      },
    });
    return () => {
      stop();
      setSteps([]);
      setPhase("connecting");
      setError(null);
    };
  }, [runId, nonce]);

  useEffect(() => {
    const read = () => setHash(decodeURIComponent(location.hash.slice(1)));
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  useEffect(() => {
    if (hash && steps.some((s) => s.id === hash)) document.getElementById(hash)?.scrollIntoView({ block: "center" });
    else if (phase === "streaming" && !hash) listEnd.current?.scrollIntoView({ block: "nearest" });
  }, [steps, hash, phase]);

  const stepCost = steps.reduce((n, s) => n + (s.costUsd ?? 0), 0);
  // The run record carries the authoritative total; the streamed steps may not include every call.
  const cost = phase === "done" && meta ? Math.max(meta.costUsd, stepCost) : stepCost;
  const time = steps.reduce((n, s) => n + s.ms, 0);
  const tok = steps.reduce((n, s) => n + (s.tokensIn ?? 0) + (s.tokensOut ?? 0), 0);
  const usedRoles = roleOrder.filter((r) => steps.some((s) => s.role === r));

  return (
    <div data-testid="run-trace" data-run-id={runId} className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow">Agent run{meta ? ` · ${meta.kind}` : ""}</span>
          <span data-testid="run-phase" data-phase={phase}>
            <Pill tone={phase === "done" ? "picked" : phase === "error" ? "guard" : "heat"}>
              {phase === "connecting" ? "connecting…" : phase === "streaming" ? "running" : phase === "done" ? "done" : "error"}
            </Pill>
          </span>
          {api.mode === "mock" ? <Pill tone="warn">mock mode: replaying the sample run</Pill> : null}
        </div>
        <h1 className="text-2xl">Which model does what</h1>
        <p data-testid="run-totals" className="text-[0.88rem] text-ink-2 tnum">
          {steps.length} steps · {ms(time)} of model and tool time · {tok.toLocaleString("en-US")} tokens · cost {cents(cost)}
        </p>
        <div className="flex flex-wrap gap-1.5" data-testid="run-legend">
          {usedRoles.map((r) => (
            <ModelChip key={r} role={r} />
          ))}
        </div>
      </header>
      {error ? (
        <p role="alert" data-testid="run-error" className="text-guard">
          {error}
        </p>
      ) : null}
      <ol data-testid="run-steps" aria-live="polite" className="rounded border border-rule bg-panel">
        {steps.map((s, i) => (
          <StepRow key={s.id} step={s} index={i} highlighted={s.id === hash} />
        ))}
        {phase !== "done" && phase !== "error" ? (
          <li data-testid="run-waiting" className="px-3 py-3 text-[0.85rem] text-muted">
            {phase === "connecting" ? "Connecting to the run…" : "Waiting for the next step…"}
          </li>
        ) : null}
      </ol>
      <div ref={listEnd} />
      <div className="flex flex-wrap gap-2">
        {meta?.planId ? (
          <Link href={planHref(meta.planId)} data-testid="run-open-plan" className="inline-flex h-10 items-center rounded bg-picked px-4 text-[0.88rem] font-semibold text-white">
            Open the plan
          </Link>
        ) : null}
        <Button data-testid="run-replay" onClick={() => setNonce((n) => n + 1)} disabled={phase === "streaming" || phase === "connecting"}>
          Replay
        </Button>
      </div>
    </div>
  );
}
