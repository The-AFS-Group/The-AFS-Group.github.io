#!/usr/bin/env python3
"""
Turn the two SKU Health exports into the JSON the SKU Health dashboard reads.

    python3 _pipelines/sku-health/build_data.py

Reads  : _pipelines/sku-health/raw/gaf_stock.csv
         _pipelines/sku-health/raw/revel_stock.csv
Writes : _src/sku-health-dashboard/data/skuHealth.json

To refresh the dashboard, drop new exports over the two raw CSVs (same column
layout), re-run this, then rebuild the app.
"""

import csv
import json
import re
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = Path(__file__).resolve().parent / "raw"
OUT = ROOT / "_src" / "sku-health-dashboard" / "data" / "skuHealth.json"


def num(value):
    """Parse the export's money/percent/count strings. Blank -> 0."""
    s = (value or "").strip()
    if not s:
        return 0.0
    neg = s.startswith("(") and s.endswith(")")
    s = s.strip("()").replace("$", "").replace(",", "").replace("%", "").strip()
    if s in ("", "-"):
        return 0.0
    try:
        n = float(s)
    except ValueError:
        return 0.0
    return -n if neg else n


def has_value(value):
    """True when the cell held something other than blank/dash."""
    s = (value or "").strip().strip("()").replace("$", "").replace(",", "").replace("%", "").strip()
    return s not in ("", "-")


def parse_eta(value):
    """'15-Sep-2026' / '4-Sep-2026' -> ISO date string, or None."""
    s = (value or "").strip()
    if not s:
        return None
    for fmt in ("%d-%b-%Y", "%d-%B-%Y"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def parse_refresh(value):
    s = (value or "").strip()
    for fmt in ("%m/%d/%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def classify(rec):
    """
    Bucket a SKU into one stock-health state. Order matters: the first rule that
    matches wins, so a selling line with nothing available is always a stockout
    regardless of what is on the water.
    """
    if rec["onHand"] <= 0 and rec["onOrder"] <= 0 and rec["unitsYTD"] <= 0:
        return "Inactive"
    if rec["available"] <= 0 and rec["ros"] > 0:
        return "Stockout"
    if rec["onHand"] > 0 and rec["ros"] <= 0:
        return "Dead Stock"
    if rec["available"] <= 0:
        return "Inactive"
    if rec["cover"] < 4:
        return "Critical"
    if rec["cover"] <= 16:
        return "Healthy"
    if rec["cover"] <= 52:
        return "Overstocked"
    return "Dead Stock"


def clean_subcat(text):
    """
    Sub categories arrive as 'Parent - Child'. When the two halves match, the
    prefix is just noise on a chart axis, so collapse it.
    """
    s = re.sub(r"\s+", " ", (text or "").strip())
    if " - " in s:
        parent, _, child = s.partition(" - ")
        if parent.strip().lower() == child.strip().lower():
            return parent.strip()
    return s


def clean_desc(text):
    """A handful of descriptions carry a whole parts manifest. Trim them."""
    s = re.sub(r"\s+", " ", (text or "").strip())
    return s[:120] + "..." if len(s) > 123 else s


def build_gaf():
    rows = list(csv.reader(open(RAW / "gaf_stock.csv", newline="", encoding="utf-8-sig")))
    meta_row, header = rows[0], rows[1]
    idx = {name.strip(): i for i, name in enumerate(header)}

    def cell(r, name):
        i = idx.get(name)
        return r[i] if i is not None and i < len(r) else ""

    out = []
    for r in rows[2:]:
        if len(r) < 10 or not r[1].strip():
            continue
        rec = {
            "brandGroup": "GAF",
            "sku": r[1].strip(),
            "desc": clean_desc(r[2]),
            "brand": (r[0].strip() or "UNBRANDED").title(),
            "category": (cell(r, "Master Category").strip() or "Uncategorised").title(),
            "subCategory": clean_subcat(cell(r, "Sub Category")) or "—",
            "abc": cell(r, "Classification").strip() or "—",
            "cover": num(cell(r, "Current Weeks Cover")),
            "onHand": num(cell(r, "On Hand")),
            "onOrder": num(cell(r, "On Order")),
            "committed": num(cell(r, "Committed")),
            "available": num(cell(r, "Available")),
            "backOrdered": num(cell(r, "Back Ordered")),
            "unitsMTD": num(cell(r, "Units Sold MTD")),
            "revMTD": num(cell(r, "Rev $ MTD")),
            "unitsYTD": num(cell(r, "Units Sold YTD")),
            "revYTD": num(cell(r, "Rev $ YTD")),
            "gp": num(cell(r, "GP % YTD")) if has_value(cell(r, "GP % YTD")) else None,
            "ros": num(cell(r, "YTD WEEKLY ROS")),
            "eta": parse_eta(cell(r, "Order ETA")),
            "orderQty": num(cell(r, "Order Quantity")),
            "allocated": num(cell(r, "Allocated Demand")),
            "po": cell(r, "Next PO").strip() or None,
            "gmroi": num(cell(r, "Q1")) if has_value(cell(r, "Q1")) else None,
        }
        rec["status"] = classify(rec)
        out.append(rec)

    week = 0
    for i, v in enumerate(meta_row):
        if "Calendar Week" in (v or ""):
            week = int(num(meta_row[i + 1]))
    return out, parse_refresh(meta_row[0]), week


def build_revel():
    rows = list(csv.reader(open(RAW / "revel_stock.csv", newline="", encoding="utf-8-sig")))
    meta_row, header = rows[0], rows[2]
    idx = {name.strip(): i for i, name in enumerate(header)}

    def cell(r, name):
        i = idx.get(name)
        return r[i] if i is not None and i < len(r) else ""

    out = []
    for r in rows[3:]:
        if len(r) < 10 or not r[0].strip():
            continue
        # Revel's "Classification" column holds the product family, not an ABC
        # code — the two exports reuse the same header for different things.
        rec = {
            "brandGroup": "Revel",
            "sku": r[0].strip(),
            "desc": clean_desc(r[1]),
            "brand": "Harvia" if r[1].strip().startswith("Harvia") else "Revel",
            "category": cell(r, "Classification").strip() or "Uncategorised",
            "subCategory": "—",
            "abc": "—",
            "cover": num(cell(r, "Current Weeks Cover")),
            "onHand": num(cell(r, "On Hand")),
            "onOrder": num(cell(r, "On Order")),
            "committed": num(cell(r, "Committed")),
            "available": num(cell(r, "Available")),
            "backOrdered": num(cell(r, "Back Ordered")),
            "unitsMTD": num(cell(r, "Units Sold MTD")),
            "revMTD": num(cell(r, "Rev $ MTD")),
            "unitsYTD": num(cell(r, "Units Sold YTD")),
            "revYTD": num(cell(r, "Rev $ YTD")),
            "gp": num(cell(r, "GP % YTD")) if has_value(cell(r, "GP % YTD")) else None,
            "ros": num(cell(r, "YTD WEEKLY ROS")),
            "eta": parse_eta(cell(r, "Order ETA")),
            "orderQty": num(cell(r, "Next Order Quantity")),
            "allocated": num(cell(r, "Allocated Demand")),
            "po": cell(r, "Next PO").strip() or None,
            "gmroi": None,
        }
        rec["status"] = classify(rec)
        out.append(rec)

    week = 0
    for i, v in enumerate(meta_row):
        if "Calendar Week" in (v or ""):
            week = int(num(meta_row[i + 1]))
    return out, parse_refresh(meta_row[0]), week


def main():
    gaf, gaf_date, gaf_week = build_gaf()
    revel, revel_date, revel_week = build_revel()

    payload = {
        "refreshedAt": gaf_date or revel_date,
        "calendarWeek": gaf_week or revel_week,
        # YTD figures run from the start of the calendar year, so weeks elapsed
        # is the calendar week itself. Used for weekly run-rate maths.
        "weeksElapsed": gaf_week or revel_week,
        "skus": gaf + revel,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, separators=(",", ":")))

    print(f"wrote {OUT.relative_to(ROOT)}")
    print(f"  refreshed {payload['refreshedAt']}  week {payload['calendarWeek']}")
    print(f"  GAF   {len(gaf):>5} SKUs   ${sum(s['revYTD'] for s in gaf):,.0f} YTD")
    print(f"  Revel {len(revel):>5} SKUs   ${sum(s['revYTD'] for s in revel):,.0f} YTD")
    from collections import Counter
    print("  status:", dict(Counter(s["status"] for s in gaf + revel)))


if __name__ == "__main__":
    main()
