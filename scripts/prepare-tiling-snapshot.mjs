#!/usr/bin/env node
/**
 * Spike + prep tool for the WSI tiling pipeline (see AGENTS notes / PR
 * description for the full architecture). Run this ONCE to:
 *
 *   1. Verify the distro-packaged libvips actually has OpenSlide support
 *      compiled in, against a REAL vendor WSI file (not just a plain TIFF —
 *      distro vips doesn't always ship with OpenSlide enabled).
 *   2. Snapshot the prepped sandbox so production tiling jobs can boot from
 *      it instantly instead of re-running apt-get on every slide upload.
 *
 * Usage:
 *   VERCEL_TOKEN=... VERCEL_TEAM_ID=... VERCEL_PROJECT_ID=... \
 *   SAMPLE_SLIDE_URL=<url to a real .svs/.ndpi/.mrxs/.tif test file> \
 *   node scripts/prepare-tiling-snapshot.mjs
 *
 * SAMPLE_SLIDE_URL: grab one from OpenSlide's own public test-data set
 * (openslide.org/demo/ links to real downloadable vendor-format samples —
 * that's the standard corpus used to test OpenSlide-based pipelines like
 * this one). Any real scanner export works; a plain pyramidal TIFF is NOT
 * a sufficient test since it doesn't exercise OpenSlide at all.
 *
 * The sandbox VM has its own full internet access (independent of wherever
 * this script itself is run from), so it downloads the sample directly —
 * this script only needs to reach the Vercel API.
 *
 * On success, prints a VERCEL_TILING_SNAPSHOT_ID to add to your env vars.
 */

import { Sandbox } from "@vercel/sandbox";

const sampleUrl = process.env.SAMPLE_SLIDE_URL;
if (!sampleUrl) {
  console.error("Set SAMPLE_SLIDE_URL to a real .svs/.ndpi/.mrxs/.tif test file URL.");
  process.exit(1);
}

function extFromUrl(url) {
  const match = new URL(url).pathname.match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1] : "svs";
}

async function run(sandbox, command, args, label) {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  const result = await sandbox.runCommand({ cmd: command, args, sudo: true });
  const stdout = await result.stdout();
  const stderr = await result.stderr();
  if (stdout.trim()) console.log(stdout.trim());
  if (stderr.trim()) console.error(stderr.trim());
  if (result.exitCode !== 0) {
    throw new Error(`${label ?? command} failed with exit code ${result.exitCode}`);
  }
  return { stdout, stderr };
}

// Explicit credentials (VERCEL_TOKEN/VERCEL_TEAM_ID/VERCEL_PROJECT_ID) take
// precedence when set — this is what lets the script run outside a linked
// Vercel checkout. Omitting all three falls back to the SDK's own OIDC
// resolution (works inside `vercel link`-ed local dev, or automatically in
// production on Vercel).
const explicitCredentials =
  process.env.VERCEL_TOKEN && process.env.VERCEL_TEAM_ID && process.env.VERCEL_PROJECT_ID
    ? {
        token: process.env.VERCEL_TOKEN,
        teamId: process.env.VERCEL_TEAM_ID,
        projectId: process.env.VERCEL_PROJECT_ID,
      }
    : {};

console.log("Creating sandbox...");
const sandbox = await Sandbox.create({
  timeout: 15 * 60 * 1000,
  resources: { vcpus: 4 },
  ...explicitCredentials,
});
console.log("Sandbox created:", sandbox.name);

try {
  await run(sandbox, "apt-get", ["update"], "apt-get update");
  await run(
    sandbox,
    "apt-get",
    ["install", "-y", "libvips-tools", "openslide-tools", "awscli"],
    "apt-get install",
  );

  const { stdout: vipsVersion } = await run(sandbox, "vips", ["--version"], "vips --version");
  console.log("libvips version:", vipsVersion.trim());

  // Functional proof, not just a flag check: does vips's openslide loader
  // actually exist and get invoked? `vipsheader -a` prints the loader it
  // picked, which will read "openslideload" only if OpenSlide support is
  // really compiled in and it recognized the vendor format.
  const ext = extFromUrl(sampleUrl);
  await run(sandbox, "curl", ["-fL", "-o", `/tmp/sample.${ext}`, sampleUrl], "download sample");
  const { stdout: header } = await run(
    sandbox,
    "vipsheader",
    ["-a", `/tmp/sample.${ext}`],
    "vipsheader",
  );
  console.log("\nvipsheader output:\n" + header);
  if (!/openslide/i.test(header)) {
    throw new Error(
      "vips did NOT use the openslide loader for this file — distro libvips-tools likely lacks " +
        "OpenSlide support. Don't proceed with the rest of the pipeline on this assumption; a custom " +
        "libvips build (or a different base image) would be needed instead.",
    );
  }

  console.log("\nRunning a real dzsave tiling pass (this is the actual production operation)...");
  await run(
    sandbox,
    "vips",
    [
      "dzsave",
      `/tmp/sample.${ext}`,
      "/tmp/dztest/slide",
      "--tile-size",
      "254",
      "--overlap",
      "1",
      "--suffix",
      ".jpg[Q=80]",
    ],
    "vips dzsave",
  );
  const { stdout: tileCount } = await run(
    sandbox,
    "bash",
    ["-c", "find /tmp/dztest/slide_files -type f | wc -l"],
    "count tiles",
  );
  console.log("Tiles produced:", tileCount.trim());

  console.log("\nAll checks passed. Snapshotting sandbox for reuse in production tiling jobs...");
  const snapshot = await sandbox.snapshot({ expiration: 0 });
  console.log("\n✅ Snapshot ID:", snapshot.id);
  console.log("Add this to your environment as TILING_SANDBOX_SNAPSHOT_ID.");
} finally {
  await sandbox.stop().catch(() => {});
}
