import { NextRequest, NextResponse } from "next/server";
import { Sandbox } from "@vercel/sandbox";
import { getCurrentProfile } from "@/lib/auth/get-profile";

/**
 * TEMPORARY debug route to inspect a live/dead sandbox command's actual
 * output — used once to diagnose why tiling was still stuck after the
 * detached:true fix. Remove after use.
 */
export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "super_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sandboxId = request.nextUrl.searchParams.get("sandboxId");
  const cmdId = request.nextUrl.searchParams.get("cmdId");
  if (!sandboxId || !cmdId) {
    return NextResponse.json({ error: "Missing sandboxId or cmdId" }, { status: 400 });
  }

  try {
    const sandbox = await Sandbox.get({ name: sandboxId, resume: false });
    const command = await sandbox.getCommand(cmdId);
    const stdout = await command.stdout();
    const stderr = await command.stderr();

    return NextResponse.json({
      sandboxStatus: sandbox.status,
      commandExitCode: command.exitCode,
      commandDurationMs: command.durationMs,
      stdout: stdout.slice(-4000),
      stderr: stderr.slice(-4000),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
