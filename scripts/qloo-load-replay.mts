// Loads private Qloo recordings into the production KV namespace (WS_KV) for replay mode.
//   npx tsx scripts/qloo-load-replay.mts [--dir fixtures/qloo-private] [--dry-run]
// Each *.json in the directory is a Recording (src/server/qloo/types.ts): { kind, endpoint, params, response, default? }.
// Writes qloo:v1:<hash of the normalised request> for every file, and qloo:v1:default:<kind> for files with default: true.
// Private recordings never enter git (fixtures/qloo-private is ignored). The API key is not used here, only the Cloudflare token.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadRecordings } from "../src/server/qloo/replay";
import { defaultKey, requestKey } from "../src/server/qloo/request-key";

const args = process.argv.slice(2);
const dir = args.includes("--dir") ? args[args.indexOf("--dir") + 1] : "fixtures/qloo-private";
const dry = args.includes("--dry-run");

const recs = await loadRecordings([dir]);
if (!recs.length) {
  process.stderr.write(`no recordings in ${dir}\n`);
  process.exit(1);
}
const entries: { key: string; value: string }[] = [];
for (const r of recs) {
  const value = JSON.stringify(r);
  entries.push({ key: await requestKey(r.endpoint, r.params), value });
  if (r.default) entries.push({ key: defaultKey(r.kind), value });
}
process.stdout.write(`${recs.length} recordings -> ${entries.length} KV keys${dry ? " (dry run, nothing written)" : ""}\n`);
if (!dry) {
  const tmp = mkdtempSync(join(tmpdir(), "ws-replay-"));
  const file = join(tmp, "bulk.json");
  writeFileSync(file, JSON.stringify(entries));
  try {
    execFileSync("npx", ["wrangler", "kv", "bulk", "put", file, "--binding", "WS_KV", "--remote"], { stdio: "inherit" });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
