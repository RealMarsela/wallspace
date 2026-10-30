import type { WallspaceEnv } from "../db/bindings";
import { getStore } from "../db";
import { QlooClient, type QlooDeps } from "./client";
import { KvReplay, MemoryReplay, loadRecordings, type ReplaySource } from "./replay";
import { ChainedReplay, syntheticReplay } from "./synthetic";

export * from "./endpoints";
export { QlooClient, type QlooResult, type QlooSource } from "./client";
export { QlooError } from "./types";
export type { QlooMode } from "./types";
export { buildAudienceCard } from "./card";

async function replaySourceFor(env: WallspaceEnv): Promise<ReplaySource> {
  const sources: ReplaySource[] = [];
  if (env.WS_KV) sources.push(new KvReplay(env.WS_KV)); // production: private recordings loaded by scripts/qloo-load-replay.ts
  else {
    try { // dev: private recordings on disk when present
      const recs = await loadRecordings(["fixtures/qloo-private/recordings"]);
      if (recs.length) sources.push(await MemoryReplay.from(recs));
    } catch { /* not node */ }
  }
  sources.push(await syntheticReplay());
  return new ChainedReplay(sources);
}

/**
 * The Qloo client for this environment. QLOO_MODE=live with QLOO_API_KEY present: live (KV-cached, QLOO_METER-capped, ledgered).
 * Anything else: replay, which never calls Qloo. A live mode without a key falls back to replay rather than failing a page.
 */
export async function qlooClientFor(env: WallspaceEnv & Record<string, unknown>, context?: { planId?: string; runId?: string }, hooks?: { onMiss?: QlooDeps["onMiss"] }): Promise<QlooClient> {
  const live = env.QLOO_MODE === "live" && !!env.QLOO_API_KEY;
  const num = (v: string | undefined) => (v && Number(v) > 0 ? Number(v) : undefined);
  return new QlooClient({
    mode: live ? "live" : "replay", apiKey: env.QLOO_API_KEY, kv: env.WS_KV, meter: env.QLOO_METER,
    caps: { total: num(env.QLOO_CAP_TOTAL) ?? 300, day: num(env.QLOO_CAP_DAY) ?? 60 },
    store: await getStore(env).catch(() => undefined), replay: live ? undefined : await replaySourceFor(env), context, onMiss: hooks?.onMiss,
  });
}
