#!/bin/bash
# Tiles one slide inside the "Tile slide" GitHub Actions workflow
# (.github/workflows/tiling.yml). Talks only to the tiler Worker, which
# authenticates this run by its GitHub OIDC token: /runner/start hands over
# the slide URL and R2 credentials, /runner/callback relays the outcome to
# the app. Every run must end in exactly one callback -- nothing else
# watches it, so a silent death would leave the slide "processing" until
# reconcileStaleTilingJobs times it out.
#
#   run-tiling.sh                   tile the slide
#   run-tiling.sh report-failure M  report failure M unless already reported
#
# Env: TILER_URL, JOB_TOKEN (sealed job from the workflow input), plus the
# ACTIONS_ID_TOKEN_REQUEST_* vars the runner sets under id-token: write.
set -eo pipefail
AUDIENCE=hemoedge-tiler
REPORTED=/tmp/tiling-reported
LOG=/tmp/tiling.log

oidc_token() {
  curl -fsS -H "Authorization: bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN" \
    "${ACTIONS_ID_TOKEN_REQUEST_URL}&audience=${AUDIENCE}" | jq -r .value
}

# $1 = path, $2 = JSON body (the sealed job is added here)
tiler_post() {
  jq -c --arg job "$JOB_TOKEN" '. + {job: $job}' <<<"$2" |
    curl -fsS -X POST "${TILER_URL%/}$1" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $(oidc_token)" \
      --data-binary @-
}

report() {
  tiler_post /runner/callback "$1" >/dev/null && touch "$REPORTED"
}

if [ "$1" = "report-failure" ]; then
  [ -e "$REPORTED" ] && exit 0
  report "$(jq -nc --arg e "$2" '{status: "failed", error: $e}')"
  exit 0
fi

# The repo is public, so its Actions logs are too: keep slide URLs and tool
# output out of them. The log only ever leaves the runner as the error text
# of a failure callback, which goes to the app, not to GitHub.
exec 3>&1
exec >>"$LOG" 2>&1

report_failure() {
  local err
  err=$(tail -c 2000 "$LOG" 2>/dev/null || true)
  report "$(jq -nc --arg e "$err" '{status: "failed", error: $e}')" || true
}
trap report_failure ERR

start=$(tiler_post /runner/start '{}')
RAW_FILE_URL=$(jq -r .rawFileUrl <<<"$start")
BUCKET=$(jq -r .bucket <<<"$start")
PREFIX=$(jq -r .prefix <<<"$start")
ENDPOINT=$(jq -r .endpoint <<<"$start")
AWS_ACCESS_KEY_ID=$(jq -r .accessKeyId <<<"$start")
AWS_SECRET_ACCESS_KEY=$(jq -r .secretAccessKey <<<"$start")
# R2 ignores the region; newer AWS CLIs add checksums R2 may reject.
export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_DEFAULT_REGION=auto
export AWS_REQUEST_CHECKSUM_CALCULATION=when_required AWS_RESPONSE_CHECKSUM_VALIDATION=when_required
echo "::add-mask::$AWS_SECRET_ACCESS_KEY" >&3
echo "::add-mask::$RAW_FILE_URL" >&3

mkdir -p /tmp/work && cd /tmp/work
curl -fsSL "$RAW_FILE_URL" -o raw_slide
vips dzsave raw_slide tiles --tile-size 254 --overlap 1 --suffix ".jpg[Q=80]"
aws s3 cp tiles_files "s3://${BUCKET}/${PREFIX}/tiles_files" --recursive --only-show-errors --endpoint-url "$ENDPOINT"
aws s3 cp tiles.dzi "s3://${BUCKET}/${PREFIX}/tiles.dzi" --only-show-errors --endpoint-url "$ENDPOINT"

report '{"status":"ready"}'
echo "Tiling finished." >&3
