# Cloudflare runbook

Production is moving from Vercel to Cloudflare (see
`docs/superpowers/plans/2026-09-25-vercel-to-cloudflare-migration.md`).
Account: `bddd1fc2aba4f9a4a860f934514c7f94`, workers.dev subdomain `consultant-bdd`.

## Workers

| Worker | URL | Config |
|---|---|---|
| `hemoedge` (app) | https://hemoedge.consultant-bdd.workers.dev | `wrangler.jsonc` → built to `dist/server/wrangler.json` |
| `hemoedge-tiler` | https://hemoedge-tiler.consultant-bdd.workers.dev | `workers/tiler/wrangler.jsonc` |

Tiling runs in GitHub Actions (`.github/workflows/tiling.yml`), started by the tiler.
The tiler authenticates runs by their GitHub OIDC token, so GitHub stores no secrets.

## Configuration

A deploy replaces all plain `vars` with what is in the config file, so plain vars
live only in the config file. Secrets survive deploys.

**App (`hemoedge`)**
- Plain vars (`wrangler.jsonc`): `R2_BUCKET_NAME`, `R2_PUBLIC_URL`, `TILER_URL`.
- Build-time (inlined by `npm run build:cf`, must be in the build environment):
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (same values as `ci.yml`).
- Secrets: `TILER_SECRET`, `TILING_CALLBACK_SECRET`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`,
  `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`; optional `EMAIL_FROM`
  (defaults to `HemoEdge <notifications@hemoedge.com>`), `ENQUIRY_NOTIFY_EMAIL`.

**Tiler (`hemoedge-tiler`)**
- Plain vars (`workers/tiler/wrangler.jsonc`): `APP_URL` (where outcomes are relayed:
  the production app), `R2_BUCKET_NAME`, `R2_PUBLIC_URL`, `GITHUB_REPO`, `GITHUB_WORKFLOW`, `GITHUB_REF`.
- Secrets: `TILER_SECRET` and `TILING_CALLBACK_SECRET` (same values as the app's),
  `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `GITHUB_DISPATCH_TOKEN`
  (fine-grained PAT: repo `optymumss/Hemoedge` only, Actions read & write).

Set a secret: `npx wrangler secret put NAME --config <config>`, or in the dashboard under
Workers & Pages → Worker → Settings → Variables and Secrets (type **Secret**).

## Deploy

```bash
# App: build with the NEXT_PUBLIC_* vars exported, then deploy the build as is
npm run build:cf && npm run deploy:cf:ci     # or: npm run deploy:cf
# Tiler
(cd workers/tiler && npm ci && npm run deploy)
```

`vinext-cloudflare deploy` rebuilds unless it is passed `--skip-build`, and that rebuild
would not include the `NEXT_PUBLIC_*` values. `deploy:cf:ci` passes the flag.

## Logs

```bash
npx wrangler tail hemoedge                 # app
npx wrangler tail hemoedge-tiler           # tiler (dispatches, runner calls, callback relays)
```

Tiling runs: GitHub → Actions → "Tile slide". The run log shows only an opaque job
token and "Tiling finished." A failed run's error text (the last 2 KB of the script
log) is stored on the tiling job and shown in `/admin/slides`.

## Plan limits

- Free plan: 10 ms CPU per request. Measured on the app on 2026-09-26: warm SSR
  requests to `/` and `/login` use about 21 ms (median), and cold ones 70–170 ms.
- The compressed script is 858 KiB, under the free plan's 3 MB limit.
