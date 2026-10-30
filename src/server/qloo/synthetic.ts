import { MemoryReplay, type ReplaySource } from "./replay";
import { Recording } from "./types";
import audiences from "../../../fixtures/qloo-synthetic/audiences.json";
import brands from "../../../fixtures/qloo-synthetic/brands-by-place.json";
import demographics from "../../../fixtures/qloo-synthetic/demographics.json";
import entities from "../../../fixtures/qloo-synthetic/entities.json";
import explain from "../../../fixtures/qloo-synthetic/explain.json";
import heatmap from "../../../fixtures/qloo-synthetic/heatmap.json";
import search from "../../../fixtures/qloo-synthetic/search.json";
import tagsByPlace from "../../../fixtures/qloo-synthetic/tags-by-place.json";
import tagList from "../../../fixtures/qloo-synthetic/tags.json";

// SYNTHETIC Qloo-shaped answers with invented values (fixtures/qloo-synthetic, made by scripts/qloo-make-synthetic.mts).
// Bundled so replay mode always answers: tests, `next dev` and production before the private recordings are loaded.
// Every answer built from them carries source.synthetic = true and must be labelled that way wherever it is shown.
export const syntheticRecordings: Recording[] = [audiences, brands, demographics, entities, explain, heatmap, search, tagsByPlace, tagList].map((r) => Recording.parse(r));

let cached: Promise<MemoryReplay> | undefined;
export const syntheticReplay = (): Promise<MemoryReplay> => (cached ??= MemoryReplay.from(syntheticRecordings));

/** Tries each source in order; the first that has an exact recording wins, else the first default found. */
export class ChainedReplay implements ReplaySource {
  constructor(private readonly sources: ReplaySource[]) {}
  async lookup(key: string, kind: string) {
    let fallback: Awaited<ReturnType<ReplaySource["lookup"]>> = null;
    for (const s of this.sources) {
      const hit = await s.lookup(key, kind).catch(() => null);
      if (hit?.exact) return hit;
      fallback ??= hit;
    }
    return fallback;
  }
}
