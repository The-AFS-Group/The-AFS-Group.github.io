#!/usr/bin/env python3
"""
Warehouse Planner: nightly build of warehouse-planner.json for the GAF master
dashboard (Warehouse Planner tab).

Chain (same pattern as the HGB and dead stock trackers, no NetSuite credential
in GitHub): three NetSuite saved searches -> published Google Sheet CSVs ->
this job -> warehouse-planner.json -> pages repo -> dashboard tab.

Inputs, one CSV each. Columns are matched by header name; extra columns are
ignored, so a customer name column in a feed can never reach the output.

  inbound_lines.csv   Open PO lines, Gold Coast, PO ticked "Shipment on the water",
                      unreceived qty > 0.
                      po, supplier, sku, brand, open_qty, cbm, cartons,
                      eta (line Expected Receipt Date), header_eta (PO Order ETA),
                      container_data (AVT CM Container Data, e.g. "TGBU7942047(56)|...")
  orders.csv          Open Gold Coast sales orders with 2 m3 or more still to ship.
                      so, customer_type, ship (header Expected Ship Date), lines, cbm, cartons
  containers.csv      AVT CM Container records: container, size

Usage:
  python build.py --inputs sample --today 2026-10-21      # build from local CSVs
  WP_INBOUND_URL=... WP_ORDERS_URL=... WP_CONTAINERS_URL=... python build.py

Writes warehouse-planner.json next to this file.
"""
import argparse, csv, io, json, os, re, sys, urllib.request
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
BRISBANE = timezone(timedelta(hours=10))  # Gold Coast: AEST, no daylight saving
LARGE_ORDER_CBM = 2.0
CONT_RE = re.compile(r"([A-Za-z0-9]+)\((\d+(?:\.\d+)?)\)")
ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def read_csv(path_or_url):
    if re.match(r"^https?://", path_or_url):
        with urllib.request.urlopen(path_or_url, timeout=60) as r:
            text = r.read().decode("utf-8-sig")
    else:
        with open(path_or_url, encoding="utf-8-sig") as f:
            text = f.read()
    return [{(k or "").strip().lower(): (v or "").strip() for k, v in row.items()} for row in csv.DictReader(io.StringIO(text))]


def num(v):
    try:
        return float(str(v).replace(",", "")) if str(v).strip() else 0.0
    except ValueError:
        return 0.0


def to_iso(v):
    """Accepts YYYY-MM-DD or NetSuite's D/M/YYYY; returns YYYY-MM-DD or None."""
    v = (v or "").strip()
    if not v:
        return None
    if ISO_DATE.match(v):
        return v
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", v)
    if m:
        return f"{int(m.group(3)):04d}-{int(m.group(2)):02d}-{int(m.group(1)):02d}"
    raise ValueError(f"Unrecognised date: {v!r}")


def size_label(raw, cid):
    if cid.upper().endswith("LCL"):
        return "LCL"
    if "40" in (raw or ""):
        return "40ft"
    if "20" in (raw or ""):
        return "20ft"
    return None


def brand_label(b):
    b = (b or "").strip()
    if not b:
        return "Unbranded"
    special = {"FORCE USA": "Force USA", "REP": "REP"}
    return special.get(b.upper(), b.title())


def customer_type(v):
    v = re.sub(r"^\s*Cust:\s*", "", v or "").strip()
    return v or "Not set"


def days_between(a, b):
    return (date.fromisoformat(a) - date.fromisoformat(b)).days


def brands_out(d):
    return sorted(({"brand": k, "units": round(v[0]), "cbm": round(v[1], 2)} for k, v in d.items()), key=lambda x: -x["cbm"])


def build(inbound, orders, containers, today):
    sizes = {r["container"]: r.get("size", "") for r in containers if r.get("container")}
    cont = defaultdict(lambda: {"units": 0.0, "cbm": 0.0, "cartons": 0.0, "lines": 0, "brands": defaultdict(lambda: [0.0, 0.0]),
                                "pos": set(), "suppliers": set(), "etas": Counter(), "hdr": set()})
    unl = defaultdict(lambda: {"units": 0.0, "cbm": 0.0, "lines": 0, "brands": defaultdict(lambda: [0.0, 0.0]),
                               "etas": Counter(), "supplier": "", "hdr": None})
    brand_cbm = Counter()

    for l in inbound:
        eta = to_iso(l.get("eta"))
        if not eta:
            continue
        b = brand_label(l.get("brand"))
        q, cbm, ctn = num(l.get("open_qty")), num(l.get("cbm")), num(l.get("cartons"))
        hdr = to_iso(l.get("header_eta"))
        brand_cbm[b] += cbm
        parts = CONT_RE.findall(l.get("container_data", ""))
        if not parts:
            u = unl[l["po"]]
            u["units"] += q; u["cbm"] += cbm; u["lines"] += 1; u["supplier"] = l.get("supplier", ""); u["hdr"] = hdr
            u["brands"][b][0] += q; u["brands"][b][1] += cbm; u["etas"][eta] += max(cbm, 0.001)
            continue
        total = sum(float(p[1]) for p in parts) or 1.0
        for cid, cq in parts:
            share = float(cq) / total
            c = cont[cid]
            c["units"] += float(cq); c["cbm"] += cbm * share; c["cartons"] += ctn * share; c["lines"] += 1
            c["brands"][b][0] += float(cq); c["brands"][b][1] += cbm * share
            c["pos"].add(l["po"]); c["suppliers"].add(l.get("supplier", "")); c["etas"][eta] += max(cbm * share, 0.001)
            if hdr and abs(days_between(hdr, eta)) > 3:
                c["hdr"].add(f'{l["po"]} header {hdr}')

    out_c = []
    for cid, c in cont.items():
        eta = c["etas"].most_common(1)[0][0]
        flags = (["overdue"] if eta < today else []) + (["mixed_eta"] if len(c["etas"]) > 1 else []) + (["header_differs"] if c["hdr"] else [])
        out_c.append({"id": cid, "size": size_label(sizes.get(cid), cid), "eta": eta, "etas": sorted(c["etas"]),
                      "units": round(c["units"]), "cbm": round(c["cbm"], 2), "cartons": round(c["cartons"]), "lines": c["lines"],
                      "pos": sorted(c["pos"]), "suppliers": sorted(s for s in c["suppliers"] if s), "brands": brands_out(c["brands"]),
                      "flags": flags, "header_notes": sorted(c["hdr"])})

    out_u = []
    for po, u in unl.items():
        eta = u["etas"].most_common(1)[0][0]
        flags = ["overdue"] if eta < today else (["some_lines_overdue"] if min(u["etas"]) < today else [])
        out_u.append({"po": po, "supplier": u["supplier"], "eta": eta, "header_eta": u["hdr"], "units": round(u["units"]),
                      "cbm": round(u["cbm"], 2), "lines": u["lines"], "brands": brands_out(u["brands"]), "flags": flags})

    # Whitelisted fields only: sales order number and customer type, never a name.
    out_o = []
    for o in orders:
        cbm = num(o.get("cbm"))
        if cbm < LARGE_ORDER_CBM or not o.get("so"):
            continue
        out_o.append({"so": o["so"], "customer_type": customer_type(o.get("customer_type")), "ship": to_iso(o.get("ship")),
                      "cbm": round(cbm, 2), "cartons": round(num(o.get("cartons"))), "lines": int(num(o.get("lines")))})

    return {"containers": sorted(out_c, key=lambda x: (x["eta"], x["id"])),
            "unloaded": sorted(out_u, key=lambda x: (x["eta"], x["po"])),
            "orders": sorted(out_o, key=lambda x: (x["ship"] or "9999", -x["cbm"])),
            "brand_order": [b for b, _ in brand_cbm.most_common()]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--inputs", help="folder holding inbound_lines.csv, orders.csv and containers.csv")
    ap.add_argument("--today", help="override today's date (YYYY-MM-DD), for sample builds")
    ap.add_argument("--snapshot", action="store_true", help="mark the output as an example snapshot rather than a live extract")
    args = ap.parse_args()

    if args.inputs:
        src = {k: os.path.join(args.inputs, f"{k}.csv") for k in ("inbound_lines", "orders", "containers")}
    else:
        src = {"inbound_lines": os.environ.get("WP_INBOUND_URL", ""), "orders": os.environ.get("WP_ORDERS_URL", ""),
               "containers": os.environ.get("WP_CONTAINERS_URL", "")}
        missing = [k for k, v in src.items() if not v.strip()]
        if missing:
            sys.exit(f"Missing feed URL(s) for: {', '.join(missing)}")

    now = datetime.now(BRISBANE)
    today = args.today or now.date().isoformat()
    generated = f"{today}T02:00:00+10:00" if args.today else now.replace(microsecond=0).isoformat()
    data = build(read_csv(src["inbound_lines"]), read_csv(src["orders"]), read_csv(src["containers"]), today)
    data = {"extract": {"generated": generated, "today": today, "snapshot": bool(args.snapshot), "site": "AFS-Gold Coast",
                        "large_order_cbm": LARGE_ORDER_CBM}, **data}

    if len(data["containers"]) + len(data["unloaded"]) == 0 and len(data["orders"]) == 0:
        sys.exit("All three feeds came back empty. Leaving the published file untouched.")

    path = os.path.join(HERE, "warehouse-planner.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Wrote {path}: {len(data['containers'])} containers, {len(data['unloaded'])} booked POs, {len(data['orders'])} large orders")


if __name__ == "__main__":
    main()
