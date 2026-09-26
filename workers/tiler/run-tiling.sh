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
curl -fsSL "$RAW_FILE_URL" -o raw_slide
vips dzsave raw_slide tiles --tile-size 254 --overlap 1 --suffix ".jpg[Q=80]"
aws s3 cp tiles_files "s3://${R2_BUCKET_NAME}/${PREFIX}/tiles_files" --recursive --endpoint-url "$R2_ENDPOINT"
aws s3 cp tiles.dzi "s3://${R2_BUCKET_NAME}/${PREFIX}/tiles.dzi" --endpoint-url "$R2_ENDPOINT"

post_callback "{\"job_id\":\"$JOB_ID\",\"slide_id\":\"$SLIDE_ID\",\"status\":\"ready\",\"manifest_url\":\"${R2_PUBLIC_URL}/${PREFIX}/tiles.dzi\"}"
