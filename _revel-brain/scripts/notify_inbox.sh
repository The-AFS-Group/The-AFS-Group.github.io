#!/usr/bin/env bash
# Tell the Brain Inbox (Apps Script) about a status change. It updates the tracker sheet and
# emails the submitter and the approvers.
#
#   scripts/notify_inbox.sh <status> <url> <note> [REF ...]
#   scripts/notify_inbox.sh digest "" "" digest.md         # weekly digest email to the approvers
#
# Needs repository secrets BRAIN_INBOX_URL (the Apps Script /exec URL) and BRAIN_INBOX_STATUS_TOKEN
# (same value as STATUS_TOKEN in the Apps Script). Does nothing if they're not set.
set -euo pipefail

status="${1:?status}"; url="${2:-}"; note="${3:-}"; shift 3 || true
if [[ -z "${BRAIN_INBOX_URL:-}" || -z "${BRAIN_INBOX_STATUS_TOKEN:-}" ]]; then
  echo "Brain Inbox not configured (BRAIN_INBOX_URL / BRAIN_INBOX_STATUS_TOKEN); skipping notify."
  exit 0
fi

body=$(mktemp)
if [[ "$status" == "digest" ]]; then
  python3 - "$body" "${1:?digest markdown file}" <<'PY'
import json, os, sys
json.dump({"action": "digest", "token": os.environ["BRAIN_INBOX_STATUS_TOKEN"],
           "markdown": open(sys.argv[2], encoding="utf-8").read()}, open(sys.argv[1], "w"))
PY
else
  [[ $# -gt 0 ]] || { echo "No Brain Inbox refs to notify."; exit 0; }
  python3 - "$body" "$status" "$url" "$note" "$@" <<'PY'
import json, os, sys
out, status, url, note, *refs = sys.argv[1:]
json.dump({"action": "status", "token": os.environ["BRAIN_INBOX_STATUS_TOKEN"], "refs": refs,
           "status": status, "url": url, "note": note[:1500]}, open(out, "w"))
PY
fi

# No -X POST: Apps Script answers with a redirect that must be followed with GET.
code=$(curl -sS -L -o /dev/null -w "%{http_code}" -H "Content-Type: application/json" \
  --data-binary @"$body" "$BRAIN_INBOX_URL" || echo "000")
rm -f "$body"
echo "Brain Inbox notify ($status): HTTP $code"
