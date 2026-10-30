# Wallspace deploy (lane B1)

Live: https://wallspace.pages.dev (Pages project `wallspace`, service binding `APP` to Worker `wallspace`, `workers_dev = false`).

| Piece | Where |
|---|---|
| Worker | `wrangler.jsonc`, entry `worker/index.ts` (OpenNext worker + Durable Objects + Workflows + cron) |
| Pages front | `edge/pages/` (`public/_worker.js`, `wrangler.toml`) |
| D1 `wallspace` (WS_DB) | `migrations/*.sql`, applied with `scripts/deploy-prod.sh --migrate` (never edit an applied file; add the next number) |
| KV (WS_KV), R2 `wallspace-blobs` (WS_BLOB) | created once with wrangler |
| Durable Objects | `RunRoom`, `TavilyBudget` (B2), `QlooMeter` (B1: hard Qloo cap, 300 total / 60 a day, vars `QLOO_CAP_TOTAL`, `QLOO_CAP_DAY`) |
| Workflows | `wallspace-plan-run`, `wallspace-rescan`, `wallspace-eval-run` |
| Crons | `0 19 * * *` (03:00 Kuala Lumpur: re-scan + polls), `*/10 * * * *` (connector read-back polls) |

Commands (credentials come from the vault, never printed):

- `scripts/deploy-prod.sh` builds the committed HEAD with `NEXT_PUBLIC_DATA_MODE=app`, deploys the Worker, then the Pages front. `--worktree` builds the working tree, `--pages-only`, `--migrate`.
- `scripts/deploy-secrets.sh [NAME ...]` pushes Worker secrets from the vault (missing or empty names are skipped).
- `scripts/qloo-load-replay.mts [--dir fixtures/qloo-private] [--dry-run]` loads private Qloo recordings into KV for replay.
- Pages project creation, once: `wrangler pages project create wallspace --production-branch main --force` (`--force` only for that first creation; plain `pages deploy` from the repo would pick up the Worker's root `wrangler.jsonc`, so the script deploys from a temp copy of `edge/pages`).

Rules learned: `cacheComponents` must stay off in `next.config.ts` (page renders hang on OpenNext + Workers). The Nebius control plane is never called from a Worker.

## Frozen copy for the Nebius submission

`scripts/deploy-nebius-freeze.sh` deploys the committed HEAD as a second Worker, `wallspace-nebius`, and serves it at https://nebius.wallspace.pages.dev (the `nebius` branch alias of the Pages project `wallspace`). Re-run it at submission time (target 21:00 Fri, nothing after 01:00 Sat); production keeps moving for Qloo polish.

- **Data is a snapshot, taken at every run:** D1 `wallspace-nebius` and KV namespace `WS_KV_NEBIUS` are bound to the frozen Worker (binding names unchanged: `WS_DB`, `WS_KV`). The script exports production D1 (`wrangler d1 export wallspace --remote`), drops every table in `wallspace-nebius` and imports the export (an exact copy, never a merge), then copies every production KV key with its value and expiry (`scripts/_freeze-kv.mjs`, stale keys removed). Later production re-seeds, evals, cache writes and ledger rows never reach the frozen copy. Verified: a marker row written to production D1 after the freeze is absent from `wallspace-nebius`.
- **R2 stays shared** (`wallspace-blobs`): the photos do not change after the freeze. Do not overwrite `photos/*` afterwards.
- The frozen Worker writes its own ledger, runs and cache entries into its own D1/KV, so judges' activity there does not show on production's limits page.
- **Also separate:** the Worker script, its Durable Object namespaces (same class names, own state, so the Qloo cap and Tavily ledger count per Worker), and the Workflows, renamed `wallspace-nebius-plan-run`, `-rescan`, `-eval-run`. `APP_URL` is the nebius URL.
- **No crons** on the frozen copy: production's `*/10` and nightly crons already read and write the shared D1, and two schedulers would double every poll and re-scan.
- **Secrets:** the script runs `WS_WORKER_NAME=wallspace-nebius scripts/deploy-secrets.sh` (same vault names as production; missing names are skipped and listed). `--no-secrets` skips it.
- **Pages alias:** a branch deployment is a preview deployment, which has its own bindings. The script sets the project's preview service binding `APP -> wallspace-nebius` through the Pages API (production binding `APP -> wallspace` is untouched) and deploys a directory holding only `_worker.js` with `--branch nebius`. Any other non-production Pages branch would also reach the frozen Worker.
- **Source of truth:** `git archive HEAD`, so uncommitted edits are never frozen. Check `git log -1` before running; the script prints the frozen short SHA.
- Callbacks and webhooks (Composio OAuth, Slack interactivity) still point at production; the frozen copy is for judging the product, not for connecting new accounts.

## Accounts (lane B5)

Free product: Better Auth (email + password; Google when both keys exist) on D1 `WS_DB`, migration `0005_auth_workspaces.sql`. Sessions are 14-day httpOnly SameSite=Lax cookies (`__Secure-` on https); sign-up and sign-in are rate limited per IP in KV.

- Worker secrets: `WALLSPACE_AUTH_SECRET` (required, 32+ chars, vault name the same), optional `WALLSPACE_GOOGLE_CLIENT_ID` and `WALLSPACE_GOOGLE_CLIENT_SECRET`; `scripts/deploy-secrets.sh` pushes them. Google appears only when both are set.
- Google OAuth client (web): authorized JavaScript origin `https://wallspace.pages.dev`; authorized redirect URI `https://wallspace.pages.dev/api/auth/callback/google` (local: `http://localhost:3207` and `http://localhost:3207/api/auth/callback/google`).
- `next dev` has no D1 binding: auth uses a SQLite file under os.tmpdir() (`AUTH_DEV_DB` overrides) with `migrations/*.sql` applied. A local preview needs `WALLSPACE_AUTH_SECRET` in `.dev.vars` (gitignored).
- e2e: build with `NEXT_PUBLIC_DATA_MODE=app opennextjs-cloudflare build`, `wrangler d1 migrations apply WS_DB --local`, `opennextjs-cloudflare preview --port 3207`, then `npx playwright test` (`E2E_BASE_URL` retargets it).

## Routes and auth (lane B7)

- Public: `/`, `/signin` (sign-in and sign-up, `?mode=sign-up`, `?next=` only for paths under `/app`), `/sample` (the read-only sample plan; `/sample/faces/:id`, `/sample/run`), `/faces/:id` (shareable audience card, the link in pitch e-mails), `/limits`, `/privacy`, `/terms`. Product: everything under `/app/*` (`/app/new`, `/app/plans/:id`, `/app/runs/:id`, `/app/compare`, `/app/connections`, `/app/owner`, `/app/onboarding`).
- `src/middleware.ts` (edge, a cookie check only): no session cookie on `/app/*` redirects to `/signin?next=`; no cookie on a non-allow-listed `/api/*` route answers 401 `{ error, code }`. The allow-list is `src/server/auth/public-api.ts`; every open route keeps its own check (Bearer, Slack/Composio signature, sample-only reads). A present but invalid cookie passes the middleware and is refused by the handlers (401) and by the client guard `AppGuard` in the `/app` layout, which calls `/api/me` once (shared by all links through `src/lib/use-me.ts`).
- Permanent (308) redirects in `next.config.ts`: `/sign-in`, `/sign-up`, `/onboarding`, `/owner`, `/owner/faces/:id`, `/app/plans/plan-sample[/faces/:id]`, `/app/runs/run-sample`. Links the backend sends: plan links `/app/plans/:id`, pitch links `/faces/:id`, OAuth return `/app/connections` (signed out: `/signin?next=/app/connections`).
- `middleware.ts` is Next 16's deprecated name (edge runtime, fully supported by OpenNext); `proxy.ts` would run on Node, which OpenNext on Cloudflare marks experimental.
