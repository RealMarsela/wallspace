// Turns this product's 200 answers in the shared probe ledger into replay recordings, keyed by Wallspace's own request key.
//   npx tsx scripts/qloo-record.mts            -> fixtures/qloo-private/recordings/<name>.json (gitignored: real Qloo bodies, private)
// Then `npx tsx scripts/qloo-load-replay.mts --dir fixtures/qloo-private/recordings` loads them into the WS_KV namespace.
// Only rows with product "wallspace" and status 200 are used; errors are never replayed. Real recordings are never marked `default`,
// so a request without its own recording still falls back to the labelled synthetic set, never to another place's real answer.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Recording } from "../src/server/qloo/types";

const PROBE = process.env.QLOO_PROBE_DIR ?? "../../qloo-probe";
const OUT = "fixtures/qloo-private/recordings";

type Params = Record<string, string | number | boolean>;
const kindOf = (endpoint: string, p: Params): string => {
  if (endpoint === "/search") return "search";
  if (endpoint === "/entities") return "entities";
  if (endpoint === "/v2/tags") return "tags";
  if (p["filter.type"] === "urn:heatmap") return "heatmap";
  if (p["filter.type"] === "urn:tag") return p["signal.location.query"] ? "city-tags" : "tags-by-place";
  if (p["filter.type"] === "urn:entity:brand") return p["feature.explainability"] ? "explain" : "brands-by-place";
  throw new Error(`no kind for ${endpoint} ${JSON.stringify(p)}`);
};

mkdirSync(OUT, { recursive: true });
let n = 0;
for (const line of readFileSync(join(PROBE, "ledger.jsonl"), "utf8").split("\n").filter(Boolean)) {
  const d = JSON.parse(line) as { t: string; product: string; name: string; endpoint: string; params: Params; status: number; file: string };
  if (d.product !== "wallspace" || d.status !== 200) continue;
  const rec = Recording.parse({
    kind: kindOf(d.endpoint, d.params), endpoint: d.endpoint, params: d.params,
    response: JSON.parse(readFileSync(join(PROBE, d.file), "utf8")), recordedAt: d.t,
  });
  writeFileSync(join(OUT, `${d.name}.json`), JSON.stringify(rec));
  n++;
}
process.stdout.write(`${n} recordings -> ${OUT}\n`);
