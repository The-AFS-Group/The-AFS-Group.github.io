---
name: gaf-dashboard-deploy
description: Edit-to-live workflow for the GAF Master Dashboard (a Vite/React app whose source lives in _src/gaf-master-dashboard/ and whose built output is served straight from the repo root at gaf-master-dashboard/ via GitHub Pages). Use this whenever the user asks to fix, update, tweak, or change anything about the GAF Master Dashboard, GAF dashboard, or master dashboard — copy text, labels, colors, chart logic, a typo, a component, data handling, anything in that app. This skill covers the whole path from source edit through rebuild, syncing the built assets, committing, opening a PR, and merging straight to main so the change goes live — do this automatically without pausing for merge confirmation, since "push straight to live" is this skill's whole point and the user has given standing authorization for it.
---

# GAF Dashboard: edit → build → sync → PR → merge (live)

This app is a static export: the source of truth is the Vite/React project at
`_src/gaf-master-dashboard/`, but what's actually served on GitHub Pages is the
pre-built output committed at the repo root under `gaf-master-dashboard/`.
Editing only the source, or only the root copy, leaves the two out of sync —
every change must flow through both, in one commit, then merge to `main`
because merging *is* the deploy step for this repo.

## Checklist

1. **Edit the source.** Make the requested change in
   `_src/gaf-master-dashboard/` (components/, hooks/, services/, etc.). Never
   hand-edit files under the root `gaf-master-dashboard/` directly — they're
   generated output and will be overwritten by the next build.

2. **Build it.**
   ```
   cd _src/gaf-master-dashboard
   [ -d node_modules ] || npm install
   npm run build
   ```
   This runs `vite build --base=/gaf-master-dashboard/` and produces `dist/`.

3. **Sync the build into the deployed directory.** Vite content-hashes asset
   filenames, so the JS/CSS bundle names change on every build. Copying
   without cleaning up leaves orphaned old bundles behind:
   - Copy `dist/index.html` → `gaf-master-dashboard/index.html`
   - Copy every file in `dist/assets/` → `gaf-master-dashboard/assets/`
   - Diff the new `index.html` against old `gaf-master-dashboard/assets/*`:
     delete any hashed asset file no longer referenced (the old
     `index-XXXXXXXX.js`/`.css`). Files whose hash is unchanged (e.g. the CSS
     bundle, if styles didn't change) don't need touching.
   - Other static files served from the root dir (e.g. `hgb-tracker.json`)
     only need re-copying if the build actually changed them.

4. **Verify the change actually landed.** Grep the new built JS bundle in
   `gaf-master-dashboard/assets/` for the old text (should be gone) and/or the
   new text (should be present). This catches a stale bundle reference or a
   build that silently didn't pick up the edit, before it ships.

5. **Commit source + synced output together**, one commit — a partial commit
   (source without the rebuilt output, or vice versa) breaks the live site or
   leaves the fix undeployed. `_src/gaf-master-dashboard/node_modules/` and
   `dist/` are gitignored and must never be committed; if `git status` shows
   them, something's wrong upstream, don't force-add them.

6. **Push, open a PR, and merge it straight to main.**
   - Push the branch: `git push -u origin <branch-name>`
   - Open a PR with `mcp__github__create_pull_request` (base `main`)
   - Immediately merge it with `mcp__github__merge_pull_request` — do not
     stop to ask for confirmation on the merge step itself. The user has
     already authorized "push straight to live" as the standing behavior for
     this dashboard; pausing here defeats the purpose of the automation.
     (Normal judgment still applies to the *content* of the change — if a
     request is ambiguous or destructive in a way unrelated to "should this
     merge", clarify that before you even get to build/commit.)

That's the full loop. When in doubt about what "done" means for this skill:
source edited, dist rebuilt, root assets synced and pruned, fix verified in
the built bundle, one commit, PR merged to main.
