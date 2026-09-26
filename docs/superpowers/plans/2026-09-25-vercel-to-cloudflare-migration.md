# Vercel → Cloudflare Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (Inline Execution, per AGENTS.md) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run HemoEdge in production on Cloudflare Workers (app) + Cloudflare Containers (WSI tiling) instead of Vercel Functions + Vercel Sandbox, with zero user-visible behavior change, then cut the production domain over and decommission the Vercel project.

**Architecture:** The Next.js 16 app is built for Workers with **vinext** (Cloudflare's recommended Next.js-on-Workers path; it supports Next 16 `proxy.ts`, which the OpenNext adapter does not yet support — see "Adapter decision" below). The only hard Vercel lock-in, the `@vercel/sandbox` tiling pipeline, is replaced by a small separate Worker (`workers/tiler`) that owns a Cloudflare **Container** (Docker image with libvips + OpenSlide + awscli). The app starts a tiling job with an authenticated HTTPS `POST` to the tiler; the container runs the same shell pipeline and reports back to the existing `/api/tiling/callback` route exactly as today. Supabase, R2, Stripe, Resend and Anthropic stay where they are — they are already platform-neutral.

**Tech Stack:** Next.js 16.2 + vinext, Wrangler, Cloudflare Workers (Paid plan — required for Containers and for the >3 MB worker bundle), Cloudflare Containers (`@cloudflare/containers`), R2 (already in use), Workers Builds (CD) + GitHub Actions (CI), Vitest, Playwright.

## Revision 2026-09-26: tiling on GitHub Actions, Workers free plan

The target is **GitHub + Cloudflare only, on free tiers**. Cloudflare Containers need Workers Paid, so Task 3's container is replaced:

- `workers/tiler` is now a plain Worker (no Container, no Durable Object) that fits the free plan. `POST /jobs` (same contract, still answers 202) seals the job with AES-GCM (key derived from `TILER_SECRET`) and dispatches `.github/workflows/tiling.yml` via `workflow_dispatch`, using the `GITHUB_DISPATCH_TOKEN` secret (fine-grained PAT, Actions: read & write on this repo only).
- The workflow runs `workers/tiler/run-tiling.sh` on `ubuntu-24.04` (libvips + OpenSlide from apt, the runner's AWS CLI). It authenticates back to the tiler with its **GitHub OIDC token** (audience `hemoedge-tiler`, pinned to this repo, `tiling.yml`, `refs/heads/main`, `workflow_dispatch`): `POST /runner/start` returns the slide URL and R2 credentials, and `POST /runner/callback` relays the outcome to `/api/tiling/callback` with `TILING_CALLBACK_SECRET`. The job and slide ids and the manifest URL come from the sealed job, not from the runner.
- The repo is public, so nothing about a slide goes into workflow inputs or Actions logs. The run name is constant, the input is opaque, and script output goes to a file that only leaves the runner as the error text of a failure callback. GitHub stores **no** secrets.
- The Container-specific constraints below (instance type, `sleepAfter`, Dockerfile) no longer apply. The job budget is now the workflow's `timeout-minutes` (35 for the tiling step, 40 for the job), still inside the app's 45-minute stale-job window.
- App Worker size: 858 KiB compressed, under the free plan's 3 MB limit. CPU is the constraint: warm SSR requests use about 21 ms (median) against the free plan's 10 ms, and cold ones 70–170 ms. See `docs/cloudflare-runbook.md`.
- `vinext-cloudflare deploy` **rebuilds unless passed `--skip-build`**, so `deploy:cf:ci` passes it. Otherwise the deploy step's rebuild drops the `NEXT_PUBLIC_*` build-time values. In Task 5 the tiler's Workers Builds build command is just `npm ci`, since there is no Docker image any more.

## Global Constraints

- **No behavior change.** Every route, server action, auth redirect, and the tiling state machine (`queued → processing → ready|failed`, retry from the Slides admin page) must behave identically before and after.
- **`next build` must keep working** through the whole migration (CI `checks` job, Playwright `webServer`), so the Vercel deployment stays a valid rollback target until Task 7 is complete.
- `compatibility_date` = `"2026-09-25"`; `compatibility_flags` = `["nodejs_compat"]` on every Worker.
- Worker names: app = `hemoedge`, tiler = `hemoedge-tiler`.
- Container instance type `standard-2`; `max_instances` = `5`; `sleepAfter` = `"50m"` (the tiling job budget stays 45 minutes, matching `SANDBOX_TIMEOUT_MINUTES` today).
- Secrets are **never** interpolated into shell text any more — the container receives them as env vars (fixes the current `buildTilingScript` pattern that bakes R2 keys and the callback secret into a script file).
- Database: no schema changes. `tiling_jobs.sandbox_id` is reused to store the container instance id (the job id); `tiling_jobs.cmd_id` is left `null` for new jobs.
- The existing `TILING_CALLBACK_SECRET` bearer contract for `/api/tiling/callback` is unchanged.
- The Vercel project is **paused, not deleted**, for 14 days after DNS cutover.

## Adapter decision (read before Task 1)

| | vinext | OpenNext (`@opennextjs/cloudflare`) |
|---|---|---|
| Next 16 `proxy.ts` (Node runtime) | Supported | **Not supported** ("Node Middleware introduced in 15.2 are not yet supported") |
| Server actions, `revalidatePath`, `cookies()/headers()`, route handlers, `next/image` | Supported | Supported |
| Status | Beta, Cloudflare-recommended default | Maintenance path |

`src/proxy.ts` is load-bearing (Supabase session refresh + role gating for `/admin`, `/org`, `/app`), so **vinext is the primary path**. Fallback if `npx vinext check` (Task 1, Step 1) reports a blocking incompatibility: use OpenNext and rename `src/proxy.ts` → `src/middleware.ts` with `export const runtime = "edge"` semantics — the file only uses `NextResponse`, `@supabase/ssr` and `fetch`, all edge-safe. Record the decision in the PR description.

## File Map

| Path | Action | Responsibility |
|---|---|---|
| `wrangler.jsonc` | Create | App Worker config (name, compat, assets, observability, vars) |
| `vite.config.ts` | Create (by `vinext init`) | vinext + Cloudflare Vite plugin |
| `package.json` | Modify | `build:cf`, `preview:cf`, `deploy:cf`, `cf-typegen` scripts; add `vinext`, `vite`, `wrangler`; remove `@vercel/sandbox` |
| `.gitignore` | Modify | Ignore `.wrangler/`, `dist/`, `.dev.vars*`; drop `.vercel` |
| `.env.example` | Modify | Replace Vercel Sandbox block with `TILER_URL` / `TILER_SECRET` |
| `src/app/api/billing/webhook/route.ts` | Modify | `constructEventAsync` + SubtleCrypto (Workers-safe signature check) |
| `src/lib/stripe/verify-webhook.ts` + `.test.ts` | Create | Pure, tested signature-verification helper |
| `workers/tiler/wrangler.jsonc` | Create | Tiler Worker + Container + Durable Object config |
| `workers/tiler/Dockerfile` | Create | Ubuntu image with `libvips-tools`, `openslide-tools`, `awscli`, `curl` |
| `workers/tiler/run-tiling.sh` | Create | The tiling pipeline, env-var driven (successor of `build-tiling-script.ts`) |
| `workers/tiler/src/index.ts` | Create | Worker `fetch` handler + `TilingContainer` class |
| `workers/tiler/src/parse-job-request.ts` + `.test.ts` | Create | Pure auth + body validation for `POST /jobs` |
| `src/lib/tiling/trigger-tiling-job.ts` | Rewrite | Call tiler over HTTPS instead of `@vercel/sandbox` |
| `src/lib/tiling/trigger-tiling-job.test.ts` | Create | Unit tests with mocked `fetch` |
| `src/lib/tiling/build-tiling-script.ts` | Delete | Replaced by `workers/tiler/run-tiling.sh` |
| `scripts/prepare-tiling-snapshot.mjs` | Delete | Snapshot concept replaced by the Docker image; `tiling:prepare-snapshot` script removed |
| `src/lib/tiling/reconcile-stale-jobs.ts` | Modify | Comment/constant rename only (Vercel Sandbox → container) |
| `vitest.config.ts` | Modify | Also include `workers/**/*.test.ts` |
| `.github/workflows/ci.yml` | Modify | Add `build:cf` step |
| Workers Builds (dashboard) | Configure | Deploy app + tiler on `main`; preview URLs on PRs (Task 5) |
| `docs/cloudflare-runbook.md` | Create | Secrets, first deploy, cutover, rollback, decommission checklist |

---

### Task 1: Build and run the app on Workers with vinext

**Files:**
- Create: `wrangler.jsonc`, `vite.config.ts` (generated)
- Modify: `package.json`, `.gitignore`, `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: nothing.
- Produces: npm scripts `build:cf`, `preview:cf`, `deploy:cf`, `cf-typegen`; Worker name `hemoedge`. Tasks 5–6 invoke `npm run deploy:cf`.

- [ ] **Step 1: Run the compatibility check**

Run: `npx vinext check`
Expected: a report with no blocking items for `proxy.ts`, server actions, route handlers, `next/image`. If anything blocking appears, stop and switch to the OpenNext fallback described above.

- [ ] **Step 2: Read the Next 16 deployment guide shipped in the repo**

Run: `ls node_modules/next/dist/docs/ && grep -ril "adapter\|deploy" node_modules/next/dist/docs | head`
Read the deployment/adapter page(s) listed (AGENTS.md requires this before code changes). Note anything that contradicts this plan in the PR description.

- [ ] **Step 3: Initialize vinext (non-destructive)**

Run: `npx vinext init` and choose **Cloudflare Workers** as the target.
Expected: new `vite.config.ts`, new `wrangler.jsonc`, new `*:vinext` scripts in `package.json`, and `vinext`/`vite`/`wrangler` added as dependencies. `next dev`/`next build` still work.

- [ ] **Step 4: Replace the generated `wrangler.jsonc` with the canonical config**

Keep whatever `main`/`assets` values `vinext init` generated (they are adapter-specific); set everything else to:

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "hemoedge",
  // main + assets: keep exactly as generated by `vinext init`
  "compatibility_date": "2026-09-25",
  "compatibility_flags": ["nodejs_compat"],
  "observability": { "enabled": true },
  "vars": {
    "EMAIL_FROM": "",
    "ENQUIRY_NOTIFY_EMAIL": "",
    "R2_BUCKET_NAME": "",
    "R2_PUBLIC_URL": "",
    "APP_URL": ""
  }
}
```

Non-secret values are filled in during Task 6. Secrets are set with `wrangler secret put` (Task 6), never committed.

- [ ] **Step 5: Normalize the npm scripts**

In `package.json` `scripts`, keep `dev`/`build`/`start` (Next, used by CI + Playwright) and rename the generated vinext scripts to:

```json
"build:cf": "vinext build",
"preview:cf": "vinext build && wrangler dev",
"deploy:cf": "vinext build && wrangler deploy",
"cf-typegen": "wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts"
```

If `vinext init` generated a different build command (e.g. `vite build`), use that verbatim in `build:cf` and the two scripts that call it.

- [ ] **Step 6: Update `.gitignore`**

Replace the `# vercel` block with:

```gitignore
# cloudflare
.wrangler/
dist/
.dev.vars*
```

- [ ] **Step 7: Local smoke test on the Workers runtime**

Create `.dev.vars` (gitignored) with the same keys as `.env.local`, then:

Run: `npm run preview:cf`
Expected: server on `http://localhost:8787`. Manually verify:
1. `/` renders the landing page (static assets + `next/image` for `/brand/*.webp`).
2. `/admin` while signed out → 307 to `/login?redirect=/admin` (proves `proxy.ts` runs).
3. Sign in as an admin → `/admin` renders; sign in as a learner → `/admin` → `/unauthorized`.
4. Edit any admin entity (e.g. a slide category) → list refreshes (server action + `revalidatePath`).
5. `POST /api/tutor` with a signed-in cookie returns an answer (Anthropic SDK on Workers).

- [ ] **Step 8: Add the Workers build to CI**

In `.github/workflows/ci.yml`, job `checks`, after `- run: npm run build` add:

```yaml
      - run: npm run build:cf
```

- [ ] **Step 9: Verify and commit**

Run: `npx tsc --noEmit && npm run lint && npm run test && npm run build && npm run build:cf`
Expected: all pass.

```bash
git add wrangler.jsonc vite.config.ts package.json package-lock.json .gitignore .github/workflows/ci.yml
git commit -m "Build the app for Cloudflare Workers with vinext"
```

---

### Task 2: Workers-safe Stripe webhook signature verification

Stripe's synchronous `constructEvent` relies on Node's `crypto.createHmac`. Under `nodejs_compat` it usually works, but Stripe's documented path for Workers is `constructEventAsync` + `createSubtleCryptoProvider()`. Switch now so billing can't silently break after cutover.

**Files:**
- Create: `src/lib/stripe/verify-webhook.ts`, `src/lib/stripe/verify-webhook.test.ts`
- Modify: `src/app/api/billing/webhook/route.ts`

**Interfaces:**
- Consumes: `getStripeClient(): Stripe | null` from `src/lib/stripe/client.ts`.
- Produces: `verifyStripeWebhook(stripe: Stripe, rawBody: string, signature: string | null, secret: string): Promise<Stripe.Event | null>` — `null` on any verification failure.

- [ ] **Step 1: Write the failing test**

`src/lib/stripe/verify-webhook.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import Stripe from "stripe";
import { verifyStripeWebhook } from "./verify-webhook";

const stripe = new Stripe("sk_test_dummy");
const secret = "whsec_test_secret";
const payload = JSON.stringify({
  id: "evt_1",
  object: "event",
  type: "checkout.session.completed",
  data: { object: { metadata: { org_id: "o", tier_id: "t" } } },
});

describe("verifyStripeWebhook", () => {
  it("returns the event for a correctly signed payload", async () => {
    const signature = await stripe.webhooks.generateTestHeaderStringAsync({ payload, secret });
    const event = await verifyStripeWebhook(stripe, payload, signature, secret);
    expect(event?.type).toBe("checkout.session.completed");
  });

  it("returns null for a bad signature", async () => {
    const event = await verifyStripeWebhook(stripe, payload, "t=1,v1=deadbeef", secret);
    expect(event).toBeNull();
  });

  it("returns null when the signature header is missing", async () => {
    expect(await verifyStripeWebhook(stripe, payload, null, secret)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/stripe/verify-webhook.test.ts`
Expected: FAIL — `Cannot find module './verify-webhook'`.

- [ ] **Step 3: Implement**

`src/lib/stripe/verify-webhook.ts`:

```ts
import Stripe from "stripe";

const cryptoProvider = Stripe.createSubtleCryptoProvider();

/**
 * Async + SubtleCrypto variant of stripe.webhooks.constructEvent -- the
 * synchronous version depends on Node's crypto.createHmac, which Stripe
 * doesn't support on Cloudflare Workers. Returns null on any failure so
 * the route can map it to a 400 without try/catch noise.
 */
export async function verifyStripeWebhook(
  stripe: Stripe,
  rawBody: string,
  signature: string | null,
  secret: string,
): Promise<Stripe.Event | null> {
  if (!signature) return null;
  try {
    return await stripe.webhooks.constructEventAsync(rawBody, signature, secret, undefined, cryptoProvider);
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/stripe/verify-webhook.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Use it in the route**

In `src/app/api/billing/webhook/route.ts`, add `import { verifyStripeWebhook } from "@/lib/stripe/verify-webhook";` and replace:

```ts
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature ?? "", webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
```

with:

```ts
  const event = await verifyStripeWebhook(stripe, rawBody, signature, webhookSecret);
  if (!event) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
```

- [ ] **Step 6: Verify and commit**

Run: `npx tsc --noEmit && npm run lint && npm run test`
Expected: all pass.

```bash
git add src/lib/stripe/verify-webhook.ts src/lib/stripe/verify-webhook.test.ts src/app/api/billing/webhook/route.ts
git commit -m "Verify Stripe webhooks with SubtleCrypto so they work on Workers"
```

---

### Task 3: Tiler Worker + Container (replaces Vercel Sandbox)

**Files:**
- Create: `workers/tiler/wrangler.jsonc`, `workers/tiler/Dockerfile`, `workers/tiler/run-tiling.sh`, `workers/tiler/src/index.ts`, `workers/tiler/src/parse-job-request.ts`, `workers/tiler/src/parse-job-request.test.ts`, `workers/tiler/package.json`, `workers/tiler/tsconfig.json`
- Modify: `vitest.config.ts`, root `tsconfig.json` (exclude `workers/`)

**Interfaces:**
- Consumes: the existing callback contract — `POST {APP_URL}/api/tiling/callback`, `Authorization: Bearer <TILING_CALLBACK_SECRET>`, JSON `{job_id, slide_id, status: "ready"|"failed", manifest_url?, error?}`.
- Produces: `POST {TILER_URL}/jobs`, `Authorization: Bearer <TILER_SECRET>`, JSON body `{ jobId: string; slideId: string; rawFileUrl: string }` → `202 {"instanceId": "<jobId>"}`; `401` bad secret; `400` bad body. Consumed by Task 4.
- Produces: `parseJobRequest(request: Request, secret: string): Promise<{ ok: true; job: TilingJobRequest } | { ok: false; status: 400 | 401; error: string }>` and `type TilingJobRequest = { jobId: string; slideId: string; rawFileUrl: string }`.

- [ ] **Step 1: Write the failing test for request parsing**

`workers/tiler/src/parse-job-request.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseJobRequest } from "./parse-job-request";

const secret = "s3cret";
const body = { jobId: "job-1", slideId: "slide-1", rawFileUrl: "https://cdn.example/raw.svs" };

function req(init: { auth?: string; body?: unknown }) {
  return new Request("https://tiler/jobs", {
    method: "POST",
    headers: init.auth ? { Authorization: init.auth } : {},
    body: JSON.stringify(init.body ?? body),
  });
}

describe("parseJobRequest", () => {
  it("accepts a valid, authenticated request", async () => {
    const result = await parseJobRequest(req({ auth: `Bearer ${secret}` }), secret);
    expect(result).toEqual({ ok: true, job: body });
  });

  it("rejects a missing or wrong bearer token with 401", async () => {
    expect(await parseJobRequest(req({}), secret)).toMatchObject({ ok: false, status: 401 });
    expect(await parseJobRequest(req({ auth: "Bearer nope" }), secret)).toMatchObject({ ok: false, status: 401 });
  });

  it("rejects a body missing fields with 400", async () => {
    const result = await parseJobRequest(req({ auth: `Bearer ${secret}`, body: { jobId: "j" } }), secret);
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects a non-https rawFileUrl with 400", async () => {
    const result = await parseJobRequest(
      req({ auth: `Bearer ${secret}`, body: { ...body, rawFileUrl: "file:///etc/passwd" } }),
      secret,
    );
    expect(result).toMatchObject({ ok: false, status: 400 });
  });
});
```

In `vitest.config.ts` change `include` to `["src/**/*.test.ts", "workers/**/*.test.ts"]`.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run workers/tiler/src/parse-job-request.test.ts`
Expected: FAIL — `Cannot find module './parse-job-request'`.

- [ ] **Step 3: Implement `parse-job-request.ts`**

```ts
export type TilingJobRequest = { jobId: string; slideId: string; rawFileUrl: string };

type ParseResult =
  | { ok: true; job: TilingJobRequest }
  | { ok: false; status: 400 | 401; error: string };

async function sameSecret(provided: string, expected: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(provided)),
    crypto.subtle.digest("SHA-256", enc.encode(expected)),
  ]);
  // Comparing fixed-length digests keeps the check constant-time regardless
  // of the provided token's length.
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export async function parseJobRequest(request: Request, secret: string): Promise<ParseResult> {
  const auth = request.headers.get("authorization");
  const provided = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  if (!provided || !(await sameSecret(provided, secret))) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const body = await request.json().catch(() => null);
  const jobId = typeof body?.jobId === "string" ? body.jobId : "";
  const slideId = typeof body?.slideId === "string" ? body.slideId : "";
  const rawFileUrl = typeof body?.rawFileUrl === "string" ? body.rawFileUrl : "";
  if (!jobId || !slideId || !rawFileUrl.startsWith("https://")) {
    return { ok: false, status: 400, error: "Missing jobId, slideId, or an https rawFileUrl" };
  }
  return { ok: true, job: { jobId, slideId, rawFileUrl } };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run workers/tiler/src/parse-job-request.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Port the pipeline to an env-driven script**

`workers/tiler/run-tiling.sh` (same steps as `src/lib/tiling/build-tiling-script.ts`, but every value comes from env vars instead of string interpolation):

```bash
#!/bin/bash
# Runs once per container start. Always reports back to the app's callback
# route, success or failure -- nothing else watches this container, so a
# silent death would leave the slide on "processing" until
# reconcileStaleTilingJobs times it out.
set -eo pipefail
LOG=/tmp/tiling.log
exec >> "$LOG" 2>&1

post_callback() {
  curl -fsS -X POST "$CALLBACK_URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $CALLBACK_SECRET" \
    -d "$1"
}

report_failure() {
  local err
  err=$(tail -c 2000 "$LOG" 2>/dev/null | jq -Rs .)
  post_callback "{\"job_id\":\"$JOB_ID\",\"slide_id\":\"$SLIDE_ID\",\"status\":\"failed\",\"error\":$err}" || true
}
trap report_failure ERR

export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
PREFIX="tiles/${SLIDE_ID}"

mkdir -p /tmp/work && cd /tmp/work
curl -fSL "$RAW_FILE_URL" -o raw_slide
vips dzsave raw_slide tiles --tile-size 254 --overlap 1 --suffix ".jpg[Q=80]"
aws s3 cp tiles_files "s3://${R2_BUCKET_NAME}/${PREFIX}/tiles_files" --recursive --endpoint-url "$R2_ENDPOINT"
aws s3 cp tiles.dzi "s3://${R2_BUCKET_NAME}/${PREFIX}/tiles.dzi" --endpoint-url "$R2_ENDPOINT"

post_callback "{\"job_id\":\"$JOB_ID\",\"slide_id\":\"$SLIDE_ID\",\"status\":\"ready\",\"manifest_url\":\"${R2_PUBLIC_URL}/${PREFIX}/tiles.dzi\"}"
```

- [ ] **Step 6: Dockerfile**

`workers/tiler/Dockerfile`:

```dockerfile
FROM --platform=linux/amd64 debian:bookworm-slim
RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      libvips-tools openslide-tools awscli curl jq ca-certificates \
 && rm -rf /var/lib/apt/lists/*
# Fail the image build if distro vips lacks OpenSlide -- the same check
# scripts/prepare-tiling-snapshot.mjs used to run by hand.
RUN vips -l | grep -qi openslideload
COPY run-tiling.sh /app/run-tiling.sh
RUN chmod +x /app/run-tiling.sh
ENTRYPOINT ["/app/run-tiling.sh"]
```

Verify locally: `docker build -t hemoedge-tiler workers/tiler` → Expected: build succeeds (the `grep` step proves OpenSlide support).

> Implementation note: the base is Debian 12, not Ubuntu 24.04 — Ubuntu 24.04 no longer packages `awscli`, so `apt-get install` fails there. Debian 12 ships `awscli` and a `libvips` built with OpenSlide.

- [ ] **Step 7: Worker + Container class**

`workers/tiler/src/index.ts`:

```ts
import { Container, getContainer } from "@cloudflare/containers";
import { parseJobRequest } from "./parse-job-request";

interface Env {
  TILING_CONTAINER: DurableObjectNamespace<TilingContainer>;
  TILER_SECRET: string;
  APP_URL: string;
  TILING_CALLBACK_SECRET: string;
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET_NAME: string;
  R2_PUBLIC_URL: string;
}

/** One instance per tiling job (named by job id); runs run-tiling.sh to
 * completion and exits. No ports -- it's a batch job. sleepAfter is just
 * above the app's 45-minute stale-job budget. */
export class TilingContainer extends Container<Env> {
  sleepAfter = "50m";
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/jobs") {
      return new Response("Not found", { status: 404 });
    }

    const parsed = await parseJobRequest(request, env.TILER_SECRET);
    if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status });
    const { jobId, slideId, rawFileUrl } = parsed.job;

    const container = getContainer(env.TILING_CONTAINER, jobId);
    await container.start({
      envVars: {
        JOB_ID: jobId,
        SLIDE_ID: slideId,
        RAW_FILE_URL: rawFileUrl,
        CALLBACK_URL: `${env.APP_URL.replace(/\/+$/, "")}/api/tiling/callback`,
        CALLBACK_SECRET: env.TILING_CALLBACK_SECRET,
        R2_ACCOUNT_ID: env.R2_ACCOUNT_ID,
        R2_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID,
        R2_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY,
        R2_BUCKET_NAME: env.R2_BUCKET_NAME,
        R2_PUBLIC_URL: env.R2_PUBLIC_URL,
      },
      enableInternet: true,
    });

    return Response.json({ instanceId: jobId }, { status: 202 });
  },
};
```

(The `APP_URL.replace(/\/+$/, "")` join is deliberate — see the double-slash 308 bug documented in the old `trigger-tiling-job.ts`.)

- [ ] **Step 8: Tiler config, package and tsconfig**

`workers/tiler/wrangler.jsonc`:

```jsonc
{
  "$schema": "../../node_modules/wrangler/config-schema.json",
  "name": "hemoedge-tiler",
  "main": "src/index.ts",
  "compatibility_date": "2026-09-25",
  "compatibility_flags": ["nodejs_compat"],
  "observability": { "enabled": true },
  "containers": [
    { "class_name": "TilingContainer", "image": "./Dockerfile", "instance_type": "standard-2", "max_instances": 5 }
  ],
  "durable_objects": { "bindings": [{ "name": "TILING_CONTAINER", "class_name": "TilingContainer" }] },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["TilingContainer"] }],
  "vars": { "APP_URL": "", "R2_BUCKET_NAME": "", "R2_PUBLIC_URL": "" }
}
```

`workers/tiler/package.json`:

```json
{
  "name": "hemoedge-tiler",
  "private": true,
  "scripts": { "deploy": "wrangler deploy", "dev": "wrangler dev", "typegen": "wrangler types" },
  "dependencies": { "@cloudflare/containers": "latest" },
  "devDependencies": { "wrangler": "latest", "@cloudflare/workers-types": "latest", "typescript": "^5" }
}
```

Run `cd workers/tiler && npm install` (pins the resolved versions in its own lockfile), then replace `"latest"` with the installed `^x.y.z` versions.

`workers/tiler/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler",
    "strict": true, "noEmit": true, "types": ["@cloudflare/workers-types"]
  },
  "include": ["src"]
}
```

In the root `tsconfig.json`, add `"workers"` to `exclude` so `npx tsc --noEmit` for the app doesn't type-check Worker code against DOM/Node types.

- [ ] **Step 9: Verify and commit**

Run: `npx tsc --noEmit && (cd workers/tiler && npx tsc --noEmit && npx wrangler deploy --config wrangler.jsonc --dry-run) && npm run test`

> Implementation notes: (1) `container.start()` throws if the container has already exited by its first health probe (a job that fails, or finishes, within ~1s). The script has reported through the callback by then, so `src/container-errors.ts` classifies that case and the Worker still answers 202; any other start error returns a JSON 502. (2) Tiler scripts pass `--config wrangler.jsonc` explicitly: after `vinext build`, wrangler would otherwise find the root `.wrangler/deploy/config.json` redirect and refuse to run. (3) CI type-checks the tiler with its own dependencies.
Expected: all pass; dry-run prints the container + DO bindings.

```bash
git add workers/tiler vitest.config.ts tsconfig.json
git commit -m "Add Cloudflare Containers tiler worker to replace Vercel Sandbox"
```

---

### Task 4: Point the app at the tiler and remove `@vercel/sandbox`

**Files:**
- Rewrite: `src/lib/tiling/trigger-tiling-job.ts`
- Create: `src/lib/tiling/trigger-tiling-job.test.ts`
- Modify: `src/lib/tiling/reconcile-stale-jobs.ts`, `.env.example`, `package.json`
- Delete: `src/lib/tiling/build-tiling-script.ts`, `scripts/prepare-tiling-snapshot.mjs`

**Interfaces:**
- Consumes: Task 3's `POST {TILER_URL}/jobs` contract.
- Produces: unchanged signature `triggerTilingJob(params: { jobId: string; slideId: string; rawFileUrl: string }): Promise<{ sandboxId?: string; cmdId?: string; error?: string }>` — `src/app/admin/slides/actions.ts` needs no changes. `sandboxId` = tiler's `instanceId`; `cmdId` is `undefined`.

- [ ] **Step 1: Write the failing test**

`src/lib/tiling/trigger-tiling-job.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { triggerTilingJob } from "./trigger-tiling-job";

const params = { jobId: "job-1", slideId: "slide-1", rawFileUrl: "https://cdn.example/raw.svs" };

describe("triggerTilingJob", () => {
  beforeEach(() => {
    vi.stubEnv("TILER_URL", "https://tiler.example/");
    vi.stubEnv("TILER_SECRET", "s3cret");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("posts the job to the tiler and returns its instance id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ instanceId: "job-1" }, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await triggerTilingJob(params);

    expect(result).toEqual({ sandboxId: "job-1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://tiler.example/jobs");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer s3cret");
    expect(JSON.parse(init.body)).toEqual(params);
  });

  it("returns a config error when TILER_URL or TILER_SECRET is missing", async () => {
    vi.stubEnv("TILER_SECRET", "");
    const result = await triggerTilingJob(params);
    expect(result.error).toMatch(/TILER_URL\/TILER_SECRET/);
  });

  it("surfaces a non-2xx tiler response as an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Unauthorized" }, { status: 401 })));
    const result = await triggerTilingJob(params);
    expect(result.error).toBe("Tiler rejected the job (401): Unauthorized");
  });

  it("surfaces a network failure as an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED")));
    const result = await triggerTilingJob(params);
    expect(result.error).toBe("connect ECONNREFUSED");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/tiling/trigger-tiling-job.test.ts`
Expected: FAIL — the current implementation returns the `TILING_SANDBOX_SNAPSHOT_ID` config error for every case.

- [ ] **Step 3: Rewrite `trigger-tiling-job.ts`**

```ts
/**
 * Hands a tiling job to the hemoedge-tiler Worker (workers/tiler), which
 * starts a Cloudflare Container named after the job and returns
 * immediately; the container reports its own outcome to
 * /api/tiling/callback. Nothing here waits for or polls the result.
 */
export async function triggerTilingJob(params: {
  jobId: string;
  slideId: string;
  rawFileUrl: string;
}): Promise<{ sandboxId?: string; cmdId?: string; error?: string }> {
  const tilerUrl = process.env.TILER_URL;
  const tilerSecret = process.env.TILER_SECRET;
  if (!tilerUrl || !tilerSecret) {
    return { error: "Tiling isn't configured (missing TILER_URL/TILER_SECRET env vars)." };
  }

  try {
    const response = await fetch(`${tilerUrl.replace(/\/+$/, "")}/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tilerSecret}` },
      body: JSON.stringify(params),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      return { error: `Tiler rejected the job (${response.status}): ${body?.error ?? "unknown error"}` };
    }
    return { sandboxId: typeof body?.instanceId === "string" ? body.instanceId : params.jobId };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't reach the tiler." };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/tiling/trigger-tiling-job.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Remove the Vercel Sandbox leftovers**

```bash
git rm src/lib/tiling/build-tiling-script.ts scripts/prepare-tiling-snapshot.mjs
npm uninstall @vercel/sandbox
```

In `package.json` delete the `"tiling:prepare-snapshot"` script.

In `src/lib/tiling/reconcile-stale-jobs.ts`, replace the top comment + constant with:

```ts
/** Tiling containers stop themselves after this long without activity (see
 * TilingContainer.sleepAfter in workers/tiler); a job that hasn't heard back
 * well past it is never going to. */
const TILING_TIMEOUT_MINUTES = 45;
const STALE_AFTER_MINUTES = TILING_TIMEOUT_MINUTES + 5;
```

and change "whose sandbox died" / "from the sandbox" in the remaining comment and error string to "whose container died" / "from the tiling container".

In `.env.example`, replace everything from `# Vercel Sandbox` to `TILING_SANDBOX_SNAPSHOT_ID=` with:

```dotenv
# WSI tiling runs in the hemoedge-tiler Worker (workers/tiler).
TILER_URL=
TILER_SECRET=
```

(keep `TILING_CALLBACK_SECRET=`).

- [ ] **Step 6: Verify no Vercel references remain**

Run: `grep -rniE "vercel|sandbox_snapshot|@vercel" src scripts package.json .env.example`
Expected: only the historical comment in `src/components/admin/media-fields.tsx` if any, and the `sandbox_id` DB column name in generated types/actions — no imports, no env vars.

- [ ] **Step 7: Verify and commit**

Run: `npx tsc --noEmit && npm run lint && npm run test && npm run build && npm run build:cf`
Expected: all pass.

```bash
git add -A src/lib/tiling scripts package.json package-lock.json .env.example
git commit -m "Trigger WSI tiling via the Cloudflare tiler instead of Vercel Sandbox"
```

---

### Task 5: Continuous deployment with Workers Builds

**Decision:** CD runs on Cloudflare **Workers Builds** (Cloudflare's Git integration), not a GitHub Actions deploy workflow. GitHub keeps CI (`ci.yml`). Reasons: it mirrors today's Vercel Git integration (deploy on merge to `main`, a preview URL comment on every PR), needs no Cloudflare API token stored in GitHub, and builds the tiler's Docker image on Cloudflare's builders. Deploys are gated by making the CI checks **required** on `main`, so only CI-green code is ever merged and deployed.

Known limit: preview (non-`main`) builds run `wrangler versions upload`, which does **not** rebuild or roll out the tiler container. Tiler changes are verified with `wrangler dev` locally and go live on merge.

**Files:**
- Modify: `package.json` (add `deploy:cf:ci` script)
- Modify: `docs/cloudflare-runbook.md` (created in Task 6 — record the dashboard settings below there)

**Interfaces:**
- Consumes: `npm run build:cf` / `npm run deploy:cf` (Task 1); `workers/tiler` (Task 3).
- Produces: two Workers Builds connections (`hemoedge`, `hemoedge-tiler`) on repo `optymumss/Hemoedge`, production branch `main`.

- [ ] **Step 1: Add a CI-friendly deploy script**

Workers Builds runs a *build command* then a *deploy command*. In `package.json` `scripts` add:

```json
"deploy:cf:ci": "vinext-cloudflare deploy --config dist/server/wrangler.json"
```

(the build step has already produced the vinext output, so the deploy command must not rebuild; vinext deploys from the Worker config it generates at build time, `dist/server/wrangler.json`, not from `wrangler.jsonc` directly).

Run: `npm run build:cf && npx wrangler deploy --config dist/server/wrangler.json --dry-run`
Expected: dry run lists the `hemoedge` Worker and its assets without errors.

```bash
git add package.json
git commit -m "Add deploy script for Workers Builds"
```

- [ ] **Step 2: Connect the app Worker (dashboard, account owner)**

Workers & Pages → `hemoedge` → Settings → Builds → Connect → GitHub → `optymumss/Hemoedge`:

| Setting | Value |
|---|---|
| Production branch | `main` |
| Root directory | `/` |
| Build command | `npm ci && npm run build:cf` |
| Deploy command | `npm run deploy:cf:ci` |
| Non-production branch builds | Enabled (deploy command `npx wrangler versions upload`) |
| Build variables | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (same values as in `ci.yml`) |

- [ ] **Step 3: Connect the tiler Worker**

Workers & Pages → `hemoedge-tiler` → Settings → Builds → Connect → same repo:

| Setting | Value |
|---|---|
| Production branch | `main` |
| Root directory | `workers/tiler` |
| Build command | `npm ci` |
| Deploy command | `npm run deploy` |
| Build watch paths | include `workers/tiler/*` only (so app-only changes don't redeploy the tiler) |
| Non-production branch builds | Disabled (containers don't update on preview builds anyway) |

- [ ] **Step 4: Make CI a merge gate and turn off Vercel's Git deploys**

1. GitHub → Settings → Branches → rule for `main`: require status checks `Type check, lint, unit tests, build` and `End-to-end tests`.
2. Vercel → Project → Settings → Git → disconnect the repository (the project itself stays until Task 7 decommission). From now on only Cloudflare posts preview comments.

- [ ] **Step 5: Verify**

Open a trivial PR (e.g. a README typo). Expected: a Cloudflare comment with a branch preview URL (`<branch>-hemoedge.<subdomain>.workers.dev`) that serves the PR's code; merge after CI → a new production version appears under Workers → `hemoedge` → Deployments.

### Task 6: Provision Cloudflare, configure secrets, first deploy to the `workers.dev` URL

This task is operational (account owner runs it with Wrangler logged in to the HemoEdge Cloudflare account). Record everything in `docs/cloudflare-runbook.md`.

**Files:**
- Create: `docs/cloudflare-runbook.md`
- Modify: `wrangler.jsonc`, `workers/tiler/wrangler.jsonc` (`vars` values only — no secrets)

- [ ] **Step 1: Account prerequisites**

1. Upgrade the account that already owns the R2 bucket to **Workers Paid** (required for Containers and for app bundles over 3 MB).
2. Install the Cloudflare GitHub app on `optymumss/Hemoedge` (Workers Builds, Task 5). No API token is stored in GitHub.
3. Export the current production env var **names and values** from the Vercel dashboard (Project → Settings → Environment Variables) to a local, gitignored file. Values are needed for Step 3; never commit them.

- [ ] **Step 2: Fill the non-secret `vars`**

`wrangler.jsonc` `vars`: `EMAIL_FROM`, `ENQUIRY_NOTIFY_EMAIL`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` = current Vercel values; `APP_URL` = `https://hemoedge.<subdomain>.workers.dev` for now.
`workers/tiler/wrangler.jsonc` `vars`: same `APP_URL`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`.

- [ ] **Step 3: Set secrets**

Generate a new tiler secret: `openssl rand -hex 32` → `TILER_SECRET`.

```bash
# App worker
for k in SUPABASE_SERVICE_ROLE_KEY ANTHROPIC_API_KEY STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET \
         RESEND_API_KEY R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY \
         TILING_CALLBACK_SECRET TILER_SECRET; do npx wrangler secret put "$k"; done
npx wrangler secret put TILER_URL   # https://hemoedge-tiler.<subdomain>.workers.dev

# Tiler worker
cd workers/tiler
for k in TILER_SECRET TILING_CALLBACK_SECRET R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY; do
  npx wrangler secret put "$k"; done
```

`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are **build-time** (inlined into the client bundle) — they come from the workflow `env` block, not Wrangler secrets.

- [ ] **Step 4: First deploy**

```bash
(cd workers/tiler && npx wrangler deploy)   # builds + pushes the Docker image
npm run deploy:cf
```

Expected: both print a `*.workers.dev` URL.

- [ ] **Step 5: Allow the new origin in Supabase Auth**

Supabase dashboard → Authentication → URL Configuration → add `https://hemoedge.<subdomain>.workers.dev/**` to Redirect URLs (Site URL unchanged until cutover). Needed because password-reset links are built from the request origin (`src/lib/http/request-origin.ts`).

- [ ] **Step 6: Staging acceptance on `workers.dev`**

Run every check from Task 1, Step 7 against the deployed URL, plus:
1. **Password reset**: request a reset → email link lands on `/auth/confirm?type=recovery…` on the workers.dev host → `/reset-password` works.
2. **Tiling end to end**: upload a small real WSI (OpenSlide test corpus) on `/admin/slides` → status goes `queued → processing → ready`; the WSI viewer loads tiles from R2. `npx wrangler tail hemoedge-tiler` shows the container start.
3. **Tiling failure path**: upload a non-slide file → status becomes `failed` with the vips error text; Retry is offered.
4. **Stripe**: in Stripe test mode add a webhook endpoint `https://hemoedge.<subdomain>.workers.dev/api/billing/webhook`, complete a test checkout from `/org/billing` → org tier updates. Remove the test endpoint afterwards.
5. **Enquiry email**: submit `/contact` → Resend delivers to `ENQUIRY_NOTIFY_EMAIL`.
6. Run Playwright against it: `PLAYWRIGHT_BASE_URL=https://hemoedge.<subdomain>.workers.dev npx playwright test` (if `playwright.config.ts` doesn't read that variable yet, temporarily point `use.baseURL` at the URL and drop `webServer` locally — do not commit).

- [ ] **Step 7: Write the runbook and commit**

`docs/cloudflare-runbook.md` must contain: the secret list from Step 3 (names only), which values are `vars` vs secrets vs build-time, deploy commands, `wrangler tail` usage for both Workers, the rollback procedure (Task 7 Step 4), and the Stripe/Supabase settings touched.

```bash
git add wrangler.jsonc workers/tiler/wrangler.jsonc docs/cloudflare-runbook.md
git commit -m "Configure Cloudflare vars and add deployment runbook"
```

---

### Task 7: Production cutover and Vercel decommission

**Files:**
- Modify: `wrangler.jsonc`, `workers/tiler/wrangler.jsonc` (`APP_URL`, `routes`), `README.md`, `docs/cloudflare-runbook.md`

- [ ] **Step 1: Prepare (T-1 day)**

1. Lower the TTL on the production domain's DNS records to 300s.
2. If the domain's DNS isn't on Cloudflare yet, add the zone to Cloudflare and switch nameservers at the registrar now (DNS records copied 1:1, still pointing at Vercel). Wait for the zone to be *Active*.
3. Confirm no tiling jobs are `processing` in `tiling_jobs` (they'd call back to Vercel, which still works — but avoid ambiguity).

- [ ] **Step 2: Attach the domain to the Worker**

Add to `wrangler.jsonc`:

```jsonc
  "routes": [{ "pattern": "<production-domain>", "custom_domain": true }],
```

Set `APP_URL` (both Workers) to `https://<production-domain>`; update the `TILER_URL` secret only if the tiler also gets a custom domain (optional). Deploy both (Workers Builds on merge to `main`, or manually with `wrangler deploy`). Wrangler replaces the Vercel DNS record with the Worker custom domain.

- [ ] **Step 3: Flip external integrations**

1. Stripe (live mode): point the existing webhook endpoint at `https://<production-domain>/api/billing/webhook` — same URL if the domain is unchanged, so usually nothing to do; verify with "Send test event".
2. Supabase Auth: Site URL = `https://<production-domain>`; keep the workers.dev redirect URL for staging.
3. Smoke-test production with the checklist in Task 6, Step 6 (skip destructive items; do tiling with the test slide).

- [ ] **Step 4: Rollback procedure (documented, used only if Step 3 fails)**

Remove the Worker custom domain (`wrangler.jsonc` `routes` → deploy, or dashboard → Workers → hemoedge → Domains → remove), re-create the DNS record pointing at Vercel (`cname.vercel-dns.com`), and unpause the Vercel project. With 300s TTL, recovery is ~5 minutes.

- [ ] **Step 5: Decommission (T+14 days, no incidents)**

1. Vercel: delete the project's production env vars, then delete the project (or keep paused if billing allows).
2. Rotate secrets that existed on Vercel: `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_WEBHOOK_SECRET` (roll in Stripe), `TILING_CALLBACK_SECRET`, R2 access keys → `wrangler secret put` new values.
3. Update `README.md` with the `preview:cf` / `deploy:cf` commands and a link to `docs/cloudflare-runbook.md`.
4. Raise DNS TTL back to Auto.

```bash
git add wrangler.jsonc workers/tiler/wrangler.jsonc README.md docs/cloudflare-runbook.md
git commit -m "Serve production from Cloudflare and document decommissioning Vercel"
```

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| vinext is beta; an obscure Next feature misbehaves | Task 1 `vinext check` gate + full manual matrix on `workers.dev` before any DNS change; OpenNext fallback documented; Vercel stays warm for 14 days |
| Container is stopped mid-job by a host restart (Cloudflare guarantees no minimum runtime) | Same outcome as today's sandbox hard-timeout: `reconcileStaleTilingJobs` marks it `failed` after 50 min and the admin can Retry |
| `@aws-sdk/client-s3` presigner or other Node APIs misbehave on Workers | Exercised by the media upload + tiling checks in Task 6 Step 6; `nodejs_compat` covers `Buffer`, `node:crypto` |
| Worker bundle size limit | Workers Paid (10 MB compressed); `build:cf` in CI surfaces growth early |
| Cold start of the tiling container (image pull) | Acceptable — jobs are async; the admin already sees `queued/processing` |

## Out of scope

- Moving Supabase Postgres/Auth/Storage to D1/Better Auth/R2 — covered by the follow-up plan `docs/superpowers/plans/2026-09-25-supabase-to-d1-migration.md`, which starts after this plan is complete.
- Replacing Resend, Stripe, or Anthropic.
- ISR/`"use cache"` backends — the app uses only `revalidatePath` on dynamic admin pages, which needs no incremental cache store.
