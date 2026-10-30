# Revel call insights pipeline

Feeds the **Revel call insights** dashboard at `revel-call-insights/`: what customers ask for,
why they call, rapport, unprompted price offers vs customer price pressure, sentiment, and why
sales don't close. Filterable by sales person, day, week, month, product category and call
direction.

```
Aircall (Revel Saunas line) -> AI call analysis -> published Google Sheet (CSV, ~100 MB)
  -> build.py (nightly GitHub Action, 5:43am AEST) -> revel-call-insights/data.js (~2 MB)
  -> revel-call-insights/index.html
```

The sheet is the same one the master dashboard's Call Insights tab reads. It holds one row per
call, with the AI's analysis fields and the transcript. Only rows with `should_analyze = TRUE`
(a real conversation) become dashboard calls; every row counts toward "calls logged".

## Files

| File | What it does |
|---|---|
| `build.py` | Downloads the sheet (or reads `--csv`), derives the dashboard fields, writes `data.js`. |
| `taxonomy.py` | Keyword rules that fold the AI's free-text notes into fixed buckets: product category, reason for the call, customer requests, and the main reason a sale didn't close. |
| `discovery.py` | Reads the rep's own lines in the transcript for needs-discovery questions on 12 topics (purpose, space, people, budget, timeframe, decision-makers and so on) and keeps the first question asked per topic as an example. |
| `pricing.py` | Reads each transcript (`internal:` = Revel staff, `external:` = customer) to find who raised price first: an unprompted rep offer, an offer after customer pressure, pressure with price held, or no discount talk. |

## How the categories work

- **Product category** comes from the sheet's `products_category_general`, with Revel model names
  (Aura, Nova, Eden, Glacier, ...) and keywords as a fallback. Hybrids (Nordic Wave) count as
  both traditional and infrared. A call can sit in several categories.
- **Reason for call** uses the AI's `trigger_event_primary`, then its motivation. Calls the AI
  marked as post-purchase are "After-sales, payments & order queries".
- **Customer requests** are matched against the customer's own words in the transcript, plus the
  AI's notes on missing information. A call can have several.
- **Competitors** come from the AI's `competitors_mentioned` note, with spelling variants folded into one brand
  name (`COMPETITOR_ALIASES`). Revel's own model names and suppliers are dropped.
- **Researching asks** reuse the customer requests, plus the AI's must-have / nice-to-have feature notes
  and its missing-information notes, grouped into themes.
- **Not closed** covers sales calls (not post-purchase) whose outcome was strong intent,
  moderate interest, low interest, wrong fit or lost to a competitor. The reason comes from
  `outcome_reason`, then `objections_unresolved`, then `barrier_primary`.

Rules run in order and the first match wins, so put specific rules above general ones. After
changing a rule, rebuild against a local export and check the "Other" buckets stay small:

```bash
curl -sSL -o /tmp/revel_calls.csv "<sheet CSV URL from build.py>"
python build.py --csv /tmp/revel_calls.csv
```

## Privacy and logs

- This site and its Actions logs are public. `build.py` copies whitelisted fields only: no
  phone numbers, emails, recordings or full transcripts. Short quotes (the AI's verbatim quote,
  and the one transcript line where price came up) are kept and scrubbed of anything that looks
  like an email or phone number. Do not add contact fields.
- `build.py` prints only row counts and HTTP status codes. Never add a print of call contents.
- The sheet URL can be overridden with the `REVEL_CALLS_CSV_URL` environment variable (for
  example a repo Actions secret).
