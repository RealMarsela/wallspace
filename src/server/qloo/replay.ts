import { defaultKey, requestKey } from "./request-key";
import { Recording } from "./types";
import type { KvLike } from "../db/bindings";

/** Where replay answers come from. `exact` is the recorded answer to this very request, `fallback` the default recording for its kind. */
export interface ReplaySource {
  lookup(key: string, kind: string): Promise<{ recording: Recording; exact: boolean } | null>;
}

/** Production: recordings loaded into KV by scripts/qloo-load-replay.ts under qloo:v1:<hash> and qloo:v1:default:<kind>. */
export class KvReplay implements ReplaySource {
  constructor(private readonly kv: KvLike) {}
  async lookup(key: string, kind: string) {
    const exact = await this.kv.get(key);
    if (exact) return { recording: Recording.parse(JSON.parse(exact)), exact: true };
    const dflt = await this.kv.get(defaultKey(kind));
    return dflt ? { recording: Recording.parse(JSON.parse(dflt)), exact: false } : null;
  }
}

/** Tests and `next dev` without KV: an in-memory set of recordings. */
export class MemoryReplay implements ReplaySource {
  private readonly exact = new Map<string, Recording>();
  private readonly defaults = new Map<string, Recording>();
  private constructor() {}
  static async from(recordings: Recording[]): Promise<MemoryReplay> {
    const r = new MemoryReplay();
    for (const rec of recordings) {
      r.exact.set(await requestKey(rec.endpoint, rec.params), rec);
      if (rec.default) r.defaults.set(rec.kind, rec);
    }
    return r;
  }
  async lookup(key: string, kind: string) {
    const e = this.exact.get(key);
    if (e) return { recording: e, exact: true };
    const d = this.defaults.get(kind);
    return d ? { recording: d, exact: false } : null;
  }
}

/** Reads every *.json recording in a directory (node only). Private recordings first, then the synthetic set when none exist. */
export async function loadRecordings(dirs: string[]): Promise<Recording[]> {
  const { readdir, readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  for (const dir of dirs) {
    const files = await readdir(dir).catch(() => [] as string[]);
    const json = files.filter((f) => f.endsWith(".json")).sort();
    if (!json.length) continue;
    return Promise.all(json.map(async (f) => Recording.parse(JSON.parse(await readFile(join(dir, f), "utf8")))));
  }
  return [];
}
