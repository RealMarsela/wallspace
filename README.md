# Wallspace

Wallspace picks the billboards, bus shelters and digital screens where a brand's audience lives, and writes a line of
copy for each face from what that block loves. It works from aggregate taste by place. It never uses device or person
location, and it never targets anyone by identity.

**Live:** https://wallspace.pages.dev. The landing view is a sample plan for "Porchlight Comedy Tour", a fictional
touring act playing Atlanta.

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
| Copy per face | `nvidia/Nemotron-3_5-Lightning` | The small, fast Nemotron: three lines of at most 7 words, each checked by the guard |
| Budget split | Wallspace optimiser | No neighbourhood takes more than 30% of spend |
| Plan review | `nvidia/Nemotron-3-Ultra-550b-a55b` | The largest Nemotron. It flags clashing copy on nearby faces, budget sense and brand fit, and flagged faces are redrafted |

The run executes as a Cloudflare Workflow. Progress streams to the page over a Durable Object WebSocket.

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

## Connected to the tools buyers already use

Plans go out to these tools and replies come back, so nobody copies data between apps by hand.

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
- **Qloo data.** Qloo responses are cached and capped. Where no recorded response exists, cards are labelled "synthetic
  sample".
- **Not built yet.** Live inventory availability, measurement and programmatic DOOH delivery.

## Stack

- **App:** Next.js on Cloudflare Workers via OpenNext, behind a Pages front.
- **Cloudflare services:** Workflows, Durable Objects, D1, KV, R2 and cron triggers.
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
