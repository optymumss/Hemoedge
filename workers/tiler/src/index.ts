import { verifyGithubOidcToken, type OidcExpectations } from "./github-oidc";
import { openJob, sealJob } from "./job-token";
import { parseJobRequest, type TilingJobRequest } from "./parse-job-request";

interface Env {
  TILER_SECRET: string;
  APP_URL: string;
  TILING_CALLBACK_SECRET: string;
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET_NAME: string;
  R2_PUBLIC_URL: string;
  /** "owner/repo" hosting .github/workflows/<GITHUB_WORKFLOW>. */
  GITHUB_REPO: string;
  GITHUB_WORKFLOW: string;
  GITHUB_REF: string;
  /** Fine-grained PAT with Actions: read & write on GITHUB_REPO only. */
  GITHUB_DISPATCH_TOKEN: string;
}

/** Must match the `audience` the workflow requests its OIDC token for. */
export const OIDC_AUDIENCE = "hemoedge-tiler";

const tilePrefix = (slideId: string) => `tiles/${slideId}`;
const trimSlash = (url: string) => url.replace(/\/+$/, "");

function oidcExpectations(env: Env): OidcExpectations {
  return { audience: OIDC_AUDIENCE, repository: env.GITHUB_REPO, workflow: env.GITHUB_WORKFLOW, ref: env.GITHUB_REF };
}

/**
 * POST /jobs -- called by the app. Hands the job to a GitHub Actions run of
 * the tiling workflow and returns immediately; the run reports its own
 * outcome through /runner/callback.
 */
async function createJob(request: Request, env: Env): Promise<Response> {
  const parsed = await parseJobRequest(request, env.TILER_SECRET);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status });

  const job = await sealJob(parsed.job, env.TILER_SECRET);
  const response = await fetch(
    `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/${env.GITHUB_WORKFLOW}/dispatches`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
        "User-Agent": "hemoedge-tiler",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ ref: env.GITHUB_REF, inputs: { job } }),
    },
  );
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    return Response.json(
      { error: `Couldn't start the tiling workflow (GitHub ${response.status}): ${detail}` },
      { status: 502 },
    );
  }
  return Response.json({ instanceId: parsed.job.jobId }, { status: 202 });
}

type RunnerAuth = { job: TilingJobRequest; body: Record<string, unknown> } | { error: Response };

/** Authenticates a tiling-workflow run and opens the job it was given. */
async function authenticateRunner(request: Request, env: Env): Promise<RunnerAuth> {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  const verified = token
    ? await verifyGithubOidcToken(token, oidcExpectations(env))
    : ({ ok: false, error: "Missing token" } as const);
  if (!verified.ok) return { error: Response.json({ error: verified.error }, { status: 401 }) };

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const job = typeof body?.job === "string" ? await openJob(body.job, env.TILER_SECRET) : null;
  if (!job) return { error: Response.json({ error: "Invalid job token" }, { status: 400 }) };
  return { job, body: body! };
}

/** POST /runner/start -- what the run needs to tile and upload one slide. */
async function startRunner(request: Request, env: Env): Promise<Response> {
  const auth = await authenticateRunner(request, env);
  if ("error" in auth) return auth.error;
  return Response.json({
    rawFileUrl: auth.job.rawFileUrl,
    bucket: env.R2_BUCKET_NAME,
    prefix: tilePrefix(auth.job.slideId),
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  });
}

/**
 * POST /runner/callback -- relays the run's outcome to the app's
 * /api/tiling/callback. Job/slide ids and the manifest URL come from the
 * sealed job, not the runner, so a run can only report on its own job.
 */
async function relayCallback(request: Request, env: Env): Promise<Response> {
  const auth = await authenticateRunner(request, env);
  if ("error" in auth) return auth.error;
  const { job, body } = auth;

  const status = body.status === "ready" || body.status === "failed" ? body.status : null;
  if (!status) return Response.json({ error: "status must be ready or failed" }, { status: 400 });

  const payload: Record<string, string> = { job_id: job.jobId, slide_id: job.slideId, status };
  if (status === "ready") {
    payload.manifest_url = `${trimSlash(env.R2_PUBLIC_URL)}/${tilePrefix(job.slideId)}/tiles.dzi`;
  } else {
    payload.error = typeof body.error === "string" ? body.error.slice(0, 2000) : "Unknown error";
  }

  // APP_URL may carry a trailing slash; a double slash gets 308'd and the
  // POST would be lost.
  const upstream = await fetch(`${trimSlash(env.APP_URL)}/api/tiling/callback`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.TILING_CALLBACK_SECRET}` },
    body: JSON.stringify(payload),
  });
  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
  });
}

const routes: Record<string, (request: Request, env: Env) => Promise<Response>> = {
  "/jobs": createJob,
  "/runner/start": startRunner,
  "/runner/callback": relayCallback,
};

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const handler = routes[new URL(request.url).pathname];
    if (request.method !== "POST" || !handler) return new Response("Not found", { status: 404 });
    return handler(request, env);
  },
} satisfies ExportedHandler<Env>;

export default worker;
