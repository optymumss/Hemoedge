/**
 * The shell script a tiling sandbox runs, built from the already-verified
 * spike (scripts/prepare-tiling-snapshot.mjs confirmed distro libvips-tools
 * genuinely has OpenSlide support). Runs entirely in shell rather than a
 * Node script inside the sandbox — libvips-tools + openslide-tools + awscli
 * (already installed on the saved snapshot) cover everything needed, and it
 * keeps the sandbox's only dependency on the outside world to curl.
 *
 * Always reports back to the callback route, success or failure, since
 * nothing else is watching this sandbox run — a script that dies silently
 * would leave the slide stuck in "processing" forever.
 */
export function buildTilingScript(params: {
  jobId: string;
  slideId: string;
  rawFileUrl: string;
  callbackUrl: string;
  callbackSecret: string;
  r2AccountId: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2BucketName: string;
  r2PublicUrl: string;
}): string {
  const {
    jobId,
    slideId,
    rawFileUrl,
    callbackUrl,
    callbackSecret,
    r2AccountId,
    r2AccessKeyId,
    r2SecretAccessKey,
    r2BucketName,
    r2PublicUrl,
  } = params;

  const tilesKeyPrefix = `tiles/${slideId}`;

  return `#!/bin/bash
set -e
LOG=/tmp/tiling.log
exec >> "$LOG" 2>&1

report_failure() {
  local err
  err=$(tail -c 2000 "$LOG" 2>/dev/null | sed 's/"/\\\\"/g' | tr '\\n' ' ')
  curl -fsSL -X POST "${callbackUrl}" \\
    -H "Content-Type: application/json" \\
    -H "Authorization: Bearer ${callbackSecret}" \\
    -d "{\\"job_id\\":\\"${jobId}\\",\\"slide_id\\":\\"${slideId}\\",\\"status\\":\\"failed\\",\\"error\\":\\"$err\\"}" || true
}
trap report_failure ERR

export AWS_ACCESS_KEY_ID="${r2AccessKeyId}"
export AWS_SECRET_ACCESS_KEY="${r2SecretAccessKey}"
R2_ENDPOINT="https://${r2AccountId}.r2.cloudflarestorage.com"

mkdir -p /tmp/work && cd /tmp/work
curl -fSL "${rawFileUrl}" -o raw_slide

vips dzsave raw_slide tiles --tile-size 254 --overlap 1 --suffix ".jpg[Q=80]"

aws s3 cp tiles_files "s3://${r2BucketName}/${tilesKeyPrefix}/tiles_files" \\
  --recursive --endpoint-url "$R2_ENDPOINT"
aws s3 cp tiles.dzi "s3://${r2BucketName}/${tilesKeyPrefix}/tiles.dzi" \\
  --endpoint-url "$R2_ENDPOINT"

MANIFEST_URL="${r2PublicUrl}/${tilesKeyPrefix}/tiles.dzi"
curl -fsSL -X POST "${callbackUrl}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${callbackSecret}" \\
  -d "{\\"job_id\\":\\"${jobId}\\",\\"slide_id\\":\\"${slideId}\\",\\"status\\":\\"ready\\",\\"manifest_url\\":\\"$MANIFEST_URL\\"}"
`;
}
