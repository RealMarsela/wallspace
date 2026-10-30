# Wallspace

Wallspace picks the billboards, bus shelters and digital screens where a brand's audience lives, and writes a line of
copy for each face from what that block loves. It works from aggregate taste by place. It never uses device or person
location, and it never targets anyone by identity.

**Live:** https://wallspace.pages.dev. The landing view is a sample plan for "Porchlight Comedy Tour", a fictional
touring act playing Atlanta. Wallspace is free to use for the hackathon demo.

## Try it (judge access)

- **No sign-in needed for the sample.** `/sample` is the read-only sample plan with every face, its evidence, three copy
  lines, nearby events and the site-photo check. `/sample/run` is its run trace.
- **Your own plan.** Create a free account at `/signin?mode=sign-up`: e-mail and password, instant, no e-mail
  verification. Each account gets its own workspace and goes through onboarding; then `/app/new` takes an audience
  described by what it loves, a budget and flight dates.

## Who it's for

- **Brands, agencies and touring acts.** You describe your audience by what it loves ("stand-up comedy specials, 90s
  sitcoms, southern hip-hop"), set a budget and flight dates, and get back a ranked, budgeted plan. Every face comes with
  its evidence, three copy lines, events nearby during the flight, and a site-photo check.
- **Independent media owners.** For each face, an audience card shows what the people who live around it love, and which
  brands' fans over-index there, so the owner can pitch it.

## How a plan is made

Each step below is logged in a run trace, which shows the model, tokens, time, cost and provider request ID.

| Step | What runs | What it is |
|---|---|---|
| Taste-only guard | Our code applying the NeMo policy (`jobs/nemo/policy`), with Lightning for ambiguous wording | Refuses targeting by race, religion, sexuality, health or other identity, and suggests a taste-based brief instead |
| Brief → Qloo tags | `Qwen/Qwen3-Embedding-8B` on Nebius Token Factory (not an NVIDIA model) | Maps free text to Qloo tags by cosine similarity |
| Where the audience lives | Qloo Insights API, `filter.type=urn:heatmap` | Qloo Taste AI: cross-domain taste data aggregated by place |
| Score every face | Wallspace scorer | Affinity of the face's cell, visibility weight and cost |
| Plan the run, read site photos | `nvidia/Nemotron-3.5-Super-VL` | NVIDIA's vision-language Nemotron. It decides which faces to inspect and drops faces with a blocked sightline |
| What each block over-indexes on | Qloo `urn:tag` with `signal.location` | Taste tags around each face |
| Events during the flight | Tavily Search and Extract, triaged by Lightning | Web search API for agents, cached by neighbourhood and month |
| Copy per face | `nvidia/Nemotron-3_5-Lightning` | The small, fast Nemotron: three lines of at most 7 words, each checked by the guard. A line over 7 words is rejected and redrafted, never trimmed; a face still failing is flagged "Copy needs a human" |
| Budget split | Wallspace optimiser | No neighbourhood takes more than 30% of spend |
| Plan review | `nvidia/Nemotron-3-Ultra-550b-a55b` | The largest Nemotron. It flags clashing copy on nearby faces, budget sense and brand fit, and flagged faces are redrafted |

The run executes as a Cloudflare Workflow. Progress streams to the page over a Durable Object WebSocket. If an optional
model returns 404, the run logs "skipped (model unavailable)" for that step instead of failing.

## Qloo

Qloo runs live in production (`QLOO_MODE=live`). A Cloudflare KV cache of real Qloo responses sits in front of it and
protects the hackathon key's limits (1,500 Qloo calls a day, 6,000 in total). If a Qloo call fails, the UI shows an
error with Retry; Wallspace never invents Qloo data.

## The sample plan

The sample plan ("Porchlight Comedy Tour", a sample brand) was rebuilt from a live run on 30 Oct 2026: 8 picks, $33,189
of a $40,000 budget, 86 faces scored and 1 dropped for a blocked sightline. The run has 36 steps and 21 model calls, took
about 67 s and cost $0.0099. Nemotron 3 Ultra flagged four faces for clashing copy on nearby boards and all four were
redrafted. NeMo Guardrails signed off 24 of 24 lines (job `wallspace-nemo-sign-off-202610302317`). Live numbers are on
`/limits`.

## NVIDIA and Nebius

- **Nebius Token Factory** serves all four models above through its OpenAI-compatible API.
- **NeMo Guardrails 0.24.1** (NVIDIA's open-source rails library) runs as a **Nebius Serverless Job** (`jobs/nemo/`) in two
  modes:
  - **Sign-off.** It checks every copy line of a plan the planner has marked "Sign off for print", then stamps the plan
    "NeMo-checked" with the job ID.
  - **Red-team.** It runs 40 prompts and publishes the catch and false-positive rates on `/limits`.
- **How the job is started:** from the Nebius CLI, on demand (`scripts/nebius-job.mts`, run as a service account). It is
  never started on a schedule or by the app. The job reads waiting lines from `/api/ingest/nemo` and posts its results
  back to the same route, authenticated with a shared secret. The app never calls the Nebius control plane.
- **Nightly re-scan.** A Cloudflare cron runs a Workflow at 03:00 Kuala Lumpur time. It re-scores saved plans through
  Token Factory and flags faces whose audience has shifted.

## Fine-tuned billboard-copy model (NVIDIA Nemotron, LoRA)

Jobs: GPU `aijob-e00rrh69z5b8mkd9qh`, data generation `aijob-e04v8hyr20ak0h7ng6` (30 Oct 2026, both deleted after their logs were read). The training code and dataset are not in this repo.

**What was tuned.** `nvidia/Llama-3.1-Nemotron-Nano-4B-v1.1` (NVIDIA open-weight, 4B, Llama architecture; NVIDIA Open Model License plus the Llama 3.1 Community License) was LoRA fine-tuned (r=16, 30,408,704 trainable parameters, 2 epochs) to write three billboard lines from a structured face spec: face type, neighbourhood archetype, 2-3 taste labels, brand category and campaign line. Each line must be at most 7 words, a complete phrase, taste-based and never targeting identity. It is a distillation: the teacher is `nvidia/Nemotron-3-Ultra-550b-a55b` on Nebius Token Factory.

**Data provenance.** Every training token comes from Nemotron on Token Factory. Nemotron wrote the vocabularies (neighbourhood archetypes, taste labels, brand categories, campaign lines) and the adversarial client notes; our code only composed specs from those lists and split them. The teacher's outputs were kept only if they passed the deterministic checks (valid JSON, 7-word limit, complete-phrase check, and the taste-only guard ported from Wallspace's policy). No Claude-written text, no Qloo data, no Tavily data, no personal data. Splits: 2186 train + 147 adversarial-train, 76 validation, 200 held-out test specs (campaign lines never seen in training) and 60 adversarial test specs. Exact spec overlap across splits: 0; highest near-duplicate similarity (Jaccard) of a test or validation spec to any training spec: 0.5.

**How it ran.** Two Nebius AI Cloud Serverless Jobs, started with the Nebius CLI: a CPU job (data generation, 8 min, Token Factory cost at most about $1.4 at assumed prices) and one `gpu-h100-sxm` job in eu-north1 (`aijob-e00rrh69z5b8mkd9qh`, 8 min running, about 12 min from submission including provisioning, image pull and the 2.5 min model download; LoRA training 200 s; GPU cost about $0.4-0.6). Base and tuned models were evaluated in the same job on the same held-out set with the same prompt and greedy decoding.

| Metric (200 held-out specs unless noted) | Base, zero-shot | LoRA-tuned |
|---|---|---|
| JSON valid | 95.0% | 100.0% |
| All 3 lines at most 7 words | 1.0% | 99.5% |
| All 3 lines complete phrases | 94.5% | 100.0% |
| Guard violation (identity terms or claims), lower is better | 0.5% | 0.5% |
| All checks passed together | 1.0% | 99.0% |
| Adversarial pass rate (60 identity-tempting briefs) | 1.7% | 98.3% |
| Adversarial guard violation, lower is better | 3.3% | 0.0% |
| Latency per sample, batch 1 (H100) | 1.29 s | 0.55 s |
| Latency per sample, batch 32 (H100) | 102 ms | 41 ms |

Validation loss on the teacher's lines: 6.10 base, 1.77 tuned. Latency is the mean over 24 single prompts (batch 1) and over all 260 prompts (batch 32), greedy decoding, 110 new tokens at most; the base model's higher latency is largely because it writes longer, over-limit lines, not a faster or slower architecture. The guard violation rate on regular specs is a tie (1 of 200 for both); the base model's adversarial pass rate is low mainly because its lines break the 7-word limit, and on guard alone it leaks identity terms in 3.3% of adversarial briefs against 0% tuned.

**Honest limits.** The specs are random combinations of generated labels, so some pairings are incoherent; the guard is a deterministic word-and-pattern check (conservative: it also counts ambiguous nationality words), not a full judgement of meaning; the adversarial set is Nemotron-generated and small (60). The tuned model is not serving in the live app: Wallspace's copy step still calls Nemotron on Token Factory, because serving a custom adapter would need a dedicated endpoint. Single run, no seeds repeated.

## Connected to the tools a media team already uses

Plans go out to these tools and replies come back, so nobody copies data between apps by hand. Gmail is the only
connector tested end to end. Outlook, HubSpot, Google Sheets, Google Calendar and Outlook Calendar are built and
connectable but untested with live accounts. Slack approval is tested with signed test requests and is not installed in a
live workspace.

| Tool | What Wallspace does | How replies come back |
|---|---|---|
| Slack (own app) | Sends an approval message with Approve and Request changes buttons | Interactivity endpoint, signed requests |
| Gmail, Outlook (via Composio) | Emails the plan to a media owner or client, and sends media-owner pitch sheets | Replies are polled, then classified by Lightning as confirmed, counter-offer, unavailable or question |
| HubSpot (via Composio) | Creates the company, contact and deal, with a note listing faces and copy | Deal stage is polled |
| Google Sheets (via Composio) | Exports the plan, one row per face, plus a summary tab | Cost and copy edits are polled |
| Google Calendar, Outlook Calendar (via Composio) | Adds creative-due, posting and takedown events | Changes are polled |
| OpenOOH deal request | `GET /api/plans/:id/export.openooh.json` returns an OpenRTB 2.6-shaped venue list in the OpenOOH taxonomy, for hand-off to DOOH platforms | Prepared only, not submitted to any exchange |

Read-back is polled on a 10-minute cron and when a plan page is open. We don't call it real time where it isn't.

## Honest limits

See https://wallspace.pages.dev/limits for live numbers.

- **Inventory.** Atlanta only. 46 faces sit at real OpenStreetMap billboard positions. 40 more are sample faces on real
  streets. Sizes, rates and owners are sample values and labelled as such.
- **Photos.** Site photos are illustrative Wikimedia Commons images, not the exact site, and each is credited.
- **Qloo data.** Live, with a KV cache of real responses, capped at 1,500 calls a day and 6,000 in total. If a call fails
  the UI shows an error with Retry, never invented data. The brand, face sizes, rates and owners are sample business data,
  not Qloo output.
- **Not built yet.** Live inventory availability, measurement and programmatic DOOH delivery.

## Stack

- **App:** Next.js on Cloudflare Workers via OpenNext, behind a Pages front.
- **Cloudflare services:** Workflows, Durable Objects, D1, KV (including the Qloo cache), R2 and cron triggers.
- **Accounts:** e-mail and password sign-up; each account has its own workspace.
- **Map:** MapLibre with OpenFreeMap tiles.
- **Jobs:** Python only in the Nebius job.
- **Deploy:** see `docs/DEPLOY.md`. Build rules: `docs/BUILD.md`.

## Data and credits

- Billboard positions © OpenStreetMap contributors (ODbL).
- Neighbourhoods: City of Atlanta.
- Map tiles: OpenFreeMap.
- Photos: Wikimedia Commons, with authors and licences credited per photo.
- Taste data: Qloo.

## Licence

MIT
