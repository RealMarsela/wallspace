# Wallspace: feedback for Nebius Token Factory and Serverless Jobs

Collected while building Wallspace on 30 Oct 2026 (Kuala Lumpur time). Every item names the request ids we saved (`x-request-id` response header from
`https://api.tokenfactory.nebius.com/v1/`; `x-inference-id` equals the `chatcmpl-` id). Models: `nvidia/Nemotron-3_5-Lightning`,
`nvidia/Nemotron-3.5-Super-VL`, `nvidia/Nemotron-3-Ultra-550b-a55b`, `Qwen/Qwen3-Embedding-8B`. Numbers are from our own run logs
(`run-sample` on https://wallspace.pages.dev/app/runs/run-sample records model, tokens, ms, cost and request id for every call).

## 1. Lightning writes its chain of thought into `content` unless reasoning is switched off two ways
- Request `740653b6ba5604933d3d1c6e2e027a51`: one-line billboard copy, `max_tokens` 60, default settings. Result: `finish_reason: length`, `content` begins
  "Here's a thinking process: 1. **Analyze User Request:** ...", `usage.completion_tokens_details.reasoning_tokens` 60 of 60, while `reasoning` and `reasoning_content` are `null`.
- Expected: thinking returned in `reasoning_content` (or not generated for a model sold as a fast tier), and `content` holding only the answer.
- What works: sending both `reasoning_effort: "none"` and `chat_template_kwargs: {"enable_thinking": false}`. We found that by trial; we did not find a Lightning-specific
  note on it. With it, a copy call is about 100 completion tokens and 0.6 to 1.2 s. A documented switch (and a response that separates thinking) would save every user an afternoon.

## 2. Lightning does not hold a word limit, and a schema cannot express one
- Our copy prompt says "at most 7 words per line" and gives two examples. In the sample plan's 22 Lightning copy calls, 8 returned at least one line over 7 words (each retried once by us)
  (e.g. `804eae563ce586d87e4ada11aeb71d09`, `36e849baebcbeb8b115a9a95c9e75e75`, `7d8e205e19ca34a614a6a8edbe471162`, `824322fe91622026694a1086394ccc13`).
  The very first probe, `3edf1a441064544fd9a29120c58dd7ea`, answered "Atlanta laughs: Come for the heat, stay for the jokes." (9 words) to a 7-word request.
- Expected: a hard limit in the prompt to hold, or a way to enforce it. `response_format: json_schema` accepts `maxLength` but not a token or word limit, so we validate with zod
  and retry once (each failure shows on our run panel). Guided decoding by regex, or a `max_words`-style constraint, would remove the retries.

## 3. Ultra with thinking on can spend the whole `max_tokens` and return nothing usable
- Requests `8b18b328681512774af497aa20bb9113` and `cb1c739b7e211919e09db6c7cf536992`: plan review, `max_tokens` 3000, default thinking. Both used 3000 completion tokens
  (about $0.0104 and $0.0109, 6.9 s each) and returned no JSON; the answer never started. With `max_tokens` 7000 the same prompt succeeds (e.g. `884027f8134f8527b9ea1a28983f9ef1`:
  2809 completion tokens, 6.6 s) and cost varies run to run from $0.004 to $0.017.
- Expected: reasoning tokens that do not starve the answer, or a documented reasoning budget (we only tested "none" and the default). We now size `max_tokens` generously and retry once with thinking off.

## 4. What worked well (worth keeping)
- Strict `json_schema` response format was accepted by Lightning, Super VL and Ultra, and every JSON answer parsed on the first try apart from the length issue in item 2.
- Super VL function calling: parallel tool calls with valid arguments in one turn, thinking off, 714 ms (`7583a1688d03ec08c606c89a7645bec8`); our planner agent drives Qloo tools with it.
- Super VL image input: three Wikimedia photos read as sightline / clutter / share of frame, 2.0 to 3.7 s and 1,292 to 1,412 prompt tokens each, about $0.0004 per read
  (`9a6947fb9977a2e2a9a2f03a7949e285`, `d929c6c8db317c9e35eeff8c6bfd6f95`, `650051b981492943310205040ae420a3`).
- Rate-limit headers (`x-ratelimit-*`, including the dynamic scale and period usage) on every response made it easy to stay frugal on a quota shared by six products.

## 5. Embeddings: `dimensions` works but is not visible in the catalogue
- `Qwen/Qwen3-Embedding-8B` returns 4096 numbers by default (`38ad6491257070bc26434ac645cc3535`, 278 ms). Adding `"dimensions": 512` returned 512 numbers with a 200. We use 512 so a cached
  tag vocabulary stays small in KV. We learned it by trying; `models_info` does not list it. Please document the parameter (and the Matryoshka sizes that are quality-safe).
- There is no reranker or NVIDIA embedding model in the catalogue, so "NVIDIA embedding and rerank" is not possible on Token Factory; we label Qwen3 as not an NVIDIA model and rank by cosine.

## 6. Model removal date falls inside the judging window
- `nvidia/nemotron-3-super-120b-a12b` and `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` leave Token Factory on 9 Nov 2026, before judging (1 to 16 Dec). We avoid both. Request: a `deprecated_at` field
  in `/v1/models` or `models_info`, and a response header on calls to a model that is scheduled for removal, so an app notices before the day.
- Casing is easy to get wrong: `nemotron-3-super-120b-a12b` (lowercase), `Nemotron-3.5-Super-VL` (dot), `Nemotron-3_5-Lightning` (underscore).

## 7. Serverless Jobs: start-up latency, quota and the CLI
- Our NeMo Guardrails job (python:3.12-slim, `cpu-d3` 2vcpu-8gb, files injected, started from `nebius ai job create`): red-team job `wallspace-nemo-red-team-202610301431`
  (`aijob-e04v74xh9f39pppqdd`) was COMPLETED about 3.5 minutes after creation for roughly 25 seconds of work: provisioning about 100 s, image pull about 55 s, then pip install and run. The sign-off job
  `wallspace-nemo-sign-off-202610301442` behaved the same. A warm-pool option or a smaller start-up for CPU jobs would make jobs usable in a live demo.
- The account allows 2 concurrent instances in total (`ResourceExhausted`, `compute.instance.count`) and our job waited behind other teams' jobs until a slot freed. A clearer quota message (current usage, who holds it) would help.
- `nebius ai job create` has no `--no-output` (the older `job run` does, to avoid creating a managed bucket); `--timeout` has a one-hour floor; `--inject-file` is limited to 64 KiB per file (documented in help,
  which we appreciated); the job's exit code is not obvious in `job get` (we read `status.state`).
- Workload logs through `nebius ai job logs` arrived reliably with timestamps; that made the round trip debuggable.

## 8. The control plane returns 522 from Cloudflare Workers, so an edge app cannot start a job
- Found by our coordinator on 30 Oct 2026 about 02:30 MYT: from a deployed Cloudflare Worker, requests to `auth.eu.nebius.com`, `auth.nebius.com`, `api.nebius.cloud` and `api.eu-north1.nebius.cloud` time out with a
  Cloudflare 522, while Token Factory (`api.tokenfactory.nebius.com`) answers normally from the same Worker. The same calls work from a laptop.
- Consequence: Wallspace cannot press "Sign off" and have a job start itself; we start the NeMo job from the Nebius CLI on demand and the job reports back to our `/api/ingest/nemo`. Expected: the control
  plane reachable from major edge runtimes, or a signed webhook / HTTP trigger that starts a prepared job from an edge function with a narrow token.
- Related gotcha for job authors: a job posting to a Cloudflare-fronted app with Python's default `urllib` User-Agent gets "Error 1010: Access denied" (browser-signature block) at the edge of the receiving
  site (ours: Cloudflare error instance `a5285ea99d716f14`, job `wallspace-nemo-red-team-202610301426`). That is the receiving site's WAF, not Nebius, but it will bite many job templates: a one-line note in the jobs
  docs ("set a User-Agent when calling Cloudflare-protected hosts") would save time.

## Latency and cost, measured (live, from our run logs)
| Call | Model | Typical | Tokens | Cost |
|---|---|---|---|---|
| Brief guard, ambiguous word | Lightning, thinking off | 1.0 to 1.2 s | about 200 | under $0.0001 |
| Copy, 3 lines per face | Lightning, thinking off | 0.6 to 2.2 s (4.6 s worst) | 500 to 750 in, 100 to 125 out | about $0.00006 |
| Planner tool call | Super VL, thinking off | 0.7 to 1.1 s | 280 to 760 in | about $0.0002 to 0.0003 |
| Site photo read | Super VL, image | 2.0 to 3.7 s | about 1,300 to 1,400 in | about $0.0004 |
| Whole-plan review | Ultra, thinking on | 4.4 to 14.3 s | 350 to 1,900 in, 1,200 to 2,800 out | $0.004 to $0.017 |
| Vocabulary and brief embeddings | Qwen3-Embedding-8B | 0.3 to 1.6 s | under 40 | under $0.000001 |
| A whole plan (12 faces, about 45 calls) | all | about 35 s wall | | $0.013 to $0.023 |
