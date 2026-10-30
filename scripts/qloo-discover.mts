// Finds the Qloo requests the sample plan needs but has no recording for, without running the whole pipeline.
//   set -a; . ./.env.local; set +a; npx tsx scripts/qloo-discover.mts
// Runs embeddings -> planner (search + heatmap) -> face scoring -> block tags on replay and prints each request that had no exact
// recording (JSON). Make those calls with scripts/qloo-call.sh, run scripts/qloo-record.mts, and run this again until the list is empty.
import { writeFileSync } from "node:fs";
import { tokenFactoryFor } from "../src/server/agent/env";
import { CANDIDATES } from "../src/server/agent/pipeline";
import { resolveAndMap } from "../src/server/agent/planner";
import { matchSeeds } from "../src/server/agent/vocab";
import { FileJson, fileKv, sampleAdapters, sampleBrief, type Miss } from "./_qloo-sample";

const say = (s: string) => process.stdout.write(`${s}\n`);
const env = { ...process.env, TF_MODE: "live" } as Record<string, string>;
const tf = tokenFactoryFor(env as never);
if (!tf) throw new Error("NEBIUS_API_KEY is not set");
const misses: Miss[] = [];
const a = await sampleAdapters(misses);
const brief = sampleBrief();
const kv = fileKv(new FileJson(".data/b2-cache/kv.json"));

const m = await matchSeeds(tf, kv, a.qloo, [brief.audienceText, ...brief.loves].filter(Boolean));
say(`embedding seeds: ${m.seeds.map((s) => `${s.name} ${s.similarity}`).join(", ")}`);
const r = await resolveAndMap(tf, a.qloo, brief, m.seeds);
say(`seeds after planner: ${r.seeds.map((s) => `${s.name} (${s.type.split(":").slice(-2).join(":")})`).join(", ")}; ${r.heat.length} heat cells; fixedSpine=${r.fixedSpine}`);
const scored = a.scoring.score(a.faces, r.heat).filter((s) => s.hasEvidence).slice(0, CANDIDATES);
say(`candidates: ${scored.map((s) => `${s.face.id}:${s.affinity.toFixed(2)}`).join(" ")}`);
for (const c of scored) await a.qloo.blockTags(c.face, r.seeds);
const uniq = new Map(misses.map((x) => [JSON.stringify([x.endpoint, x.params]), x] as const));
writeFileSync(".data/qloo-misses.json", JSON.stringify([...uniq.values()], null, 1));
say(`\n${uniq.size} request(s) without an exact recording (.data/qloo-misses.json):`);
for (const x of uniq.values()) say(`${x.kind} ${x.endpoint} ${JSON.stringify(x.params).slice(0, 400)}`);
