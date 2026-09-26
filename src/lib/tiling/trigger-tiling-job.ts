/**
 * Hands a tiling job to the hemoedge-tiler Worker (workers/tiler), which
 * dispatches a GitHub Actions run of .github/workflows/tiling.yml and
 * returns immediately; the run reports its own outcome to
 * /api/tiling/callback (relayed by the tiler). Nothing here waits for or
 * polls the result.
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
