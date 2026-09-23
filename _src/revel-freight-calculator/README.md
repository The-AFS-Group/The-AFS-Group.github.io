# Revel Freight Calculator

Prices Winning Services 3PL freight for any Revel product to any Australian
postcode, from the product's carton CBM in master data.

Live: `https://the-afs-group.github.io/revel-freight-calculator/`

## Using it

1. Type the delivery postcode. The suburb, state and zone are looked up.
2. Every product in the list shows its freight for one unit. Filter by
   search, category, brand and lifecycle; sort by freight or CBM.
3. Click products (or **+**) to build a multi-item quote with quantities. The
   quote panel shows the full breakdown and **Copy quote** puts it on the
   clipboard.
4. Change **Dispatch from** when stock ships from another state, switch to
   **Warehouse collection**, or tick **Add install**.

## How a charge is built

| Step | Rule |
|---|---|
| Size class | Carton CBM × 333.333 kg/m³ = volumetric kg. Small ≤ 43.32, Medium ≤ 116.66, Large ≤ 666.66, else Oversized (0.13 / 0.35 / 2.0 m³). |
| Last mile | Largest item at its class minimum ($25 / $60 / $100 / $200), every other item at its class's additional rate ($6 / $15 / $25 / $50). |
| Zone | Last mile × zone surcharge (0 / 25 / 50 / 100 / 200 %). |
| Middle mile | Interstate only: total CBM × $/m³ from the origin → destination matrix. ACT is priced as NSW. |
| Fuel levy | % of last mile + zone + middle mile (4 %, August 2026). |
| Install | Optional, per unit: sauna $250, ice bath $125. No fuel levy. |
| GST | 10 % on the lot. |

Warehouse collection uses the collection rates only (no zone, middle mile,
fuel levy or install).

Settings on the **Rates & rules** tab:

- **What counts as an item**: each carton (default) or each product unit sized
  on its total CBM.
- **Size class by**: volumetric weight (the rate card's wording, default) or
  the greater of dead and volumetric weight.
- **Carton CBM from**: the master data CBM column (default) or W × D × H.

## Assumptions to confirm

- **Zones are estimated** until the Winnings coverage schedule is loaded. Each
  suburb's zone comes from its ABS Remoteness Area (Major Cities 1, Inner
  Regional 2, Outer Regional 3, Remote 4, Very Remote 5), with Greater Hobart
  and Greater Darwin set to 1. Any quote can override the zone.
- **Default dispatch state is NSW.** Change it in Rates & rules.
- **Each carton is an item.** The rate card's "initial item / additional
  items" rule could also mean one item per product; the setting switches it.

## Data files (`public/data/`)

| File | What | Update with |
|---|---|---|
| `products.json` | SKU, description, brand, category, lifecycle, RRP, cartons. No cost, wholesale or supplier data. | `npm run import:master-data -- <workbook.xlsx>` |
| `winnings-rate-card.json` | All rates, fuel levy, install, rules. | Edit by hand, or edit on the Rates tab and download. |
| `winnings-zones.json` | Official postcode → zone schedule. Empty = estimated zones. | `npm run import:zones -- <schedule.xlsx or .csv>` |
| `postcodes.json` | Postcode → suburbs, state, estimated zone. | `npm run build:postcodes` (downloads the source CSV) |

The site is public. Never commit the raw master data workbook.

Uploads and rate edits made on the site are saved in that browser only
(localStorage), so someone can quote a new product straight away. To publish
for everyone, update the JSON here and merge to `main`; the
`Build dashboards` workflow rebuilds the site.

## Development

```sh
npm install
npm test          # freight engine, parsers
npm run dev       # http://localhost:3000
npm run build     # type-check + build to dist/
```
