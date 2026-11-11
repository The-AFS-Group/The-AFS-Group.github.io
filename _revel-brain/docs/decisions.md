# Decisions and open questions

## Decided in this build (change any of them)

| Decision | Why |
|---|---|
| **Separate private repo** `The-AFS-Group/revel-brain`, not the dashboards repo | The dashboards repo is public, and its nightly bots push straight to `main`. Branch protection with two approvals there would stop every dashboard refresh. |
| **Upload page + email + Drive folder** feed one Apps Script, instead of a HubSpot form | One hand-off for every route, files land straight in Drive, the offshore team needs no HubSpot seat, and HubSpot forms can't pass files on without paid custom-code actions. Same pattern as the showroom check-in form. A HubSpot form can still link to the page. |
| **Approver emails** go through the Apps Script (`NOTIFY_EMAILS`), not just GitHub | Ben and Tristan get "Ready for your approval" in their normal inbox, with the GitHub link to approve (works in the GitHub mobile app). |
| **Both approvers enforced by a check**, not just "2 approvals" | GitHub's "2 approvals" can be met by any two people with write access. `brain/dual-approval` passes only when Tristan **and** Ben approved the latest commit. |
| **Approval dates stamped after merge** | Cards in a PR are `In review` with empty approval fields; after merge the stamp workflow writes `Live`, who approved, the date and `review_by` (+12 months). If anything goes wrong the cards stay `In review` and the bot ignores them, so it fails safe. |
| **Prices left out of cards** | They change with every promotion; Shopify is the source of truth. The bot points to the website. |
| **Seed cards are `markets: [AU]`** | The spec sheet is the AU site (230 V, AUD). NZ and US get added per card when confirmed. |
| **Categories:** the plan's four plus Sauna Hybrid, Heaters & Controls, Accessories, Bundles | NordicWave, Harvia heaters/Xenio, accessories and contrast packages don't fit the four. Barrel saunas sit in Sauna Traditional (`type: Barrel`); chillers in Ice Bath (`type: Chiller`). |
| **One PR per category** for the seed | About 25 cards per PR is reviewable on a phone. Heaters & Controls merges before Sauna Traditional and Hybrid (they link to heater cards). |
| **Claude runs with file tools only** in Actions | No git, no GitHub token, no network tools while it reads uploaded documents. Committing and opening the PR are separate scripted steps. |
| **Supplier and factory detail** stays out of customer cards (and out of the public staging copy) | Per the plan. The compliance cards quote certificate and test facts; the factory names and model lists go in `internal/` in the private repo. |

## Open questions (from the plan, plus what the spec sheet raised)

- [ ] Confirm the checking split, and who covers when Tristan or Ben is away. Today both must approve; a
      delegate means adding them to `brain.config.yml` approvers and changing the check to "any two of three".
- [ ] Claude seats: can the pilot group (and the offshore team) join a shared Project? If not, Phase 2 comes sooner.
- [ ] CSAT thresholds for the Phase 4 FAQ job (CSAT 4-5, not reopened in 14 days, 3+ tickets in 90 days).
- [ ] Which Revel products do the SAA certificate and the "RS" and "SK" EMF reports cover?
- [ ] Top-selling SKUs to review first. All 78 products are drafted, but the seed PRs can be merged in any order.
- [ ] NZ and US: which products are sold there, and with which electrical specs?
- [ ] Spec-sheet conflicts listed in each seed PR (e.g. Tampere Plus heater 9 kW vs 6 kW, the duplicate SW45 row,
      37.5 A circuits, infrared front clearance 600 mm vs "unobstructed", 70°C vs 65°C cut-off).
