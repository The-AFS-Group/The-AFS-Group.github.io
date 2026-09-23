---
name: revel-freight-calculator
description: Update or change the Revel Freight Calculator (Winning Services freight by product CBM and postcode). Use when the user uploads a new Master Data Succinct workbook, a new Winnings rate card, a fuel levy announcement, a Winnings coverage / zone schedule, or another carrier's rate card (e.g. DFE), or asks to change anything about the freight calculator. Source is _src/revel-freight-calculator/, published output is revel-freight-calculator/ at the repo root.
---

# Revel Freight Calculator: update → verify → publish

Source: `_src/revel-freight-calculator/`. Data lives in `public/data/`.
The published site is the built output in `revel-freight-calculator/` at the
repo root (GitHub Pages). The `Build dashboards` workflow rebuilds it when
`_src/**` changes on `main`, but build and sync it in the same commit anyway
so the branch is self-consistent.

The repo is **public**. Never commit the raw master data workbook, rate card
PDFs or anything with cost, wholesale or supplier data. Only the JSON the
import scripts write.

```sh
cd _src/revel-freight-calculator
[ -d node_modules ] || npm ci
```

## What the user sends → what to run

**New master data workbook**
```sh
npm run import:master-data -- "/path/to/MasterDataSuccinct.xlsx"
```
Report the new / removed SKU lists the script prints, and any new products
with no carton data (they can't be priced). Check `products.json` does not
contain cost or supplier strings from the workbook.

**Fuel levy announcement** (monthly): edit `public/data/winnings-rate-card.json`
→ `fuelLevy`: `pct` (the announced figure), `period`, `status`
("Indicative…" or "Confirmed"), `basePrice`, `averagePrice`, `fuelSharePct`.
Formula: ((average − base) ÷ base) × fuel share. Use the percentage Winnings
announces, not your own rounding. Bump `updated`.

**New rate card PDF**: read every table and update the matching fields in
`winnings-rate-card.json` (size classes and footnote thresholds, zones,
middle-mile matrix row = origin / column = destination, collection, install,
otherCharges). If the size thresholds change, re-derive `cubicFactor`
(thresholds ÷ CBM boundaries). Tell the user what changed.

**Winnings coverage / zone schedule**
```sh
npm run import:zones -- "/path/to/schedule.xlsx"
```
Needs Postcode + Zone columns (optional Suburb; ranges like 2000-2234 work).
Once loaded, those postcodes stop using the ABS-remoteness estimate.

**DFE** (`dfe-rate-card.json`, engine `src/lib/dfe.ts`): used outside
Winnings coverage. New monthly fuel levy → add a `fuelLevy` row
(`effective` ISO date, `pct`); keep older rows. When DFE's base rate card
arrives, give it a `base` structure matching what DFE supplies (usually
postcode → zone plus basic charge, per-kg and minimum per zone), price it in
`quoteDfe` (fuel levy applies to base freight), set `complete` from it, and
confirm the cubic conversion (currently an assumed 250 kg/m³). Load the
destination surcharge suburb list if supplied.

**Website catalogue refresh** (new products or prices on revelsaunas.com.au):
`npm run import:website`. Used only to check products, never for pricing: all charges come from the uploaded rate cards. The Data tab then lists website SKUs missing from
master data, 0 kg website weights and weight mismatches.

**Postcode list refresh** (rare): `npm run build:postcodes`.

## Verify, then publish

```sh
npm test
npm run build
rm -rf ../../revel-freight-calculator && mkdir -p ../../revel-freight-calculator && cp -R dist/. ../../revel-freight-calculator/
```

Spot-check a known quote before committing. With the published data, a
Revel Tampere 2P (R-TR-2P-V3) to postcode 2250 from NSW is $223.08 inc GST
($156 last mile + 25% zone 2 + 4% fuel + GST). If the rate card or master
data changed, work out the expected number by hand first.

Commit source + data + rebuilt `revel-freight-calculator/` together, push,
and open a PR against `main`. Merge it when the user has asked to publish /
make it live; otherwise give them the PR link and ask.
