# Black November chat posts

`bn_card.py` builds the Black November Google Chat card for GAF or Revel and can post it.
The same script is embedded in each Claude Code routine prompt, so keep them in step.

    python3 -I bn_card.py INPUT.json --brand GAF|REVEL [--test] [--as-day N] [--wrap] [--out card.json] [--post]

- `--post` sends to the webhook in `BLACK_NOVEMBER_CHAT_WEBHOOK` (GAF) or
  `BLACK_NOVEMBER_REVEL_CHAT_WEBHOOK` (Revel). No URLs live in this repo.
- `--wrap` builds the monthly wrap card instead of the daily card.
- `--test` adds a TEST prefix to the title; `--as-day N` sets the day number outside November.

## Input

`{"date": "YYYY-MM-DD", "created_rows": [...], "dispatched_rows": [...], "top5": [...], "history_rows": [...]}`

- GAF: saved searches 6211 (created) and 6229 (dispatched). Month history comes from the published GAF sheet.
- Revel: saved searches 6228 (created) and 6230 (fulfilled). `history_rows` holds the month's
  rows from searches 6212 + 6236 (fields `Date`, `Est. Gross Profit (Line)`).
- `top5`: SuiteQL rows `{sku, description, qty, net}` (GAF depts 20, 21, 35; Revel depts 38, 39).

## Schedule (Australia/Adelaide)

- Daily cards: 5:37am GAF, 5:41am Revel, 3-30 Nov. Sale Day 1 is Mon 2 Nov, so cards read "DAY n OF 29".
- Final day card: same times on 1 Dec, covering Mon 30 Nov.
- Monthly wrap: about 9:57am (GAF) and 9:58am (Revel) on 1 Dec.

Daily targets are baked into the script (`GAF_TARGETS` total $887,420, `REVEL_TARGETS` total $905,255).
