import { Container, getContainer } from "@cloudflare/containers";
import { containerAlreadyExited } from "./container-errors";
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

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/jobs") {
      return new Response("Not found", { status: 404 });
    }

    const parsed = await parseJobRequest(request, env.TILER_SECRET);
    if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status });
    const { jobId, slideId, rawFileUrl } = parsed.job;

    const container = getContainer(env.TILING_CONTAINER, jobId);
    try {
      await container.start({
        envVars: {
          JOB_ID: jobId,
          SLIDE_ID: slideId,
          RAW_FILE_URL: rawFileUrl,
          // APP_URL may carry a trailing slash; a double slash here gets 308'd
          // and curl (no -L) would silently skip the callback.
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
    } catch (err) {
      if (!containerAlreadyExited(err)) {
        const message = err instanceof Error ? err.message : "unknown error";
        return Response.json({ error: `Couldn't start the tiling container: ${message}` }, { status: 502 });
      }
    }

    return Response.json({ instanceId: jobId }, { status: 202 });
  },
} satisfies ExportedHandler<Env>;

export default worker;
