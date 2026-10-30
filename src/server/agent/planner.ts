import { z } from "zod";
import type { Brief, HeatCell, RunStep, Seed } from "@/contract";
import type { ChatMessage, TokenFactory, ToolDef } from "../models";
import type { QlooPort } from "./ports";

// Super VL is the planner: it chooses tool calls inside a fixed spine. Two failed tool-calling attempts -> the fixed spine runs and says so.

const MAX_TURNS = 4;

const tools: ToolDef[] = [
  { type: "function", function: { name: "qloo_search", description: "Resolve one thing the audience loves (an artist, show, brand, place) to a Qloo entity. Call once per distinct love, at most four.", parameters: { type: "object", properties: { query: { type: "string", description: "the name to look up" } }, required: ["query"] } } },
  { type: "function", function: { name: "qloo_heatmap", description: "Map where this taste concentrates over Atlanta using every seed resolved so far. Call exactly once, after the searches.", parameters: { type: "object", properties: {} } } },
];

const SYSTEM = `You are the Wallspace planner. You turn an advertiser's brief into Qloo calls, then stop.
Rules: audiences are described by taste only. Call qloo_search for each distinct thing the audience loves (at most four, skip near-duplicates), then call qloo_heatmap exactly once. Reply with the single word DONE after the heatmap.`;

const SearchArgs = z.object({ query: z.string().min(1).max(120) });

export interface ResolveResult {
  seeds: Seed[];
  heat: HeatCell[];
  steps: RunStep[];
  fixedSpine: boolean;
  qlooCached: boolean;
}

const qlooStep = (title: string, tool: string, summary: string, ms: number, cached: boolean): RunStep => ({
  id: "", at: new Date().toISOString(), role: "qloo", model: null, title, tool, summary, ms, tokensIn: null, tokensOut: null, costUsd: 0, requestId: null, cached, status: "ok",
});

function dedupe(seeds: Seed[]): Seed[] {
  const seen = new Set<string>();
  return seeds.filter((s) => !seen.has(s.qlooId) && seen.add(s.qlooId));
}

export async function resolveAndMap(tf: TokenFactory, qloo: QlooPort, brief: Pick<Brief, "audienceText" | "loves" | "city">, embedSeeds: Seed[]): Promise<ResolveResult> {
  const steps: RunStep[] = [];
  let seeds = [...embedSeeds];
  let heat: HeatCell[] = [];
  let cachedAll = true;
  let failures = 0;
  let planned = false;

  const runSearch = async (query: string) => {
    const r = await qloo.search(query);
    cachedAll = cachedAll && r.cached;
    if (r.data) seeds = dedupe([...seeds, { ...r.data, via: "search" }]);
    steps.push(qlooStep(`resolve "${query}"`, r.tool, r.data ? `${query} -> ${r.data.name}` : `${query}: no Qloo entity found`, r.ms, r.cached));
    return r.data ? `${r.data.name} (${r.data.qlooId})` : "no match";
  };
  const runHeatmap = async () => {
    const r = await qloo.heatmap(seeds);
    cachedAll = cachedAll && r.cached;
    heat = r.data;
    steps.push(qlooStep("map the audience over Atlanta", r.tool, `${r.data.length} heat cells from ${seeds.length} seeds`, r.ms, r.cached));
    return `${r.data.length} cells`;
  };

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    { role: "user", content: `Brief: audience says "${brief.audienceText}". Loves: ${brief.loves.join("; ") || "none listed"}. City: ${brief.city}.\nAlready matched by embeddings: ${embedSeeds.map((s) => s.name).join(", ") || "nothing"}.` },
  ];

  for (let turn = 0; turn < MAX_TURNS && failures < 2 && heat.length === 0; turn++) {
    let res;
    try {
      res = await tf.chat({ role: "superVl", messages, tools, toolChoice: "auto", reasoning: failures === 0 ? "off" : "default", maxTokens: 600, temperature: 0, meta: { title: "plan the Qloo calls", tool: "tool calling" } });
    } catch {
      failures += 1;
      continue;
    }
    steps.push({ ...res.step, summary: res.toolCalls.length ? `chose ${res.toolCalls.map((c) => c.function.name).join(", ")}` : "no tool call" });
    if (!res.toolCalls.length) {
      failures += 1;
      messages.push({ role: "assistant", content: res.content || "" }, { role: "user", content: "Call the tools now: qloo_search for each love, then qloo_heatmap." });
      continue;
    }
    planned = true;
    messages.push({ role: "assistant", content: res.content || null, tool_calls: res.toolCalls });
    for (const call of res.toolCalls) {
      let out = "error: unknown tool";
      try {
        if (call.function.name === "qloo_search") {
          const args = SearchArgs.parse(JSON.parse(call.function.arguments));
          out = await runSearch(args.query);
        } else if (call.function.name === "qloo_heatmap") {
          out = await runHeatmap();
        } else failures += 1;
      } catch {
        failures += 1;
        out = "error: invalid arguments";
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: out });
    }
  }

  let fixedSpine = false;
  if (!heat.length) {
    fixedSpine = true;
    const searched = new Set(steps.filter((s) => s.role === "qloo").map((s) => s.title));
    for (const love of brief.loves.slice(0, 4)) if (!searched.has(`resolve "${love}"`)) await runSearch(love);
    await runHeatmap();
    steps.push({ ...qlooStep("fixed spine", "fixed spine", planned ? "planner finished without a heatmap; the fixed spine ran it" : "planner tool calls failed twice; the fixed spine searched every love and ran the heatmap", 0, false), role: "super-vl" });
  }
  return { seeds, heat, steps, fixedSpine, qlooCached: cachedAll };
}
