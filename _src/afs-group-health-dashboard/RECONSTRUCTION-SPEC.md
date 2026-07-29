# AFS Group Health Dashboard — reconstruction spec

The live dashboard at `/afs-group-health-dashboard/` is a **minified build with no
source**. This file is everything recoverable from that bundle, captured so the
source can be rebuilt without re-deriving it.

**It is NOT stale.** It fetches 7 published Google Sheet CSVs at runtime and has a
month picker and a refresh control, so it updates itself and needs no pipeline.

## Stack
React + Recharts + Lucide icons, built with Vite. Tailwind via CDN (configured
inline in `index.html`, not a build dependency). Font: Archivo.
CSV parsing: PapaParse.

## Brand palette (from index.html tailwind config)
navy `#0E2A44` · offwhite `#EDEAE3` · orange `#F26422` · grey `#424242` · darkgrey `#232323`

## Brands
| id | name | logo |
|---|---|---|
| GAF | Gym and Fitness | Shopify CDN GAF-Icon.png |
| FORCE | Force USA | Shopify CDN ForceUSA-Logo-Icon-Black.png |
| REVEL | Revel Recovery | Shopify CDN REVEL_Logo-Icon.png |

## Views
- Financial health and logistics efficiency
- Sales performance and operational metrics
- Retail presence and market penetration (EU country coverage)

## Metric vocabulary
CREDIT · CREDIT MEMO RATE · Credit Memos · DISCOUNT · MARGIN · PROFIT ·
RECOVERY · RECOVERY RATE · PERCENT · Inbound Calls · Goal Completion ·
Current Status · Above/Below Target · Above/Below Max · Goal Completion

## Live data endpoints (7)
```
https://docs.google.com/spreadsheets/d/e/2PACX-1vQjaWaELMLtVfRVqqxcBjt8a3O8eOfprExR9iFBHVti9Zi1I-FD0qVrW-8xqy1zfqRXztfVAdfyS0JW/pub?gid=1995533469&single=true&output=csv
https://docs.google.com/spreadsheets/d/e/2PACX-1vRPpWKad4OJFAb7-SYb9-yz8sj1q8UpbcSoYTVwLUWvaqPsEMUunpZTlfiDdiLkqlRm3g9Y0_Zqxkqt/pub?gid=176781390&single=true&output=csv
https://docs.google.com/spreadsheets/d/e/2PACX-1vRoi-4K1YP0v-rUgbOI8vg_Iyfh-gmXDArjAWGwg3FBvhh6BfV-UauXkBSwUfS4LId4MYLFWL2i4Sgz/pub?gid=949589139&single=true&output=csv
https://docs.google.com/spreadsheets/d/e/2PACX-1vSPMy3bijFQbGlpduZQRbvd56NXgmWkNDWmHprMbQOb6fDsh8SC9oy893UHnaweW7SuCnWkVvZHMnYA/pub?gid=1048417198&single=true&output=csv
https://docs.google.com/spreadsheets/d/e/2PACX-1vSPMy3bijFQbGlpduZQRbvd56NXgmWkNDWmHprMbQOb6fDsh8SC9oy893UHnaweW7SuCnWkVvZHMnYA/pub?gid=1188743751&single=true&output=csv
https://docs.google.com/spreadsheets/d/e/2PACX-1vSPMy3bijFQbGlpduZQRbvd56NXgmWkNDWmHprMbQOb6fDsh8SC9oy893UHnaweW7SuCnWkVvZHMnYA/pub?gid=417630756&single=true&output=csv
https://docs.google.com/spreadsheets/d/e/2PACX-1vSPMy3bijFQbGlpduZQRbvd56NXgmWkNDWmHprMbQOb6fDsh8SC9oy893UHnaweW7SuCnWkVvZHMnYA/pub?gid=8506835&single=true&output=csv
```

## Source sheets referenced in the UI (tooltip links)
```
https://docs.google.com/spreadsheets/d/17an6G2laOVcI8t0nDNsRkiax-ihYUIUqGtviyfaX9Gw/edit?gid=1965640519
https://docs.google.com/spreadsheets/d/17an6G2laOVcI8t0nDNsRkiax-ihYUIUqGtviyfaX9Gw/edit?gid=674713582
https://docs.google.com/spreadsheets/d/1VZ5m0q4h6bWS86CZBHaEVunEqAW6AtsZCDm4222GJ3g/edit?gid=1995533469
https://docs.google.com/spreadsheets/d/1YGymlROOHtIDLAldqsujKR4nIdHXJcn3Kr8cSwXe71c/edit?gid=949589139
https://docs.google.com/spreadsheets/d/1nE1DXvDAg3ozg4iSoSFL4YXAk9oVo2Etbtz9qJZ4U1g/edit?gid=176781390
```

## Rebuild approach
Functional equivalence, not byte equivalence: a minified bundle cannot be
decompiled to its original source. Keep `assets/index-M0UEf2Gn.js` as the
rollback until the rebuild is signed off visually.

Captured 2026-07-29 from bundle `index-M0UEf2Gn.js` (625,962 bytes).
