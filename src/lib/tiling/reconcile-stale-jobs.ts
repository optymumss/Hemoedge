import { createClient } from "@/lib/supabase/server";

/** Vercel Sandbox instances the tiling pipeline creates are capped at this
 * timeout (see trigger-tiling-job.ts); a job that hasn't heard back well
 * past it is never going to. */
const SANDBOX_TIMEOUT_MINUTES = 45;
const STALE_AFTER_MINUTES = SANDBOX_TIMEOUT_MINUTES + 5;

/**
 * There's no cron/worker watching tiling jobs independently of the sandbox
 * itself, so a job whose sandbox died without hitting the callback route
 * (crash, an actual timeout, transient network failure) is otherwise stuck
 * on "processing" forever with no error and no way to retry — the admin
 * Slides page only offers a Retry action once `tiling_status` is `failed`.
 * Called on every Slides admin page load: cheap, RLS-scoped to jobs the
 * caller can already see, and turns a permanently-stuck job into a normal,
 * retryable failure the next time anyone looks at the page.
 */
export async function reconcileStaleTilingJobs(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const staleBefore = new Date(Date.now() - STALE_AFTER_MINUTES * 60 * 1000).toISOString();

  const { data: staleJobs } = await supabase
    .from("tiling_jobs")
    .select("id, slide_id")
    .in("status", ["queued", "processing"])
    .lt("updated_at", staleBefore);

  if (!staleJobs || staleJobs.length === 0) return;

  const error = `Tiling timed out — no response from the sandbox within ${STALE_AFTER_MINUTES} minutes.`;
  const now = new Date().toISOString();

  await supabase
    .from("tiling_jobs")
    .update({ status: "failed", error, updated_at: now })
    .in(
      "id",
      staleJobs.map((j) => j.id),
    );

  await supabase
    .from("slides")
    .update({ tiling_status: "failed" })
    .in(
      "id",
      staleJobs.map((j) => j.slide_id),
    );
}
