# Phase 1 (Foundation) setup · 9 to 20 Nov

In order. Steps marked **you** need a person with the right account. Everything else is built.

| # | Step | Who | Time |
|---|---|---|---|
| 1 | Review the plan decisions in `docs/decisions.md`; confirm the approval split and cover | Ben, Tristan | 15 min |
| 2 | Tell Claude Tristan's GitHub username (Ben's is taken as `benc-revel`) | **you** | 1 min |
| 3 | Confirm the org is on **GitHub Team** (or higher): rulesets on private repos need it | **you** (org owner) | 2 min |
| 4 | Run `scripts/bootstrap.sh <tristan-username>` from this folder | **you** (org owner) | 5 min |
| 5 | Add the drafting secret: `ANTHROPIC_API_KEY` (Claude Console) or `CLAUDE_CODE_OAUTH_TOKEN` (`claude setup-token`) | **you** | 5 min |
| 6 | Set up the Brain Inbox Apps Script (`revel-brain-inbox/README.md`), with Ben's and Tristan's emails in `NOTIFY_EMAILS` | **you** (Ben's Google account) | 20 min |
| 7 | Put the Apps Script `/exec` URL in `revel-brain-inbox/config.js` and publish | Claude, once you send the URL | 2 min |
| 8 | Connect the Inbox to GitHub: fine-grained token in the Apps Script; `BRAIN_INBOX_URL` + `BRAIN_INBOX_STATUS_TOKEN` secrets in `revel-brain` | **you** | 10 min |
| 9 | **Test card end to end:** upload the SAA certificate on the page → issue → Claude's PR → both approve → stamp → Live → ask the chatbot | Ben, Tristan | 30 min |
| 10 | Create the Claude Project (`chatbot/setup.md`) | **you** | 15 min |

Milestone **Test card approved** = step 9 done.

## After Foundation

- **Seed content (23 Nov to 18 Dec):** work through the seed PRs, top sellers first. Heaters &
  Controls before Sauna Traditional and Hybrid. Answer the questions in each PR (comment, or
  "Request changes" and Claude redrafts). Upload the product manuals through the Inbox to add
  install and care cards.
- **Chatbot pilot (11 to 29 Jan):** share the Project with CS and sales; log every gap through the Inbox.
- **FAQs and rollout (1 to 26 Feb):** the weekly HubSpot FAQ job (reuses
  `_pipelines/revel-service-insights/hubspot.py` from the dashboards repo), then the Phase 2 decision.

## If something goes wrong

| Symptom | Fix |
|---|---|
| Inbox issue has `needs-attention` | Open the run log linked in the issue comment. Re-run from Actions, or remove and re-add the `brain-inbox` label. |
| PR can't merge, `brain/validate` failed | Read the "Brain checks" comment on the PR. Request changes with what to fix, or comment `/redraft`. |
| `brain/dual-approval` stuck on "Waiting for…" | Someone pushed after your approval. Approve again. |
| Merged but cards still "In review" | The stamp needs `STAMP_DEPLOY_KEY` and the ruleset's deploy-key bypass. Re-run "Stamp approval" or see the issue it opened. |
| Inbox submissions stay "Received" | `GITHUB_TOKEN` missing or expired in the Apps Script. Run `checkSettings`; see the *Log* tab. |
| No emails | `NOTIFY_EMAILS` missing, or the Apps Script wasn't authorised to send mail. Run `testSubmission`. |
