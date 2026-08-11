# gaf-hgb-tracker worker

Backing store for the Home Gym Builder BHAG tracker. A NetSuite Scheduled Script
POSTs the daily numbers here; the dashboard GETs the latest value live instead of
reading a committed JSON file someone has to hand-edit.

## One-time setup (Cloudflare account holder)

```sh
cd _src/gaf-master-dashboard/worker
npx wrangler login

# Create the KV namespace and paste its id into wrangler.toml
npx wrangler kv namespace create HGB_KV

# Generate a strong random secret and set it — this is the value NetSuite's
# scheduled script will send as "Authorization: Bearer <secret>". Keep the
# plaintext somewhere safe (e.g. a password manager); it isn't stored in git.
npx wrangler secret put HGB_WRITE_SECRET

npx wrangler deploy
```

Note the deployed URL (`https://gaf-hgb-tracker.<your-subdomain>.workers.dev`, or
your custom route if you set one) — it goes into:
- the NetSuite scheduled script's `ENDPOINT_URL` constant
- `HGBTracker`'s fetch URL in `components/OPSPDashboard.tsx`

## Testing

```sh
# Read (should 404 until the first POST lands)
curl https://<worker-url>/

# Write (replace <secret> and the numbers with real ones)
curl -X POST https://<worker-url>/ \
  -H "Authorization: Bearer <secret>" \
  -H "Content-Type: application/json" \
  -d '{"count":1336,"target":10000,"asOf":"5 Aug 2026","window":"cumulative since 1 Jul 2025 (FY26 start)","periodStart":"2025-07-01","periodEnd":"2030-12-31","fy27ToDate":80,"fy26Baseline":1257,"fy26SamePoint":69}'
```
