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

    NON_ITEM = {"Discount", "ShipItem", "Subtotal", "Description", "Markup", "Payment", "EndGroup", "Group", "OthCharge"}
    formulas = {
        "all lines": lambda r: sign * f(r["amt"]) - f(r["cost"]),
        "items only": lambda r: (sign * f(r["amt"]) - f(r["cost"])) if r["it"] not in NON_ITEM else 0.0,
        "items+discounts": lambda r: (sign * f(r["amt"]) - f(r["cost"])) if r["it"] not in (NON_ITEM - {"Discount"}) else 0.0,
    }
    if "lgp" in ok:
        formulas["line estgrossprofit"] = lambda r: f(r.get("lgp"))
    revenue = lambda r: sign * f(r["amt"]) if r["it"] not in (NON_ITEM - {"Discount"}) else 0.0
    status_sets = {"all": None, "excl cancelled": {"C"}, "excl cancelled+closed": {"C", "H"}, "excl cancelled+closed+pending approval": {"A", "C", "H"}}
    date_keys = ["d"] + (["cd"] if "cd" in ok else [])

    for brand, url in SHEETS.items():
        tgt = sheet_targets(url)
        days = sorted(tgt)
        print(f"\n=== {brand}: {len(days)} sheet days {days[0] if days else ''}..{days[-1] if days else ''}")
        results = []
        for dk in date_keys:
            for sname, excl in status_sets.items():
                for fname, gpf in formulas.items():
                    for s in segs:
                        series = defaultdict(lambda: defaultdict(float))
                        rev = defaultdict(lambda: defaultdict(float))
                        for r in rows:
                            if excl and r["st"] in excl:
                                continue
                            day = r.get(dk)
                            if day not in tgt:
                                continue
                            v = r.get(s) or "(blank)"
                            series[v][day] += gpf(r)
                            rev[v][day] += revenue(r)
                        def err(chosen):
                            e = []
                            for day in days:
                                c = sum(series[v][day] for v in chosen)
                                t = tgt[day][0]
                                e.append(abs(c - t) / max(abs(t), 1.0))
                            return sum(e) / len(e)
                        chosen, best = [], 9e9
                        while True:
                            cand = [(err(chosen + [v]), v) for v in series if v not in chosen]
                            if not cand:
                                break
                            e, v = min(cand)
                            if e < best - 1e-4:
                                chosen.append(v); best = e
                            else:
                                break
                        mpp = []
                        for day in days:
                            g = sum(series[v][day] for v in chosen); rv = sum(rev[v][day] for v in chosen)
                            if rv and tgt[day][1] is not None:
                                mpp.append(abs(100 * g / rv - tgt[day][1]))
                        within1 = sum(1 for day in days if abs(sum(series[v][day] for v in chosen) - tgt[day][0]) <= 0.01 * max(abs(tgt[day][0]), 1))
                        results.append((best, dk, sname, fname, s, chosen, (sum(mpp) / len(mpp)) if mpp else None, within1))
        results.sort(key=lambda x: x[0])
        seen = 0
        for best, dk, sname, fname, s, chosen, mpp, within1 in results:
            print(f"  err {100*best:5.1f}% | days within 1%: {within1}/{len(days)} | margin off {mpp if mpp is None else round(mpp, 2)} pp | date={dk} status={sname} gp={fname} by {s} in {chosen}")
            seen += 1
            if seen >= 12:
                break


if __name__ == "__main__":
    main()
