// Shared by sample-plan.mts and qloo-discover.mts: the sample brief, a file-backed KV, and adapters whose Qloo client replays the
// real recordings in fixtures/qloo-private/recordings, logs every request that had no exact recording, and falls back to the labelled
// synthetic fixtures only for the kinds a sample run can lack (block tags, brands, explain). Never calls Qloo.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Brief } from "../src/contract";
import { faces } from "../src/data/faces";
import type { KvMin, QlooPort, ScoringPort } from "../src/server/agent/ports";
import { qlooPortFor } from "../src/server/agent/qloo-adapter";
import { scoringPort } from "../src/server/agent/scoring-adapter";
import { QlooClient } from "../src/server/qloo/client";
import { MemoryReplay, loadRecordings, type ReplaySource } from "../src/server/qloo/replay";
import { ChainedReplay, syntheticReplay } from "../src/server/qloo/synthetic";
import type { QlooKind, QlooParams } from "../src/server/qloo/types";

export class FileJson {
  private data: Record<string, unknown>;
  constructor(readonly path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.data = existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>) : {};
  }
  get<T>(k: string) { return this.data[k] as T | undefined; }
  set(k: string, v: unknown) { this.data[k] = v; writeFileSync(this.path, JSON.stringify(this.data)); }
}

export const sampleBrief = (): Brief => ({
  id: "brief-sample", brandName: "Porchlight Comedy Tour (sample brand)", brandSample: true,
  audienceText: "people who would go to a comedy club on a Tuesday night", loves: ["stand-up comedy specials", "90s sitcoms", "southern hip-hop"], seeds: [],
  city: "atlanta", budgetUsd: 40000, flightStart: "2026-11-16", flightWeeks: 4, brandVoice: "warm, dry, a little cheeky", creativeUrl: null, createdAt: new Date().toISOString(),
});

// A synthetic fixture must never resolve a search, a tag list or an entity lookup in a sample run: those have real recordings or fail loudly.
const SYNTHETIC_KINDS = new Set<string>(["heatmap", "tags-by-place", "brands-by-place", "explain"]);
const syntheticFor = async (): Promise<ReplaySource> => {
  const inner = await syntheticReplay();
  return { lookup: async (key, kind) => (SYNTHETIC_KINDS.has(kind) ? inner.lookup(key, kind) : null) };
};

export interface Miss { kind: QlooKind; endpoint: string; params: QlooParams }

export async function sampleAdapters(misses: Miss[], dir = "fixtures/qloo-private/recordings"): Promise<{ qloo: QlooPort; scoring: ScoringPort; faces: typeof faces; client: QlooClient }> {
  const real = await MemoryReplay.from(await loadRecordings([dir]));
  const client = new QlooClient({ mode: "replay", replay: new ChainedReplay([real, await syntheticFor()]), onMiss: (m) => void misses.push(m) });
  return { qloo: qlooPortFor(client), scoring: scoringPort(), faces, client };
}

export const fileKv = (cache: FileJson): KvMin => ({ get: async (k) => cache.get<string>(`kv:${k}`) ?? null, put: async (k, v) => cache.set(`kv:${k}`, v) });
