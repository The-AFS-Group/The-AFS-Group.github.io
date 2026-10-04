---
name: gaf-wholesale-budget-refresh
description: Refresh the Wholesale channel's budget/target figures feeding the GAF Master Dashboard's Sales Health "Wholesale" card. Use this whenever the user says the Wholesale (or GAF Wholesale AU) budget/target has changed, provides a new NetSuite "AFS - Budget vs. Actual" export, or asks to update/refresh the Wholesale GP target. This is a data-only refresh of a Google Sheet tab, not a code change — it does not touch _src/gaf-master-dashboard/ and does not need the gaf-dashboard-deploy build/PR/merge loop.
---

# GAF Wholesale budget refresh

The Sales Health tab's "Wholesale" card (`SalesDashboard.tsx`'s `WholesaleGPCard`,
fed by `fetchWholesaleMonthly` in `dataService.ts`) gets its two numbers from two
different places in the same Google Sheet workbook
(`19vavqzSrf_ChdKoriScry_tAfIf-mAW2M8AZIYRR0uk`, no name beyond its ID — it's the
NetSuite→Sheets sync tool for AFS Group's Budget-vs-Actual reporting):

- **GP Invoiced (Actual)** — live, always correct. Computed client-side from the
  `GAF Wholesale Actuals` tab (gid `1261715133`), a raw NetSuite transaction log with
  a literal `Period` column per row. No refresh needed, ever — skip this skill
  entirely if the user only mentions actuals being wrong; that's a code bug, not a
  data staleness problem.
- **Target (Budget)** — a frozen snapshot in the `Wholesale Monthly Budget FY27` tab
  (gid `555000001`), one row per FY27 month. **This is what this skill refreshes.**

## Why it's not live

Two dead ends were already tried and ruled out — don't re-attempt either:

1. **The `Wholesale BvA Dashboard` tab's "Select Month" dropdown (cell B1) looks
   live but isn't.** Its Budget/Actual columns are plain pasted values, not
   formulas — confirmed by flipping the dropdown and reading the cells back
   unchanged. Changing it appears to kick off an external NetSuite sync job (see
   that workbook's `Request Logs` tab, full of timeout errors) asynchronously and
   unreliably. **Never write to that tab's B1 cell.** If you need to double-check
   this finding still holds, read `C4:D4` there with `includeGridData` and confirm
   `userEnteredValue` is a plain number, not a `formulaValue`.
2. **NetSuite's `ns_runReport` API tool doesn't respect a saved report's own
   department/class filter.** Running report ID `1581` ("AFS - Budget vs. Actual")
   or `1557` ("Budget vs Actual - Wholesale AU Division") via the API, with just
   `subsidiaryId`/`dateFrom`/`dateTo`/`range` params, returns identical
   whole-of-AFS numbers with `Budget Amount` null on every row — not the
   Wholesale-scoped, budget-populated figures the user sees in their browser. The
   tool has no department/class parameter to fix this. **Don't try to automate
   this report via the API** — it silently returns wrong-scope data that looks
   plausible.

So: Actuals come from a tab that happens to update itself reliably; Budget has to
be a manual capture from a NetSuite report the user exports from their own
authenticated browser session, because nothing else reaches it correctly.

## When to run this

The user says something like "the wholesale budget changed", "update the Wholesale
target", "here's the new budget export", or attaches a NetSuite CSV export. They
may give you a fresh export unprompted, or you may need to ask for one.

## Steps

1. **Get the export.** Ask the user to open NetSuite's **"AFS - Budget vs. Actual"**
   report (internal ID 1581) scoped to the **Wholesale AU division**, for the
   FY27 date range (Jul 2026–Jun 2027, or whatever the then-current fiscal year
   is), with monthly columns, and export/download it as CSV from their own
   browser session — not something to fetch yourself via the NetSuite API (see
   above). If they paste a NetSuite Report Runner URL instead of a file, the
   report ID in its `cr=` query param should be `1581`; if it's a different ID,
   find it via `ns_listAllReports` and grep its title for "Budget vs Actual" +
   "Wholesale" to sanity-check before trusting the export.

2. **Parse it precisely with Python, not by hand.** The file has a multi-row
   header (month names spanning 4 columns each: Amount, Budget Amount, Amount
   Over Budget, % of Budget) and dollar-formatted strings. Use `csv.reader`,
   find rows by their exact label in column 0 (`"Total - Income"`,
   `"Total - Cost Of Sales"`, `"Gross Profit"`), and pull `Budget Amount` for
   each of the 12 month blocks (column index `2 + 4*i` for month `i`,
   0-indexed from the first month column). Sanity-check by confirming
   `Income - COGS` matches the report's own `Gross Profit` row for both Actual
   and Budget, for every month — if they don't match, the column offsets are
   wrong, stop and recheck before writing anything.

3. **Overwrite the `Wholesale Monthly Budget FY27` tab**, not append to it —
   it holds exactly one row per FY month (`Jul 2026` … `Jun 2027`) in that
   order, columns `Month | Revenue Budget | COGS Budget | GP Budget |
   Revenue Actual (NetSuite export) | COGS Actual (NetSuite export) |
   GP Actual (NetSuite export)`. Use `mcp__Google_Sheets__update_values` on
   `'Wholesale Monthly Budget FY27'!A2:G13` with the new figures (keep the
   header row as-is). The "Actual (NetSuite export)" columns are a reference
   snapshot only — the dashboard never reads them — but keep them in sync with
   the export for anyone auditing the sheet by eye.

4. **Update the source note.** Cell A1 carries a note with the export date and
   who ran it (`Source: NetSuite report "AFS - Budget vs. Actual" ...`). Replace
   it with the new date via `updateCells` (`fields: "note"`), so the sheet
   itself shows how fresh the capture is without needing to ask you.

5. **Verify** with `get_values` on the tab: check the numbers landed, in the
   right months, with no `#VALUE!`/blank cells, and that currency formatting
   held (if it didn't, re-apply `userEnteredFormat.numberFormat` the way the
   tab was originally built — `CURRENCY`, pattern `$#,##0.00;($#,##0.00);"-"`).

6. **No code change, no deploy.** `fetchWholesaleMonthly` already reads this
   tab live by month label at render time — refreshing its contents is the
   entire fix. Don't touch `_src/gaf-master-dashboard/`, don't rebuild, don't
   open a PR. Tell the user the live dashboard will reflect the new target the
   next time the page loads, nothing to deploy.

## If the tab's gid or the workbook's publish link ever changes

Both are hardcoded in `_src/gaf-master-dashboard/services/dataService.ts` under
`URLS.WHOLESALE.budget` (and `.actuals` for the live feed). If the user says the
published link broke or the sheet was republished under a new ID, that's a code
change — use `gaf-dashboard-deploy` for that part, not this skill.
