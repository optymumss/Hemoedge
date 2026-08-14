import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The tiling sandbox POSTs here when it finishes (success or failure) —
 * nothing else is watching the sandbox's own lifetime, so this is the only
 * signal that flips a slide out of "processing". Authenticated by a shared
 * secret rather than a user session, since the caller is a sandbox, not a
 * logged-in request; the admin client is required to write past RLS for
 * the same reason.
 */
function isValidSecret(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const secret = process.env.TILING_CALLBACK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Tiling callback not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  const provided = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!isValidSecret(provided, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const jobId = typeof body?.job_id === "string" ? body.job_id : null;
  const slideId = typeof body?.slide_id === "string" ? body.slide_id : null;
  const status = body?.status === "ready" || body?.status === "failed" ? body.status : null;

  if (!jobId || !slideId || !status) {
    return NextResponse.json({ error: "Missing job_id, slide_id, or status" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  if (status === "ready") {
    const manifestUrl = typeof body?.manifest_url === "string" ? body.manifest_url : null;
    await supabase.from("tiling_jobs").update({ status: "ready", updated_at: now }).eq("id", jobId);
    await supabase
      .from("slides")
      .update({ tiling_status: "ready", tile_manifest_url: manifestUrl })
      .eq("id", slideId);
  } else {
    const error = typeof body?.error === "string" ? body.error.slice(0, 2000) : "Unknown error";
    await supabase.from("tiling_jobs").update({ status: "failed", error, updated_at: now }).eq("id", jobId);
    await supabase.from("slides").update({ tiling_status: "failed" }).eq("id", slideId);
  }

  return NextResponse.json({ ok: true });
}
