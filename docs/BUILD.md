# Wallspace build rules (binding for every lane)

Product: picks billboards and street furniture where a brand's audience lives (Qloo taste by place) and writes copy per face.
Demo city Atlanta. Taste only, never identity. Judge URL https://wallspace.pages.dev. Plan: ../plan/wallspace-plan.html.
Next.js 16.4 has breaking changes: read node_modules/next/dist/docs/ for any API you are unsure of before writing it.

## Stack
Next.js on Cloudflare Workers via OpenNext; Workflows (plan run, nightly re-scan, eval); a Durable Object per run for live
progress (hibernating WebSocket); D1 (plans, briefs, runs, faces, connections); KV (Qloo + Tavily cache); R2 (photos, creative);
cron trigger (nightly re-scan). A Pages project `wallspace` fronts the Worker through a service binding; the Worker has
`workers_dev = false`. No Containers, nothing always-on. Python (NeMo Guardrails) only as a Nebius Serverless Job started from
the CLI on demand; it reads/writes /api/ingest/nemo with INGEST_SECRET. No Worker calls the Nebius control plane (522).

## Models (Token Factory, https://api.tokenfactory.nebius.com/v1/, Bearer NEBIUS_API_KEY)
- nvidia/Nemotron-3.5-Super-VL: planning agent + site-photo / creative read.
- nvidia/Nemotron-3_5-Lightning (underscore): copy lines, Tavily triage; thinking off.
- nvidia/Nemotron-3-Ultra-550b-a55b: one review pass over the finished plan.
- Qwen/Qwen3-Embedding-8B: free-text brief -> Qloo tags by cosine (not an NVIDIA model; label it).
Never use nvidia/nemotron-3-super-120b-a12b or NVIDIA-Nemotron-3-Nano-30B-A3B (removed 9 Nov). JSON mode unconfirmed: zod-validate,
retry once. Log every call as a RunStep (model, tokens, ms, cost, request id).

## Provider modes (env)
QLOO_MODE replay|live (replay = recorded responses in fixtures/qloo, built from the shared probe; live = KV-cached, hard cap),
TF_MODE replay|live, TAVILY_MODE replay|live, DATA_MODE mock|app (UI reads src/mocks in mock mode).

## Qloo credits (rule, 30 Oct)
Credits are unknown and shared with another project on the same key. No live Qloo call while building. Shapes come from the shared probe at
`../qloo-probe/SHAPES.md` outside this repo (private; raw responses never in this repo).
Wallspace may make at most 25 extra probe calls, only for shapes the probe lacks, each appended to qloo-probe/ledger.jsonl with
product "wallspace", and only by the owner session or lane B1 after the owner says go. Live Qloo only for 1-2 end-to-end tests and
the demo recording. The app enforces a hard Qloo call cap (Durable Object counter) and caches every response in KV.
Qloo base https://hackathon.api.qloo.com, header X-Api-Key, server-side only.

## Tavily (shared free key, 1,000 credits/month across six products through 15 Dec)
Cache in KV by neighbourhood+month; never call on page load; cap 3 new searches per session, 10 credits a day, Wallspace total
about 150. Tests use recorded results.

## Code
Contract first: zod in src/contract, mocks in src/mocks, then server, then UI. API errors `{ error, code? }`, never a raw error.
Files under 300 lines. No console.log in production code. Realistic data only: sample brand "Porchlight Comedy Tour (sample
brand)"; sample faces and rates labelled "sample". No payments, no pricing UI (Qloo key forbids production use).

## Secrets and accounts
- Secrets only via `~/.claude/vault/inject.sh get <NAME> --dir <dir>` (or `has NAME`) and `wrangler secret put NAME` fed from a
  pipe. Never print, log, echo or commit a secret. Store a NEW generated secret without printing it:
  `printf '%s\n' "$VALUE" | ~/.claude/vault/scripts/set-keys.py NAME` in the same command that generated it.
  Never open ~/.claude/vault/.env.master or ~/.env.secrets.
- Never run `nebius config list`, `nebius profile get`, or any command that shows a Nebius profile. Never read ~/.nebius/config.yaml
  or ~/.nebius/hackathon-jobs-sa.json. Never print an access token; pipe `nebius iam get-access-token` straight into its consumer.
  NEBIUS_SA_CREDENTIALS is never a Worker secret.
- If anything secret is ever printed, stop immediately and report it to the Wallspace owner session.
- Nebius: Serverless Jobs only, named `wallspace-*`, via `nebius --profile hackathon-jobs-sa`; delete your finished test jobs; no
  endpoints, VMs or always-on resources; never touch resources you did not create.
- Agents never create accounts or type passwords. A dashboard step becomes a blocker for the owner (exact URL + clicks); keep
  building against mocks meanwhile. Composio auth configs are named `wallspace-*`. Product vault names start with WALLSPACE_.

## Process
- Run your own dev server on your own port (UI-A 3201, UI-B 3202, B1 3203, B2 3204, B3 3205, B4 3206); record its PID; stop it by
  PID. Never pkill/killall. Never restart someone else's server.
- Commit only your own paths, by explicit path (never `git add -A`/`-a`); check `git diff` on any shared file first. Commit only in
  this repo, never in a parent folder. Author is RealMarsela <testerbuster564@gmail.com> (set locally;
  check `git config user.name` before your first commit). Message ends with
  `Claude-Session: https://claude.ai/code/session_01UimXU7EWAvt3x1RV8pvR2a`. Do not push. Only B1 deploys.
- `npm run typecheck`, `npm run lint`, `npx vitest run` green before each commit. UI lanes check every page at 390, 768 and
  1280 px and in dark mode.
- Hand back at each checkpoint: what works (verified how), commit SHAs, blockers, next.
