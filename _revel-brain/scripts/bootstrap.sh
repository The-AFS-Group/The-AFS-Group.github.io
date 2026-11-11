#!/usr/bin/env bash
# One-time setup of the private Brain repository, with every approval rule in place.
#
# Run by an owner of the The-AFS-Group GitHub organisation, from this folder:
#
#   cd _revel-brain
#   scripts/bootstrap.sh <tristan-github-username> [ben-github-username]
#
# Needs: gh (logged in with `gh auth login`, scopes repo + workflow + admin:org), git, ssh-keygen.
# Safe to re-run: existing repo, labels and key are left alone; seed PRs aren't duplicated.
#
# What it does:
#   1. creates The-AFS-Group/revel-brain (private) and gives Tristan and Ben write access
#   2. lets GitHub Actions open PRs, squash-merge only, deletes merged branches
#   3. adds the approval-stamp deploy key (secret STAMP_DEPLOY_KEY)
#   4. pushes the framework (rules, template, scripts, workflows) to main
#   5. turns on the main ruleset: PR required, 2 approvals, code owners, stale approvals
#      dismissed, required checks brain/validate + brain/dual-approval
#   6. pushes one seed/<category> branch per category and has the bot open a PR for each
set -euo pipefail

TRISTAN="${1:?usage: scripts/bootstrap.sh <tristan-github-username> [ben-github-username]}"
BEN="${2:-benc-revel}"
ORG="${ORG:-The-AFS-Group}"
NAME="${NAME:-revel-brain}"
REPO="$ORG/$NAME"
SRC="$(cd "$(dirname "$0")/.." && pwd)"

for t in gh git ssh-keygen; do command -v "$t" > /dev/null || { echo "Missing $t"; exit 1; }; done
gh auth status > /dev/null

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cp -R "$SRC"/. "$WORK/repo"
cd "$WORK/repo"
rm -rf .git scripts/__pycache__

echo "== 1. Approver usernames: $TRISTAN, $BEN"
for f in brain.config.yml .github/CODEOWNERS; do
  sed -i.bak -e "s/TRISTAN_GITHUB_USERNAME/$TRISTAN/g" -e "s/benc-revel/$BEN/g" "$f" && rm -f "$f.bak"
done

echo "== 2. Repository $REPO"
if ! gh repo view "$REPO" > /dev/null 2>&1; then
  gh repo create "$REPO" --private --description "Revel Wellness Brain: approved product knowledge" --disable-wiki
fi
gh api -X PATCH "repos/$REPO" -F allow_squash_merge=true -F allow_merge_commit=false \
  -F allow_rebase_merge=false -F delete_branch_on_merge=true -F has_projects=false > /dev/null
# Bot-opened PRs need this. Bot approvals don't count: brain/dual-approval only accepts Tristan and Ben.
gh api -X PUT "repos/$REPO/actions/permissions/workflow" -f default_workflow_permissions=read \
  -F can_approve_pull_request_reviews=true > /dev/null
for U in "$TRISTAN" "$BEN"; do
  gh api -X PUT "repos/$REPO/collaborators/$U" -f permission=push > /dev/null || echo "   (could not add $U; add them by hand)"
done

echo "== 3. Approval-stamp deploy key"
if ! gh repo deploy-key list --repo "$REPO" 2>/dev/null | grep -q "brain-stamp"; then
  ssh-keygen -q -t ed25519 -N "" -C "brain-stamp" -f "$WORK/stamp_key"
  gh repo deploy-key add "$WORK/stamp_key.pub" --repo "$REPO" --allow-write --title "brain-stamp (approval stamp workflow)"
  gh secret set STAMP_DEPLOY_KEY --repo "$REPO" < "$WORK/stamp_key"
  rm -f "$WORK/stamp_key" "$WORK/stamp_key.pub"
fi

echo "== 4. Labels"
while IFS='|' read -r L C D; do
  gh label create "$L" --repo "$REPO" --color "$C" --description "$D" --force > /dev/null
done <<'EOF'
brain-inbox|0E8A16|New knowledge submitted to the Brain
brain-draft|1D76DB|Card change drafted by Claude, waiting for approval
drafted|C5DEF5|Inbox item has a draft PR
seed|5319E7|Seed content from the product spec sheet
faq-candidate|FBCA04|FAQ drafted from highly rated CS answers
review-due|D93F0B|Cards reaching their review date
needs-attention|B60205|Something failed or needs a human
no-change|EDEDED|Already covered, nothing to change
digest|BFD4F2|Weekly digest for the approvers
EOF

echo "== 5. Framework on main"
# Content goes to main only through approved PRs: set the seed cards aside for their branches.
mkdir -p "$WORK/seed-cards" "$WORK/seed-compliance"
for d in cards/*/; do mv "$d" "$WORK/seed-cards/"; done
find compliance -maxdepth 1 -name '*.md' ! -name README.md -exec mv {} "$WORK/seed-compliance/" \;
git init -q -b main
git add -A
git -c user.name="revel-brain-setup" -c user.email="revel-brain-setup@users.noreply.github.com" \
  commit -q -m "Brain framework: template, rules, scripts and workflows"
git remote add origin "https://github.com/$REPO.git"
if git ls-remote --exit-code --heads origin main > /dev/null 2>&1; then
  echo "   main already exists; not overwriting it"
else
  git push -q -u origin main
fi

echo "== 6. Ruleset on main"
if gh api "repos/$REPO/rulesets" --jq '.[].name' | grep -q "both approvers"; then
  echo "   ruleset already in place"
else
  gh api -X POST "repos/$REPO/rulesets" --input scripts/ruleset.json > /dev/null
fi

echo "== 7. Seed branches"
git fetch -q origin main
for d in "$WORK"/seed-cards/*/; do
  CAT="$(basename "$d")"
  B="seed/$CAT"
  if git ls-remote --exit-code --heads origin "$B" > /dev/null 2>&1; then echo "   $B exists"; continue; fi
  git checkout -q -B "$B" origin/main
  mkdir -p cards && cp -R "$d" "cards/$CAT"
  git add -A cards
  git -c user.name="revel-brain-setup" -c user.email="revel-brain-setup@users.noreply.github.com" \
    commit -q -m "Seed: $CAT from Revel Product Spec Sheets.xlsx"
  git push -q origin "$B"
  echo "   pushed $B"
done

if [ -n "$(ls -A "$WORK/seed-compliance")" ] && ! git ls-remote --exit-code --heads origin seed/compliance > /dev/null 2>&1; then
  git checkout -q -B seed/compliance origin/main
  cp "$WORK"/seed-compliance/*.md compliance/
  git add -A compliance
  git -c user.name="revel-brain-setup" -c user.email="revel-brain-setup@users.noreply.github.com" \
    commit -q -m "Seed: compliance certificates and EMF test reports"
  git push -q origin seed/compliance
  echo "   pushed seed/compliance"
fi

echo "== 8. Bot opens the seed PRs"
sleep 5
gh workflow run open-seed-prs.yml --repo "$REPO" --ref main || echo "   run 'Open seed pull requests' from the Actions tab"

cat <<EOF

Done: https://github.com/$REPO

Still to do (see docs/setup.md):
  - Secret ANTHROPIC_API_KEY (or CLAUDE_CODE_OAUTH_TOKEN) so Claude can draft.
  - Secrets BRAIN_INBOX_URL and BRAIN_INBOX_STATUS_TOKEN once the Brain Inbox Apps Script is deployed.
  - A fine-grained token for the Apps Script (revel-brain only: Contents + Issues read/write).
  - Create the "Revel Wellness Brain" Claude Project and connect this repo (chatbot/setup.md).
EOF
