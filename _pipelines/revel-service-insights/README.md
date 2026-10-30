# Revel service insights pipeline

Feeds the **Revel service insights** dashboard at `revel-service-insights/`: the common after-sales
issues, resolution rate, how customers' mood moves on a call, what fixes each problem, Desk ticket
turnaround, and who resolves fastest. Filterable by period, person, issue, product, call direction
and ticket pipeline.

```
Aircall (Revel Saunas line) -> AI call analysis -> published Google Sheet (CSV, ~100 MB) --+
HubSpot Desk (Revel Customer Service, Warranty, Forms pipelines) -> CRM search API --------+
  -> build.py (nightly GitHub Action, 5:53am AEST)
  -> revel-service-insights/data.js (~3 MB) + playbook.json -> revel-service-insights/index.html
```

The call sheet is the same one the sales dashboard (`_pipelines/revel-call-insights/`) reads. Its AI
analysis screens out after-sales calls (`filter_reason` = `ai_classified_post_purchase` or
`post_purchase_service`), so those calls only carry a one-line AI summary and the transcript. This
pipeline reads the transcript itself. Analysed calls at the `post_purchase` stage are included too.

## Files

| File | What it does |
|---|---|
| `build.py` | Downloads the sheet (or reads `--csv`), reads each service call, adds the tickets, writes `data.js` and `playbook.json`. |
| `service.py` | The rules: issue taxonomy (shared by calls and tickets), Revel models and components, what the rep did, how the call ended, and the customer's mood. |
| `hubspot.py` | Pulls tickets from HubSpot with `HUBSPOT_TOKEN` and turns each into a row with no customer details. |
| `tickets.json` | The last ticket snapshot (derived fields only). Used when HubSpot can't be reached, so the call side still refreshes. |

It reuses `pricing.turns`, `taxonomy.product_categories` and the sheet download and scrub helpers
from `../revel-call-insights/`.

## How the reading works

- **Issue.** Each issue is a list of keyword patterns. A call scores one point per pattern in the
  customer's words, three per pattern in the AI's one-line summary, half per pattern in the rep's
  words; the top score wins, ties go to the more specific fault. Tickets use the subject and claim
  form (x3) and the first email. Delivery delays count 1.5x so "where is my order" isn't swallowed by
  general delivery talk. Ticket subjects that are system mail (payouts, auto-replies) are set aside.
- **Outcome** (from the last 40% of the call): *handed over* (passed to a colleague or team), *next step
  booked* (anyone committed to an action: send, book, order, email, call back), *fixed or answered*
  (the customer confirmed, or ended positive, with nothing owed), else *no clear resolution*.
- **Mood** (customer's words, first 35% vs last 30%). Unhappy customers on these calls are polite, so
  "upset" counts urgency, history and loss ("ASAP", "since April", "I can't even use it", "if I don't
  hear back") as well as frustration words; fault words count a third and everyday acknowledgements
  ("perfect", "thanks") a quarter. Checked against the AI's satisfaction rating on the ~380 service
  calls that have one: dissatisfied calls read upset at some point 50% of the time vs 16-20% for
  satisfied ones, and opened-upset callers who ended positive were 42% of very satisfied vs 10% of
  dissatisfied. Calls to the 3PL, couriers and installers are flagged (`sup`) and left out of mood.
- **Approaches** (rep's lines): troubleshooting, explaining, replacement part, technician, photos,
  warranty claim, delivery, refund, info sent, callback, handover. The dashboard ranks them by how
  often the customer *ended positive*, because booking-type approaches are "next step booked" by
  definition.
- **Voicemails** and calls where the customer said fewer than 20 words are skipped; the sheet's
  duplicate rows are dropped.

After changing a rule, rebuild against a local export and look at the "Other / unclear" share and a
few calls per outcome in the call log:

```bash
curl -sSL -o /tmp/revel_calls.csv "<sheet CSV URL from ../revel-call-insights/build.py>"
python build.py --csv /tmp/revel_calls.csv
```

## HubSpot setup

Tickets refresh nightly once the repo has an Actions secret `HUBSPOT_TOKEN`: a HubSpot private app
token with the `tickets` and `crm.objects.owners.read` scopes (Settings > Integrations > Private
apps). Without it the dashboard keeps the last `tickets.json` snapshot and shows its date in the
header. Customer Service tickets without an owner are skipped (they are almost all automated mail).

## The playbook (service brain seed)

`revel-service-insights/playbook.json` is rebuilt every night, all time. For each issue it holds the
volume on calls and tickets, products, models and parts involved, the outcome mix, how often upset
callers were turned around, each approach's results, example fixes in the reps' words, how
customers describe the problem, the best people on calls and the fastest ticket owners. It is the
starting point for a knowledge base of technical fixes and best resolution steps.

## Privacy and logs

- This site and its Actions logs are public. Output keeps derived fields only: no phone numbers,
  emails, recordings, full transcripts, ticket subjects or ticket emails. Short quotes (the AI's
  summary, one customer line, one rep line) are scrubbed of emails, phone numbers, street addresses
  and names after greetings or introductions. Do not add contact fields.
- `build.py` prints only counts and status codes. Never add a print of call or ticket contents.
- Ticket links in the ticket log open HubSpot, which needs a login.
