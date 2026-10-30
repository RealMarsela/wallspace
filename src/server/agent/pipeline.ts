import type { Brief, CopyLine, Evidence, Face, HeatCell, Pick, Plan, Run, RunStep, Seed } from "@/contract";
import type { TokenFactory } from "../models";
import { guardStep, guardText } from "../guard";
import type { BudgetClient } from "../tavily/budget-core";
import type { Tavily } from "../tavily/client";
import { eventsFor } from "../tavily/events";
import { writeCopy } from "./copy";
import { inspectCandidates } from "./inspect";
import { resolveAndMap } from "./planner";
import type { KvMin, PlanStore, QlooPort, ScoredFace, ScoringPort, StepSink } from "./ports";
import { ultraReview } from "./review";
import { PlanError, buildRun, codeStep, emitSteps, mapPool, runHead, type StepRunner } from "./steps";
import { matchSeeds } from "./vocab";

export const CANDIDATES = 14;

export interface PipelineDeps {
  tf: TokenFactory;
  qloo: QlooPort;
  scoring: ScoringPort;
  faces: Face[];
  kv: KvMin;
  tavily: Tavily | null;
  budget: BudgetClient | null;
  store: PlanStore;
  emit: StepSink;
  step: StepRunner;
  sessionId: string;
  bucket: "visitor" | "prewarm";
  fetchImpl?: typeof fetch;
}

export interface PipelineInput {
  brief: Brief;
  planId: string;
  runId: string;
  sample: boolean;
}

interface Candidate extends ScoredFace {
  topTags: { id: string; name: string; affinity: number; lift?: number | null; synthetic?: boolean }[];
}

export async function runPlanPipeline(d: PipelineDeps, input: PipelineInput): Promise<{ plan: Plan; run: Run }> {
  const { brief, planId, runId } = input;
  const startedAt = new Date().toISOString();
  const log: RunStep[] = [];
  const push = (s: RunStep[]) => void log.push(...s);
  const faceById = new Map(d.faces.map((f) => [f.id, f] as const));

  // 1. guard
  const guard = await d.step("guard", async () => {
    const r = await guardText(`${brief.audienceText}. ${brief.loves.join(", ")}`, { kind: "brief", loves: brief.loves, tf: d.tf });
    return { verdict: r.verdict, steps: await emitSteps(d.emit, `${runId}:guard`, [guardStep("", "brief passes the taste-only check", r), ...r.steps]) };
  });
  push(guard.steps);
  if (guard.verdict.status !== "pass") throw new PlanError(guard.verdict.reasons[0] ?? "brief refused by the taste-only guard", "guard_blocked");

  // 2. embeddings: free text -> Qloo tags
  const embed = await d.step("embed", async () => {
    const m = await matchSeeds(d.tf, d.kv, d.qloo, [brief.audienceText, ...brief.loves].filter(Boolean));
    return { seeds: m.seeds, steps: await emitSteps(d.emit, `${runId}:embed`, m.steps) };
  });
  push(embed.steps);

  // 3. resolve seeds and map (Super VL plans the Qloo calls)
  const mapped = await d.step("resolve", async () => {
    const r = await resolveAndMap(d.tf, d.qloo, brief, embed.seeds);
    return { seeds: r.seeds as Seed[], heat: r.heat as HeatCell[], steps: await emitSteps(d.emit, `${runId}:resolve`, r.steps) };
  });
  push(mapped.steps);
  const heatStepId = [...mapped.steps].reverse().find((s) => s.title.startsWith("map the audience"))?.id ?? mapped.steps[0]?.id ?? "";

  // 4. score every face against the heatmap cells, keep the candidates
  const scored = await d.step("score", async () => {
    const all = d.scoring.score(d.faces, mapped.heat);
    const withEvidence = all.filter((s) => s.hasEvidence);
    const candidates = withEvidence.slice(0, CANDIDATES);
    const steps = await emitSteps(d.emit, `${runId}:score`, [codeStep("super-vl", `score ${all.length} faces by heatmap cell`, "score_faces", `${withEvidence.length} faces have audience evidence; kept the top ${candidates.length} as candidates; ${all.length - withEvidence.length} dropped for missing evidence`)]);
    return { candidates, scoredCount: all.length, noEvidence: all.length - withEvidence.length, steps };
  });
  push(scored.steps);

  // 5. Super VL chooses site photos to read; a blocked sightline drops the face
  const inspected = await d.step("inspect", async () => {
    const r = await inspectCandidates(d.tf, scored.candidates, d.fetchImpl);
    return { reads: r.reads, dropped: r.dropped, steps: await emitSteps(d.emit, `${runId}:inspect`, r.steps) };
  });
  push(inspected.steps);
  const droppedIds = new Set(inspected.dropped.map((x) => x.faceId));
  const remaining = scored.candidates.filter((c) => !droppedIds.has(c.face.id));

  // 6. what each block over-indexes on
  const indexed = await d.step("overindex", async () => {
    let ms = 0;
    let allCached = true;
    let tool = "qloo.insights urn:tag + signal.location";
    const out: Candidate[] = [];
    for (const c of remaining) {
      const r = await d.qloo.blockTags(c.face, mapped.seeds);
      ms += r.ms;
      allCached = allCached && r.cached;
      if (!r.data.some((t) => t.synthetic)) tool = r.tool; // name the tool from a real block when there is one
      out.push({ ...c, topTags: r.data.slice(0, 5) });
    }
    // Mixed provenance is stated in the step: blocks without a Qloo recording carry the labelled synthetic fixture.
    const synth = out.filter((c) => c.topTags.some((t) => t.synthetic)).length;
    const label = synth ? `${tool.replace(/ \(synthetic fixture\)$/, "")} (${out.length - synth} blocks from Qloo recordings, ${synth} synthetic sample)` : tool;
    const steps = await emitSteps(d.emit, `${runId}:overindex`, [{ ...codeStep("qloo", "what each block over-indexes on", label, `${out.length} blocks, ${out.reduce((a, c) => a + c.topTags.length, 0)} tags${synth ? `; ${synth} synthetic` : ""}`, ms), cached: allCached }]);
    return { candidates: out, steps };
  });
  push(indexed.steps);

  // 7. budget split (picks come from the optimizer, so events and copy only run for faces that will be bought)
  const split = await d.step("split", async () => {
    const r = d.scoring.split(indexed.candidates, brief);
    const steps = await emitSteps(d.emit, `${runId}:split`, [codeStep("super-vl", `split $${brief.budgetUsd.toLocaleString("en-US")} across the picks`, "budget_split", `${r.picks.length} faces, $${Math.round(r.spendUsd).toLocaleString("en-US")} spend, split over ${r.split.length} neighbourhoods`)]);
    return { picks: r.picks.map((p) => p.face.id), costs: r.costs, split: r.split, spendUsd: r.spendUsd, steps };
  });
  push(split.steps);
  const byFaceTags = new Map(indexed.candidates.map((c) => [c.face.id, c] as const));
  const pickCands = split.picks.map((id) => byFaceTags.get(id)).filter((c): c is Candidate => !!c);

  // 8. events near each picked neighbourhood during the flight
  const neighbourhoods = [...new Set(pickCands.map((c) => c.face.neighbourhood))];
  const events = await d.step("events", async () => {
    const byHood: Record<string, { title: string; date: string; distanceM: number | null; url: string }[]> = {};
    const steps: RunStep[] = [];
    for (const n of neighbourhoods) {
      const r = await eventsFor({ tavily: d.tavily, tf: d.tf, kv: d.kv, budget: d.budget, sessionId: d.sessionId, bucket: d.bucket }, n, { start: brief.flightStart, weeks: brief.flightWeeks });
      byHood[n] = r.events;
      steps.push(...r.steps);
    }
    return { byHood, steps: await emitSteps(d.emit, `${runId}:events`, steps) };
  });
  push(events.steps);
  const eventRef = (n: string) => events.steps.find((s) => s.role === "tavily" && s.title.endsWith(n))?.id ?? events.steps[0]?.id ?? "";

  // 9. three lines per face, each guarded; a blocked line gets one redraft
  const copied = await d.step("copy", async () => {
    const results = await mapPool(pickCands, 3, async (c) => {
      const input = { brief, face: c.face, topTags: c.topTags.map((t) => t.name), events: events.byHood[c.face.neighbourhood] ?? [] };
      let r = await writeCopy(d.tf, input);
      const steps = [...r.steps];
      if (r.lines.some((l) => l.guard.status !== "pass")) {
        const why = r.lines.flatMap((l) => l.guard.reasons).join(" ");
        const again = await writeCopy(d.tf, { ...input, redraftNote: `the guard refused a line: ${why}` });
        steps.push(...again.steps);
        r = { steps, lines: again.lines.map((l, i) => (l.guard.status === "pass" && r.lines[i].guard.status !== "pass" ? ({ ...l, guard: { ...l.guard, status: "rewritten" as const, reasons: r.lines[i].guard.reasons } }) : l)) };
      }
      return { faceId: c.face.id, lines: r.lines, steps };
    });
    const flat = results.flatMap((r) => r.steps.map((s) => ({ ...s, summary: s.summary || r.faceId })));
    const checks = results.reduce((a, r) => a + r.lines.length, 0);
    const stepsOut = await emitSteps(d.emit, `${runId}:copy`, [...flat, codeStep("live-guard", "guard checks every copy line", "live-guard", `${checks} lines checked, ${results.reduce((a, r) => a + r.lines.filter((l) => l.guard.status !== "pass").length, 0)} not passed`)]);
    return { lines: Object.fromEntries(results.map((r) => [r.faceId, r.lines])) as Record<string, CopyLine[]>, steps: stepsOut };
  });
  push(copied.steps);

  // assemble picks
  // affinity is 0..1; score is 0..100 (affinity x visibility weight x 100); cost is the flight cost from the face's sample monthly rate.
  const picks: Pick[] = pickCands.map((c, i) => {
    const read = inspected.reads[c.face.id] ?? null;
    const ev = events.byHood[c.face.neighbourhood] ?? [];
    const evidence: Evidence[] = [
      { kind: "qloo-heatmap", label: `audience affinity ${c.affinity.toFixed(2)} in this cell`, value: c.affinity, sourceRef: heatStepId },
      // The label says where the number comes from: a Qloo answer (with its lift against the Atlanta list) or the labelled synthetic fixture.
      ...c.topTags.slice(0, 3).map((t): Evidence => ({ kind: "qloo-tag", label: `over-indexes on ${t.name}${t.lift ? ` (${t.lift}x vs Atlanta)` : ""}${t.synthetic ? " (synthetic sample)" : ""}`, value: t.affinity, sourceRef: indexed.steps[0]?.id ?? "" })),
      ...(read ? [{ kind: "photo-read" as const, label: `${read.sightline} sightline, ${read.clutter} clutter`, value: read.faceShareOfFrame, sourceRef: inspected.steps.find((s) => s.summary.startsWith(c.face.id))?.id ?? inspected.steps[0]?.id ?? "" }] : []),
      ...ev.slice(0, 2).map((e): Evidence => ({ kind: "tavily-event", label: `${e.title} (${e.date})`, value: null, sourceRef: eventRef(c.face.neighbourhood) })),
    ];
    return { faceId: c.face.id, rank: i + 1, affinity: c.affinity, score: c.score, costUsd: split.costs[c.face.id] ?? 0, topTags: c.topTags.map((t) => t.name), evidence, photoRead: read, events: ev, copy: copied.lines[c.face.id] ?? [], chosenCopy: 0, review: { status: "ok", note: null }, tasteShifted: false };
  });
  const base: Plan = {
    id: planId, briefId: brief.id, runId, status: "running", picks, scoredCount: scored.scoredCount, droppedCount: scored.noEvidence + inspected.dropped.length,
    spendUsd: split.spendUsd, split: split.split, heat: [...mapped.heat].sort((a, b) => b.affinity - a.affinity).slice(0, 400), nemoJobId: null, lastRescanAt: null, createdAt: startedAt, sample: input.sample,
  };

  // 10. Ultra reviews the whole plan once; flagged faces are redrafted by Lightning
  const reviewed = await d.step("review", async () => {
    const r = await ultraReview(d.tf, brief, base, d.faces);
    const flagged = [...new Set(r.out.flags.filter((f) => f.issue !== "budget").map((f) => f.faceId))].filter((id) => base.picks.some((p) => p.faceId === id));
    const steps = r.steps.map((s) => ({ ...s, summary: `${r.out.flags.length} flag(s)${r.out.flags.length ? `: ${r.out.flags.map((f) => `${f.faceId} ${f.issue}`).join(", ")}` : ""}. Budget: ${r.out.budgetNote}` }));
    return { flags: r.out.flags, flagged, steps: await emitSteps(d.emit, `${runId}:review`, steps) };
  });
  push(reviewed.steps);

  const redrafted = await d.step("redraft", async () => {
    const out: Record<string, CopyLine[]> = {};
    const steps: RunStep[] = [];
    for (const id of reviewed.flagged) {
      const p = base.picks.find((x) => x.faceId === id) as Pick;
      const face = faceById.get(id) as Face;
      const notes = reviewed.flags.filter((f) => f.faceId === id).map((f) => `${f.issue}: ${f.note}`).join(" ");
      const near = base.picks.filter((o) => o.faceId !== id).map((o) => o.copy[o.chosenCopy]?.text).filter((t): t is string => !!t);
      const r = await writeCopy(d.tf, { brief, face, topTags: p.topTags, events: p.events, redraftNote: notes, avoid: near });
      out[id] = r.lines;
      steps.push(...r.steps);
    }
    return { lines: out, steps: await emitSteps(d.emit, `${runId}:redraft`, steps) };
  });
  push(redrafted.steps);

  const final: Plan = {
    ...base,
    status: "ready",
    picks: base.picks.map((p) => {
      const fresh = redrafted.lines[p.faceId];
      if (!fresh) return p;
      const note = reviewed.flags.filter((f) => f.faceId === p.faceId).map((f) => `${f.issue}: ${f.note}`).join(" ");
      return { ...p, copy: fresh, chosenCopy: 0, review: { status: fresh.some((l) => l.guard.status === "blocked") ? ("flagged" as const) : ("redrafted" as const), note } };
    }),
  };
  const run = buildRun(runId, planId, "plan", log, "done", startedAt);
  await d.store.putPlan(final);
  await d.store.putRun(runHead(run));
  return { plan: final, run };
}
