#!/usr/bin/env python3
"""
Warehouse Planner: nightly build of warehouse-planner.json for the GAF master
dashboard (Warehouse Planner tab).

Chain: NetSuite REST query service (SuiteQL, token-based auth with a read-only
integration role) -> this job -> warehouse-planner.json -> pages repo -> tab.

Two ways to run it:

  python build.py
      Live. Reads NetSuite directly. Needs these environment variables (repo
      Actions secrets in the nightly workflow):
        NS_ACCOUNT_ID, NS_CONSUMER_KEY, NS_CONSUMER_SECRET, NS_TOKEN_ID, NS_TOKEN_SECRET

  python build.py --inputs sample --today 2026-10-21 --snapshot
      Offline. Reads inbound_lines.csv, orders.csv and containers.csv from a folder.
      orders.csv may be one row per order, or one row per order line (it is
      summed by sales order number either way).

The public repo's Actions logs are public, so this script only ever prints
counts and HTTP status codes, never record contents.

Orders are published by sales order number and customer type only. Only
whitelisted fields are copied into the output, so a customer name can never
reach the public site. Do not add personal fields here.
"""
import argparse, base64, csv, hashlib, hmac, io, json, os, re, secrets, sys, time, urllib.error, urllib.parse, urllib.request
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
BRISBANE = timezone(timedelta(hours=10))  # Gold Coast: AEST, no daylight saving
LARGE_ORDER_CBM = 2.0
CONT_RE = re.compile(r"([A-Za-z0-9]+)\((\d+(?:\.\d+)?)\)")
ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
PAGE = 1000

# ---------------------------------------------------------------------------
# SuiteQL. Status codes: PO B = Pending Receipt, D = Partially Received,
# E = Pending Billing/Partially Received. SO B = Pending Fulfillment,
# D = Partially Fulfilled, E = Pending Billing/Partially Fulfilled.
# ---------------------------------------------------------------------------
GOLD_COAST = "(SELECT id FROM location WHERE name LIKE '%Gold Coast%' OR name LIKE '%GOLDCOAST%')"

Q_INBOUND = f"""
SELECT p.tranid AS po, BUILTIN.DF(p.entity) AS supplier, BUILTIN.DF(pl.item) AS sku,
  BUILTIN.DF(i.custitemitem_brand) AS brand,
  pl.quantity - NVL(pl.quantityshiprecv, 0) AS open_qty,
  ROUND((pl.quantity - NVL(pl.quantityshiprecv, 0)) * NVL(i.custitem_item_cubic_volume, 0), 3) AS cbm,
  NVL(i.custitem_num_of_cartons, 1) * (pl.quantity - NVL(pl.quantityshiprecv, 0)) AS cartons,
  TO_CHAR(pl.expectedreceiptdate, 'YYYY-MM-DD') AS eta,
  TO_CHAR(p.custbodyorder_eta, 'YYYY-MM-DD') AS header_eta,
  pl.custcol_avt_cng_container_data AS container_data
FROM transaction p
JOIN transactionline pl ON pl.transaction = p.id AND pl.mainline = 'F' AND pl.taxline = 'F'
JOIN item i ON i.id = pl.item
WHERE p.type = 'PurchOrd' AND p.status IN ('B', 'D', 'E') AND p.custbodyonthewater = 'T'
  AND pl.itemtype IN ('InvtPart', 'Assembly', 'Kit', 'NonInvtPart') AND pl.isclosed = 'F'
  AND pl.quantity - NVL(pl.quantityshiprecv, 0) > 0
  AND pl.location IN {GOLD_COAST}
ORDER BY p.id, pl.id
"""

# One row per open order line; summed per order in Python (a grouped query can time out).
Q_ORDER_LINES = f"""
SELECT t.tranid AS so, BUILTIN.DF(t.custbodytransactioncustomertype) AS customer_type,
  TO_CHAR(t.custbodycustbodyorder_edc, 'YYYY-MM-DD') AS ship,
  (ABS(tl.quantity) - NVL(tl.quantityshiprecv, 0)) * NVL(i.custitem_item_cubic_volume, 0) AS cbm,
  NVL(i.custitem_num_of_cartons, 1) * (ABS(tl.quantity) - NVL(tl.quantityshiprecv, 0)) AS cartons
FROM transaction t
JOIN transactionline tl ON tl.transaction = t.id AND tl.mainline = 'F' AND tl.taxline = 'F'
JOIN item i ON i.id = tl.item
WHERE t.type = 'SalesOrd' AND t.status IN ('B', 'D', 'E')
  AND tl.itemtype IN ('InvtPart', 'Assembly', 'Kit') AND tl.isclosed = 'F'
  AND ABS(tl.quantity) - NVL(tl.quantityshiprecv, 0) > 0
  AND tl.location IN {GOLD_COAST}
ORDER BY t.id, tl.id
"""

Q_CONTAINERS = f"""
SELECT c.name AS container, BUILTIN.DF(c.custrecord_avt_cng_cnt_size) AS size
FROM customrecord_avt_cng_container c
WHERE c.isinactive = 'F' AND c.created >= SYSDATE - 365
  AND c.custrecord_avt_cng_cnt_location IN {GOLD_COAST}
ORDER BY c.id
"""


# ---------------------------------------------------------------------------
# NetSuite REST query service with token-based authentication (OAuth 1.0a, HMAC-SHA256)
# ---------------------------------------------------------------------------
def _enc(s):
    return urllib.parse.quote(str(s), safe="~-._")


def oauth_header(method, url, account, consumer_key, consumer_secret, token_id, token_secret, nonce=None, timestamp=None):
    """Authorization header for one NetSuite request. Query-string parameters are part of the signature."""
    parts = urllib.parse.urlsplit(url)
    base_url = f"{parts.scheme}://{parts.netloc}{parts.path}"
    oauth = {
        "oauth_consumer_key": consumer_key,
        "oauth_token": token_id,
        "oauth_signature_method": "HMAC-SHA256",
        "oauth_timestamp": str(timestamp or int(time.time())),
        "oauth_nonce": nonce or secrets.token_hex(16),
        "oauth_version": "1.0",
    }
    params = list(oauth.items()) + urllib.parse.parse_qsl(parts.query, keep_blank_values=True)
    # Sorting on encoded pairs, then joining, per RFC 5849 section 3.4.1.3.2.
    norm = "&".join(f"{k}={v}" for k, v in sorted((_enc(k), _enc(v)) for k, v in params))
    base = "&".join([method.upper(), _enc(base_url), _enc(norm)])
    key = f"{_enc(consumer_secret)}&{_enc(token_secret)}"
    sig = base64.b64encode(hmac.new(key.encode(), base.encode(), hashlib.sha256).digest()).decode()
    fields = {**oauth, "oauth_signature": sig}
    return 'OAuth realm="%s", ' % account.upper() + ", ".join(f'{k}="{_enc(v)}"' for k, v in fields.items())


class NetSuite:
    def __init__(self, account, consumer_key, consumer_secret, token_id, token_secret):
        self.account = account.strip()
        self.creds = (consumer_key.strip(), consumer_secret.strip(), token_id.strip(), token_secret.strip())
        host = self.account.lower().replace("_", "-")
        self.endpoint = f"https://{host}.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql"

    def _post(self, query, offset):
        url = f"{self.endpoint}?limit={PAGE}&offset={offset}"
        body = json.dumps({"q": " ".join(query.split())}).encode()
        for attempt in range(4):
            req = urllib.request.Request(url, data=body, method="POST", headers={
                "Authorization": oauth_header("POST", url, self.account, *self.creds),
                "Content-Type": "application/json", "Prefer": "transient", "Accept": "application/json"})
            try:
                with urllib.request.urlopen(req, timeout=120) as r:
                    return json.load(r)
            except urllib.error.HTTPError as e:
                detail = ""
                try:
                    err = json.load(e)
                    detail = (err.get("o:errorDetails") or [{}])[0].get("detail", "") or err.get("title", "")
                except Exception:
                    pass
                if e.code in (429, 500, 502, 503, 504) and attempt < 3:
                    time.sleep(5 * (attempt + 1))
                    continue
                hint = {401: " Check the five NS_* secrets, and that the token, role and integration record are all enabled.",
                        403: " The integration role is missing a permission for this query."}.get(e.code, "")
                sys.exit(f"NetSuite returned HTTP {e.code}.{hint} {detail[:300]}")
            except urllib.error.URLError as e:
                if attempt < 3:
                    time.sleep(5 * (attempt + 1))
                    continue
                sys.exit(f"Could not reach NetSuite: {e.reason}")

    def query(self, name, query):
        rows, offset = [], 0
        while True:
            page = self._post(query, offset)
            items = page.get("items", [])
            rows.extend({k.lower(): ("" if v is None else str(v)) for k, v in it.items() if k != "links"} for it in items)
            if not page.get("hasMore") or not items:
                break
            offset += len(items)
        print(f"  {name}: {len(rows)} rows")
        return rows


# ---------------------------------------------------------------------------
# Transform
# ---------------------------------------------------------------------------
def read_csv(path):
    with open(path, encoding="utf-8-sig") as f:
        return [{(k or "").strip().lower(): (v or "").strip() for k, v in row.items()} for row in csv.DictReader(f)]


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
    return {"FORCE USA": "Force USA", "REP": "REP"}.get(b.upper(), b.title())


def customer_type(v):
    return re.sub(r"^\s*Cust:\s*", "", v or "").strip() or "Not set"


def days_between(a, b):
    return (date.fromisoformat(a) - date.fromisoformat(b)).days


def brands_out(d):
    return sorted(({"brand": k, "units": round(v[0]), "cbm": round(v[1], 2)} for k, v in d.items()), key=lambda x: -x["cbm"])


def summarise_orders(rows):
    """Sum order lines (or pass through per-order rows) by sales order number. Whitelisted fields only."""
    agg = {}
    for r in rows:
        so = r.get("so")
        if not so:
            continue
        a = agg.setdefault(so, {"so": so, "customer_type": customer_type(r.get("customer_type")), "ship": to_iso(r.get("ship")),
                                "cbm": 0.0, "cartons": 0.0, "lines": 0})
        a["cbm"] += num(r.get("cbm"))
        a["cartons"] += num(r.get("cartons"))
        a["lines"] += int(num(r["lines"])) if r.get("lines") else 1
    return [{**a, "cbm": round(a["cbm"], 2), "cartons": round(a["cartons"])} for a in agg.values() if a["cbm"] >= LARGE_ORDER_CBM]


def build(inbound, order_rows, containers, today):
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

    out_o = summarise_orders(order_rows)
    return {"containers": sorted(out_c, key=lambda x: (x["eta"], x["id"])),
            "unloaded": sorted(out_u, key=lambda x: (x["eta"], x["po"])),
            "orders": sorted(out_o, key=lambda x: (x["ship"] or "9999", -x["cbm"])),
            "brand_order": [b for b, _ in brand_cbm.most_common()]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--inputs", help="folder holding inbound_lines.csv, orders.csv and containers.csv (offline mode)")
    ap.add_argument("--today", help="override today's date (YYYY-MM-DD), for sample builds")
    ap.add_argument("--snapshot", action="store_true", help="mark the output as an example snapshot rather than a live extract")
    args = ap.parse_args()

    if args.inputs:
        inbound = read_csv(os.path.join(args.inputs, "inbound_lines.csv"))
        orders = read_csv(os.path.join(args.inputs, "orders.csv"))
        containers = read_csv(os.path.join(args.inputs, "containers.csv"))
    else:
        names = ["NS_ACCOUNT_ID", "NS_CONSUMER_KEY", "NS_CONSUMER_SECRET", "NS_TOKEN_ID", "NS_TOKEN_SECRET"]
        missing = [k for k in names if not os.environ.get(k, "").strip()]
        if missing:
            sys.exit(f"Missing NetSuite credentials: {', '.join(missing)}")
        ns = NetSuite(*(os.environ[k] for k in names))
        print("Reading NetSuite:")
        inbound = ns.query("on-the-water PO lines", Q_INBOUND)
        orders = ns.query("open sales order lines", Q_ORDER_LINES)
        containers = ns.query("container records", Q_CONTAINERS)

    now = datetime.now(BRISBANE)
    today = args.today or now.date().isoformat()
    generated = f"{today}T02:00:00+10:00" if args.today else now.replace(microsecond=0).isoformat()
    data = build(inbound, orders, containers, today)
    data = {"extract": {"generated": generated, "today": today, "snapshot": bool(args.snapshot), "site": "AFS-Gold Coast",
                        "large_order_cbm": LARGE_ORDER_CBM}, **data}

    if not data["containers"] and not data["unloaded"] and not data["orders"]:
        sys.exit("NetSuite returned nothing for all three queries. Leaving the published file untouched.")

    path = os.path.join(HERE, "warehouse-planner.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Wrote warehouse-planner.json: {len(data['containers'])} containers, {len(data['unloaded'])} booked POs, {len(data['orders'])} large orders")


if __name__ == "__main__":
    main()
