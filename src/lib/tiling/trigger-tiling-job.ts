import { Sandbox } from "@vercel/sandbox";
import { R2_BUCKET_NAME, R2_PUBLIC_URL } from "@/lib/r2";
import { buildTilingScript } from "./build-tiling-script";

/**
 * Boots a sandbox from the pre-verified snapshot (see
 * scripts/prepare-tiling-snapshot.mjs) and launches the tiling script inside
 * it with the SDK's own `detached: true` mode, so the call we await returns
 * in milliseconds instead of blocking on the multi-minute tiling job itself,
 * which would otherwise hold this server action/route open far past any
 * reasonable request timeout. The sandbox reports its own outcome via the
 * callback route; nothing here waits for or polls the result.
 *
 * This must be `detached: true` rather than a manual `nohup ... & disown`
 * shell trick: without it, the SDK's own command tracking considers the
 * sandbox's work finished the instant the launcher shell returns (which
 * happens almost immediately, since all it does is background the real
 * script), so the session can be paused before the backgrounded script gets
 * anywhere — regardless of how small the file is. That was confirmed live:
 * a 300MB+ slide and a trivial ~2MB test slide both got orphaned in
 * "processing" forever with an identical zero-progress signature (no R2
 * tile output, no callback ever received). `detached: true` keeps the
 * command itself tracked as still-running for the sandbox's full timeout.
 */
export async function triggerTilingJob(params: {
  jobId: string;
  slideId: string;
  rawFileUrl: string;
}): Promise<{ sandboxId?: string; cmdId?: string; error?: string }> {
  const snapshotId = process.env.TILING_SANDBOX_SNAPSHOT_ID;
  const appUrl = process.env.APP_URL;
  const callbackSecret = process.env.TILING_CALLBACK_SECRET;
  const r2AccountId = process.env.R2_ACCOUNT_ID;
  const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID;
  const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!snapshotId || !appUrl || !callbackSecret || !r2AccountId || !r2AccessKeyId || !r2SecretAccessKey) {
    return { error: "Tiling isn't configured (missing TILING_SANDBOX_SNAPSHOT_ID/APP_URL/TILING_CALLBACK_SECRET/R2 env vars)." };
  }

  try {
    const sandbox = await Sandbox.create({
      source: { type: "snapshot", snapshotId },
      // 45 minutes is the max Vercel allows on the Hobby plan (up to 24h on
      // Pro/Enterprise) -- confirmed live that a real ~300MB WSI file
      // (download + vips dzsave + tile upload) can run past the previous
      // 20-minute budget, which killed the sandbox mid-job with no chance
      // to report back (a hard VM timeout, not a script error, so nothing
      // in the script itself can catch or report it).
      timeout: 45 * 60 * 1000,
      resources: { vcpus: 4 },
    });

    const script = buildTilingScript({
      jobId: params.jobId,
      slideId: params.slideId,
      rawFileUrl: params.rawFileUrl,
      // APP_URL carries a trailing slash in this project's config; a naive
      // `${appUrl}/...` join produced a double slash, which Vercel 308s to
      // the single-slash path. The sandbox's `curl -fsS` doesn't pass `-L`,
      // so it silently printed the redirect body and moved on -- tiling
      // completed and tiles landed in R2, but the callback route was never
      // actually hit, so the job stayed on "processing" forever. Confirmed
      // live: a fully-tiled test slide's job never left "processing", and
      // curl -i against the literal double-slash URL reproduced the same
      // 308 + "Redirecting..." body seen in the sandbox's own log.
      callbackUrl: `${appUrl.replace(/\/+$/, "")}/api/tiling/callback`,
      callbackSecret,
      r2AccountId,
      r2AccessKeyId,
      r2SecretAccessKey,
      r2BucketName: R2_BUCKET_NAME,
      r2PublicUrl: R2_PUBLIC_URL,
    });

    await sandbox.writeFiles([{ path: "/tmp/run-tiling.sh", content: Buffer.from(script) }]);
    const command = await sandbox.runCommand({
      cmd: "bash",
      args: ["/tmp/run-tiling.sh"],
      sudo: true,
      detached: true,
    });

    return { sandboxId: sandbox.name, cmdId: command.cmdId };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't start the tiling sandbox." };
  }
}
