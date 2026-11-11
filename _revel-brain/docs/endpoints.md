# Brain endpoints

Every way into and out of the Brain, and what each one expects.

```
 CAPTURE                            DRAFT                         APPROVE                     LIVE
 Upload page ─┐                                                   Tristan ─┐
 Email ───────┼─> Apps Script ──> issue "brain-inbox" ──> Claude ──> PR ───┤ both ──> main ──> stamp ──> Claude Project
 Drive folder ┘   (Drive, Sheet,   + files on branch      drafts     Ben ──┘ approve   (Live,       (chatbot)
 Ask Claude ──┘    emails)          inbox/brain-NNNN      cards                         dates)
 Review due (weekly) ─────────────> issue "brain-inbox" ──┘
```

## 1. Capture

| Endpoint | Address | Who |
|---|---|---|
| Upload page | `https://the-afs-group.github.io/revel-brain-inbox/` (team code needed) | Everyone |
| Track page | `https://the-afs-group.github.io/revel-brain-inbox/#track` or `#track=BRAIN-0007` | Everyone |
| Email | The Apps Script's `INTAKE_ADDRESS`, e.g. `firstname+brain@revelsaunas.com`. Attach the files; the subject and body become the note | Staff on `ALLOWED_DOMAINS` |
| Drive folder | *Revel Brain Inbox / Drop files here* (shared as Editor) | Product, ops, suppliers via staff |
| Ask Claude | The chatbot replies with a pre-filled upload-page link (below) | Anyone using the chatbot |
| GitHub issue | New issue with label `brain-inbox` in `revel-brain` | Tristan, Ben |

**Pre-filled upload link** (used by the chatbot):
`/revel-brain-inbox/?channel=ask-claude&product=<name>&topic=<topic>&note=<text>&markets=AU,NZ&doctype=<type>`

## 2. Brain Inbox web app (Google Apps Script)

One URL, the deployment's `/exec`. Requests are JSON sent as `text/plain` (no CORS preflight).
Responses are JSON: `{ "ok": true, ... }` or `{ "ok": false, "error": "...", "permanent": true? }`.

| Call | Auth | Body or query | Returns |
|---|---|---|---|
| `GET ?action=config&code=` | team code | | `intakeAddress`, `dropFolder`, `maxFileMb`, `maxFiles` |
| `GET ?action=track&code=` | team code | | latest 200: `ref, received, channel, name` (first name), `product, topic, files, status, updated, note, pr` |
| `POST begin` | `code` | `submission: {name, email, team, product, topic, docType, markets[], note, confidential, fileCount, channel}` | `ref` (BRAIN-0007), `key` |
| `POST upload` | `code`, `key` | `ref, name, mime, data` (base64, max 25 MB) | `id`; repeats are ignored (`duplicate: true`) |
| `POST finish` | `code`, `key` | `ref` | `ref`, `trackUrl`; emails the approvers and sends the receipt |
| `POST status` | `token` | `refs[], status, url, note` | updates the tracker; emails the sender and approvers on change |
| `POST digest` | `token` | `markdown` | emails the weekly digest to the approvers |

`token` is the Script property `STATUS_TOKEN` = GitHub secret `BRAIN_INBOX_STATUS_TOKEN`.

**Tracker statuses:** Uploading → Received → Sent to Claude → In review → (Changes requested → In
review) → Live. Or: Not accepted, No change needed, Needs attention.

**Timed work (every 10 minutes):** read the intake Gmail, collect the drop folder, then send each
*Received* submission to GitHub. That means creating branch `inbox/brain-0007`, committing the files
to `sources/inbox/BRAIN-0007/` (files over 30 MB stay in Drive and are linked), adding
`submission.md`, and opening the issue.

## 3. GitHub (private repo `The-AFS-Group/revel-brain`)

**Issue contract.** A `brain-inbox` issue starts a draft. The Apps Script adds this marker so the
workflow finds the files:
`<!-- brain-inbox ref=BRAIN-0007 branch=inbox/brain-0007 -->`. Issues without it draft on
`draft/issue-<n>` from the issue text alone.

**PR contract.** Draft PRs carry `<!-- brain-refs: BRAIN-0007 -->` so status changes reach the right
submitters, and `Closes #<issue>`.

| Workflow | Runs on | Does |
|---|---|---|
| `draft.yml` | issue opened/labelled `brain-inbox`; manual (`issue`) | extracts text, Claude drafts cards, commits, opens PR, starts checks, tells the Inbox "In review" |
| `brain-checks.yml` | PR events; manual (`pr`) | `brain.py validate` + `conflicts`; status **`brain/validate`**; sticky PR comment |
| `approvals.yml` | reviews, PR events; manual (`pr`) | status **`brain/dual-approval`**: success only when both approvers approved the head commit; tracker updates |
| `redraft.yml` | review "Request changes" by an approver, or comment `/redraft` | Claude redrafts on the same branch from the review comments |
| `stamp.yml` | push to `main` | stamps `status: Live`, `approved_by`, `approved_on`, `approval_pr`, `review_by` on the merged cards; rebuilds `INDEX.md`; tells the Inbox "Live" |
| `review-due.yml` | Mondays 7:41am AEST; manual | opens a `review-due` inbox issue for cards due within 30 days |
| `digest.yml` | Mondays 7:53am AEST; manual | digest issue assigned to both approvers + email |
| `open-seed-prs.yml` | manual (bootstrap) | opens one PR per `seed/*` branch as the bot |

**Required to merge `main`** (ruleset): a pull request, 2 approvals, code-owner review, stale
approvals dismissed on new commits, last push approved by someone else, and statuses
`brain/validate` + `brain/dual-approval`. Only the stamp deploy key bypasses it, and the stamp
only writes approval fields and `INDEX.md`.

**Secrets:** `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` (drafting), `STAMP_DEPLOY_KEY` (set by
bootstrap), `BRAIN_INBOX_URL`, `BRAIN_INBOX_STATUS_TOKEN`.

**Labels:** `brain-inbox`, `brain-draft`, `drafted`, `seed`, `faq-candidate`, `review-due`,
`needs-attention`, `no-change`, `digest`.

## 4. Live

| Endpoint | What |
|---|---|
| `main` branch | The only approved content. Cards with `status: Live` (or `Retired` for legacy) |
| `INDEX.md` | Generated catalogue + SKU lookup, rebuilt after every merge |
| Claude Project *Revel Wellness Brain* | Phase 1 chatbot, synced from `main` (see `chatbot/setup.md`) |

## 5. Emails

| Email | To | When |
|---|---|---|
| [Brain] New submission BRAIN-0007 … | Approvers (`NOTIFY_EMAILS`) | Any route, as soon as it's received |
| [Brain] Got it: BRAIN-0007 | Sender | Same time |
| [Brain] Ready for your approval: BRAIN-0007 … | Approvers | Claude's PR is open (with the GitHub link) |
| [Brain] BRAIN-0007: In review / Live / Not accepted / No change needed | Sender | Status changes |
| [Brain] Needs attention | Approvers | GitHub unreachable after 5 tries, or drafting failed |
| [Brain] Weekly digest | Approvers | Mondays |
| GitHub review requests and digest issue | Tristan, Ben (GitHub notifications) | Every PR (code owners) and Mondays |
