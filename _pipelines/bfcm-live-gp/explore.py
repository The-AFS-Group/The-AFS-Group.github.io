#!/usr/bin/env python3
"""
One-off calibration for the BFCM live-GP job: which NetSuite sales-order filter and GP formula
reproduce the "GROSS PROFIT CREATED" column of the REVEL DATA and GAF DATA sheet tabs?

Reads sales-order lines for recent completed days, builds candidate daily GP series for every
value of each segment field, picks the best-matching set of values per brand, and prints only
segment NAMES, line COUNTS and match ERRORS (percent). It never prints a dollar figure: this
repo's Actions logs are public.
"""
import csv, importlib.util, io, json, os, sys, time, urllib.error, urllib.request
from collections import defaultdict
from datetime import date, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("wp", os.path.join(HERE, "..", "warehouse-planner", "build.py"))
wp = importlib.util.module_from_spec(spec); spec.loader.exec_module(wp)

SHEETS = {
    "REVEL": "https://docs.google.com/spreadsheets/d/e/2PACX-1vT72MxE6-ziV7qfKCkHXatwJC47qjSAm0Fv0553yd09v3b0fLo-9QI3VZ-ehF_qjpaDNdd9jrYwDbU6/pub?gid=1965640519&single=true&output=csv",
    "GAF": "https://docs.google.com/spreadsheets/d/e/2PACX-1vT72MxE6-ziV7qfKCkHXatwJC47qjSAm0Fv0553yd09v3b0fLo-9QI3VZ-ehF_qjpaDNdd9jrYwDbU6/pub?gid=0&single=true&output=csv",
}
START, END = date(2026, 10, 20), date(2026, 11, 4)  # completed days, so the sheet is final


def money(v):
    v = (v or "").replace("$", "").replace(",", "").replace("%", "").strip()
    try:
        return float(v)
    except ValueError:
        return None


def sheet_targets(url):
    for attempt in range(4):
        try:
            with urllib.request.urlopen(f"{url}&_ts={time.time()}", timeout=150) as r:
                text = r.read().decode("utf-8")
            break
        except Exception:
            time.sleep(5)
    else:
        sys.exit("Could not read the sheet")
    out = {}
    for row in csv.reader(io.StringIO(text)):
        if len(row) < 3 or "/" not in row[0]:
            continue
        d, m, y = (int(x) for x in row[0].split("/"))
        dt = date(y, m, d)
        gp, margin = money(row[1]), money(row[2])
        if START <= dt <= END and gp:
            out[dt.isoformat()] = (gp, margin)
    return out


class NS(wp.NetSuite):
    """Same client, but a failing query returns None instead of exiting (for probing fields)."""
    def try_query(self, name, q):
        url = f"{self.endpoint}?limit=1&offset=0"
        body = json.dumps({"q": " ".join(q.split())}).encode()
        req = urllib.request.Request(url, data=body, method="POST", headers={
            "Authorization": wp.oauth_header("POST", url, self.account, *self.creds),
            "Content-Type": "application/json", "Prefer": "transient", "Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=120):
                print(f"  probe {name}: ok")
                return True
        except urllib.error.HTTPError as e:
            print(f"  probe {name}: HTTP {e.code}")
            return False


def main():
    names = ["NS_ACCOUNT_ID", "NS_CONSUMER_KEY", "NS_CONSUMER_SECRET", "NS_TOKEN_ID", "NS_TOKEN_SECRET"]
    ns = NS(*(os.environ[k] for k in names))
    base_where = f"t.type = 'SalesOrd' AND t.trandate >= TO_DATE('{START}', 'YYYY-MM-DD') AND t.trandate <= TO_DATE('{END}', 'YYYY-MM-DD')"
    optional = {
        "dept": "BUILTIN.DF(t.department)", "cls": "BUILTIN.DF(t.class)", "loc": "BUILTIN.DF(t.location)",
        "ldept": "BUILTIN.DF(tl.department)", "lcls": "BUILTIN.DF(tl.class)", "lloc": "BUILTIN.DF(tl.location)",
        "lsub": "BUILTIN.DF(tl.subsidiary)", "ctype": "BUILTIN.DF(t.custbodytransactioncustomertype)",
        "cd": "TO_CHAR(t.createddate, 'YYYY-MM-DD')", "hgp": "t.estgrossprofit", "lgp": "tl.estgrossprofit",
    }
    print("Probing fields:")
    ok = {}
    for k, expr in optional.items():
        q = f"SELECT {expr} AS x FROM transaction t JOIN transactionline tl ON tl.transaction = t.id AND tl.mainline = 'F' WHERE {base_where}"
        if ns.try_query(k, q):
            ok[k] = expr
    cols = ", ".join(f"{e} AS {k}" for k, e in ok.items())
    q = f"""SELECT t.id AS tid, TO_CHAR(t.trandate, 'YYYY-MM-DD') AS d, t.status AS st, tl.itemtype AS it,
              tl.netamount AS amt, tl.costestimate AS cost{', ' + cols if cols else ''}
            FROM transaction t JOIN transactionline tl ON tl.transaction = t.id AND tl.mainline = 'F' AND tl.taxline = 'F'
            WHERE {base_where} ORDER BY t.id, tl.id"""
    print("Reading lines:")
    rows = ns.query("sales order lines", q)
    # SuiteQL leaves a field out of a row when it is empty; give every row every key
    keys = {"tid", "d", "st", "it", "amt", "cost", *ok.keys()}
    rows = [{k: r.get(k, "") for k in keys} for r in rows]

    f = lambda v: float(v) if v not in ("", None) else 0.0
    inv = [r for r in rows if r["it"] == "InvtPart"]
    sign = -1.0 if sum(f(r["amt"]) for r in inv) < 0 else 1.0
    print(f"  amount sign on item lines: {'negative' if sign < 0 else 'positive'}")

    segs = [k for k in ["dept", "cls", "loc", "ldept", "lcls", "lloc", "lsub", "ctype"] if k in ok]
    print("\nSegment values (lines per value):")
    for s in segs:
        counts = defaultdict(int)
        for r in rows:
            counts[r.get(s) or "(blank)"] += 1
        print(f"  {s}: " + "; ".join(f"{v} [{n}]" for v, n in sorted(counts.items(), key=lambda x: -x[1])[:25]))
    statuses = defaultdict(int)
    for r in rows:
        statuses[r["st"]] += 1
    print("  status: " + ", ".join(f"{k} [{v}]" for k, v in sorted(statuses.items())))
    types = defaultdict(int)
    for r in rows:
        types[r["it"]] += 1
    print("  item types: " + ", ".join(f"{k} [{v}]" for k, v in sorted(types.items(), key=lambda x: -x[1])))

    SHIP_DISC = {"ShipItem", "Discount"}
    TEXT = {"Description", "Subtotal"}
    def line_gp(types_out):
        return lambda r: f(r.get("lgp")) if r["it"] not in types_out else 0.0
    formulas = {
        "line estGP, all lines": line_gp(TEXT),
        "line estGP, no shipping": line_gp(TEXT | {"ShipItem"}),
        "line estGP, no shipping/discount": line_gp(TEXT | SHIP_DISC),
    }
    revenue_f = {
        "line estGP, all lines": lambda r: sign * f(r["amt"]) if r["it"] not in TEXT else 0.0,
        "line estGP, no shipping": lambda r: sign * f(r["amt"]) if r["it"] not in TEXT | {"ShipItem"} else 0.0,
        "line estGP, no shipping/discount": lambda r: sign * f(r["amt"]) if r["it"] not in TEXT | SHIP_DISC else 0.0,
    }
    # Header (whole-order) estimated GP, counted once per order, attributed to the order's first department
    first_dept, header_gp = {}, {}
    for r in rows:
        if r["tid"] not in first_dept and r.get("ldept"):
            first_dept[r["tid"]] = r["ldept"]
        header_gp[r["tid"]] = f(r.get("hgp"))
    status_sets = {"all": set(), "excl cancelled+closed": {"C", "H"}, "excl cancelled": {"C"}, "billed only": {"A", "B", "C", "D", "E", "F", "H"}}
    date_keys = ["d", "cd"]
    sets = {
        "REVEL": [["REVEL"], ["REVEL", "Revel Online - AU"], ["Revel Online - AU"]],
        "GAF": [["GAF AU"], ["GAF AU", "GAF Online - AU"], ["GAF AU", "GAF Online - AU", "GAF Commercial Sales - AU"],
                ["GAF AU", "GAF Online - AU", "GAF Commercial Sales - AU", "GAF Wholesale AU"], ["GAF AU", "GAF Commercial Sales - AU"]],
    }

    for brand, url in SHEETS.items():
        tgt = sheet_targets(url)
        days = sorted(tgt)
        tot = sum(abs(tgt[d][0]) for d in days)
        print(f"\n=== {brand}: {len(days)} sheet days {days[0]}..{days[-1]}")
        results = []
        for dk in date_keys:
            for sname, excl in status_sets.items():
                for depts in sets[brand]:
                    cands = {}
                    for fname, gpf in formulas.items():
                        g = defaultdict(float); rv = defaultdict(float)
                        for r in rows:
                            if r["st"] in excl or r.get("ldept") not in depts or r.get(dk) not in tgt:
                                continue
                            g[r[dk]] += gpf(r); rv[r[dk]] += revenue_f[fname](r)
                        cands[fname] = (g, rv)
                    g = defaultdict(float); seen = set()
                    for r in rows:
                        t = r["tid"]
                        if t in seen or r["st"] in excl or first_dept.get(t) not in depts or r.get(dk) not in tgt:
                            continue
                        seen.add(t); g[r[dk]] += header_gp[t]
                    cands["order estGP (header)"] = (g, None)
                    for fname, (g, rv) in cands.items():
                        werr = sum(abs(g[d] - tgt[d][0]) for d in days) / max(tot, 1)
                        w2 = sum(1 for d in days if abs(g[d] - tgt[d][0]) <= 0.02 * max(abs(tgt[d][0]), 1))
                        w5 = sum(1 for d in days if abs(g[d] - tgt[d][0]) <= 0.05 * max(abs(tgt[d][0]), 1))
                        mpp = None
                        if rv:
                            m = [abs(100 * g[d] / rv[d] - tgt[d][1]) for d in days if rv[d] and tgt[d][1] is not None]
                            mpp = round(sum(m) / len(m), 2) if m else None
                        ratios = " ".join(f"{(g[d] / tgt[d][0]):.2f}" if tgt[d][0] else "-" for d in days)
                        results.append((werr, f"{100*werr:5.1f}% $-weighted | within 2%: {w2:2d}/{len(days)} 5%: {w5:2d}/{len(days)} | margin off {mpp} pp | date={dk} status={sname} {fname} depts={depts}", ratios))
        results.sort(key=lambda x: x[0])
        for werr, line, ratios in results[:10]:
            print("  " + line)
        print("  daily ratios NetSuite/sheet for the best: " + results[0][2])
        print("  days: " + " ".join(d[5:] for d in days))

if __name__ == "__main__":
    main()
