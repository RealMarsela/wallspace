// Builds the pre-computed sample plan the judges land on: the whole pipeline once, with Qloo on replay, Token Factory live
// and Tavily live behind the pre-warm budget (everything cached in .data/b2-cache so a rerun costs nothing at Tavily).
// Run: set -a; . ./.env.local; set +a; npx tsx scripts/sample-plan.mts
// Output: fixtures/qloo-private/sample-plan.json (gitignored: it carries Qloo-derived heat) for scripts/seed-sample-plan.mts.
import { mkdirSync, writeFileSync } from "node:fs";
import type { RunStep } from "../src/contract";
import { runPlanPipeline } from "../src/server/agent/pipeline";
import { directRunner } from "../src/server/agent/steps";
import { MemoryStore } from "../src/server/db/memory";
import { tokenFactoryFor } from "../src/server/agent/env";
import { TavilyBudgetCore, memoryBudget, type BudgetStorage } from "../src/server/tavily/budget-core";
import { Tavily } from "../src/server/tavily/client";
import { FileJson, fileKv, sampleAdapters, sampleBrief, type Miss } from "./_qloo-sample";

const say = (s: string) => process.stdout.write(s + "\n");

const cache = new FileJson(".data/b2-cache/kv.json");
const kv = fileKv(cache);
const budgetStore: BudgetStorage = { get: async <T,>(k: string) => cache.get<T>(`budget:${k}`), put: async <T,>(k: string, v: T) => cache.set(`budget:${k}`, v) };

const env = { ...process.env, TF_MODE: "live", QLOO_MODE: "replay" } as Record<string, string>;
const tf = tokenFactoryFor(env);
if (!tf) throw new Error("NEBIUS_API_KEY is not set (inject.sh get NEBIUS_API_KEY --dir .)");
const misses: Miss[] = [];
const a = await sampleAdapters(misses); // real recordings first, labelled synthetic fixtures only for what has no recording
const store = new MemoryStore();
const steps: RunStep[] = [];

const brief = sampleBrief();
await store.putBrief(brief);

const out = await runPlanPipeline({
  tf, qloo: a.qloo, scoring: a.scoring, faces: a.faces, kv,
  tavily: env.TAVILY_API_KEY ? new Tavily({ mode: "live", apiKey: env.TAVILY_API_KEY }) : null,
  budget: memoryBudget(new TavilyBudgetCore(budgetStore)), store, step: directRunner, sessionId: "builder-prewarm", bucket: "prewarm",
  emit: async (s) => { steps.push(s); say(`${s.role.padEnd(10)} ${String(s.ms).padStart(5)}ms $${(s.costUsd ?? 0).toFixed(5)} ${s.cached ? "cache" : "live "} ${s.title} :: ${s.summary.slice(0, 110)}`); },
}, { brief, planId: "plan-sample", runId: "run-sample", sample: true });

mkdirSync("fixtures/qloo-private", { recursive: true });
writeFileSync("fixtures/qloo-private/sample-plan.json", JSON.stringify({ brief, plan: out.plan, run: out.run }, null, 1));
if (misses.length) say(`\nrequests without an exact recording (answered by the labelled synthetic fixture): ${misses.map((m) => `${m.kind} ${String(m.params["signal.location"] ?? "")}`).join("; ")}`);
say(`\nplan ${out.plan.id}: ${out.plan.picks.length} picks, $${out.plan.spendUsd}, ${out.plan.scoredCount} scored, ${out.plan.droppedCount} dropped; run cost $${out.run.costUsd}; ${out.run.steps.length} steps`);
