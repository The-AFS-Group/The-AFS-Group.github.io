# SKU Health Dashboard

Stock availability, sell-through and inbound cover for the Gym & Fitness and Revel
ranges, built from the weekly SKU Health stock exports.

Live at **/sku-health-dashboard/**.

## Layout

| Path | What it is |
|------|-----------|
| `_src/sku-health-dashboard/` | Vite + React + Recharts source (this folder) |
| `_pipelines/sku-health/raw/` | The two source CSV exports |
| `_pipelines/sku-health/build_data.py` | CSV → `data/skuHealth.json` |
| `sku-health-dashboard/` (repo root) | Built output served by GitHub Pages |

## Refreshing the data

1. Drop the new exports over `_pipelines/sku-health/raw/gaf_stock.csv` and
   `raw/revel_stock.csv` (same column layout as the originals).
2. `python3 _pipelines/sku-health/build_data.py`
3. `cd _src/sku-health-dashboard && npm install && npm run build`
4. `rm -rf sku-health-dashboard && cp -r _src/sku-health-dashboard/dist sku-health-dashboard`
5. Commit and push.

## How the numbers are derived

- **Weeks elapsed** comes from the calendar week in the export header (week 33 at the
  time of writing). YTD figures run from the start of the calendar year, which the
  `Units Sold YTD ÷ YTD Weekly ROS` ratio confirms.
- **$/week at risk** is a SKU's own year-to-date revenue divided by weeks elapsed,
  counted only for lines with nothing available to sell.
- **Weighted GP%** weights each line's GP by its revenue, so a $1m line moves the
  average and a $200 line does not.
- **Stock health states** are derived, not exported. First rule that matches wins:

  | State | Rule |
  |-------|------|
  | Inactive | No stock, nothing on order, nothing sold this year |
  | Stockout | Sold this year, nothing available today |
  | Dead Stock | Stock on hand, no sales this year — or over 52 weeks cover |
  | Critical | Under 4 weeks cover |
  | Healthy | 4 to 16 weeks cover |
  | Overstocked | 16 to 52 weeks cover |

## Note on the two exports

They are not the same shape. The GAF export carries Brand, Master Category, Sub
Category, an ABC/Non-stocked/Obsolete replenishment class and a Q1 GMROI column.
The Revel export has none of those — its `Classification` column holds the product
family (Saunas, Ice Baths, Massage Tools, Training Aids) rather than an ABC code, so
the pipeline maps it to `category` and leaves `abc` blank. The dashboard swaps the
ABC panel for a range roll-up on the Revel view accordingly.
