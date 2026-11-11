# Revel Wellness Brain

One private, version-controlled store of approved product knowledge for every Revel sauna, ice
bath and red light product, read by an internal chatbot. **Nothing goes live until both Tristan
Krutz and Ben Coleman approve it.**

> This folder is the seed of the private repository `The-AFS-Group/revel-brain`. It's staged inside
> the public dashboards repo only so it could be built and reviewed. Run `scripts/bootstrap.sh` to
> create the private repo, then delete this folder from the dashboards repo.

## How it works

1. **Capture.** Anyone sends material through the [Brain Inbox](../revel-brain-inbox/): the upload page,
   email, or the Drive drop folder. Each submission gets a reference, a receipt, and an email to
   Tristan and Ben.
2. **Draft.** The submission becomes a `brain-inbox` issue here. Claude Code drafts or updates the
   cards in the standard template, checks them against every other card, and opens a pull request
   with the source files, a plain-English summary, before/after, and any conflicts.
3. **Approve.** Tristan and Ben both review, from email or the GitHub app. "Request changes" sends it
   back to Claude to redraft. Any new commit resets both approvals.
4. **Live.** On merge, the stamp records who approved and when, sets a 12-month review date, and
   rebuilds `INDEX.md`. The chatbot (a Claude Project synced to `main`) answers only from Live cards
   and cites the card and approval date.

## Layout

```
cards/<category>/<product>/<topic>.md   one card per product per topic
compliance/                             shared certificates and test reports
policies/                               delivery, returns, warranty policy
faq/                                    approved FAQs
internal/                               commercial-in-confidence (never pasted to customers)
sources/inbox/BRAIN-NNNN/               the original files behind each change
INDEX.md                                catalogue + SKU lookup (generated)
brain.config.yml                        approvers, categories, topics, review cycle
templates/card.md                       the one card template
CLAUDE.md                               drafting rules for Claude
chatbot/                                Claude Project instructions and setup
docs/                                   setup, endpoints, decisions
scripts/                                checks, importer, stamp, bootstrap
seed/                                   descriptions for the seed pull requests
```

## What's here today

- **194 draft cards for 78 products** from *Revel Product Spec Sheets.xlsx*: specs, electrical,
  install, care and warranty, with heater circuit tables decoded from the SKUs. All `In review`.
- **3 compliance cards** from the SAA certificate and the two EMF test reports.
- **79 flags** for the approvers (conflicts, missing data, claims), listed in each seed PR.

## Commands

```bash
pip install pyyaml openpyxl
python3 scripts/brain.py validate                 # card format (add --base origin/main on a branch)
python3 scripts/brain.py conflicts                # cross-card conflicts, internal terms, claims
python3 scripts/brain.py index                    # rebuild INDEX.md
python3 scripts/brain.py due --days 30            # cards due for review
python3 scripts/import_spec_sheet.py <xlsx> --as-of YYYY-MM-DD   # re-import the spec sheet
```

Start with `docs/setup.md`.
