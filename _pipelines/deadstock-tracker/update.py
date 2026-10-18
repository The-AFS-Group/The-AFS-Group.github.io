#!/usr/bin/env python3
"""
Dead stock tracker — daily unattended update for the GAF master dashboard
(OPSP tab, Trend Detail: "GAF Dead Stock vs Sales" and "Gold Coast Sub-location
Dead Stock").

Chain: NetSuite -> "Deadstock Tracker - FY27" Google Sheet, LOCATION SUMMARY tab
  (published-to-web CSV) -> this job -> deadstock-tracker.json -> pages repo.

No NetSuite, Google or personal-account dependency: the sheet is read through its
published-CSV endpoint, same as the dashboard's other feeds.

The tab's right-hand table ("DEADSTOCK ITEMS: ALL LOCATIONS : MOM CHANGE") has one
row per location ("<Location> Total") and one column per month ("Oct-26 Value").
Each month column is that month's closing value; the newest column is the current
value. Rows are found by label, not position, because the table grows.

Q1 FY27's frozen Critical Number lives in _src/gaf-master-dashboard/data/opsp-finals.json
and is never touched by this job.
"""
import csv, io, json, os, re, sys, datetime, urllib.request

PUB = "2PACX-1vRxikJQSlITmNCmiUewAGxefehrRFcJ2s-syIiKQoZsTyhH58hcVNrVfr1GRxtc0IRMVCU7Cbm_D9sB"
FEED_URL = os.environ.get("DEADSTOCK_FEED_URL", "").strip() or (
    f"https://docs.google.com/spreadsheets/d/e/{PUB}/pub?gid=1532643813&single=true&output=csv")
OUT = "deadstock-tracker.json"
PREV = os.environ.get("DEADSTOCK_PREV", "../../_src/gaf-master-dashboard/public/deadstock-tracker.json")
DAILY_KEEP = 400

# GAF figure = the AFS-Gold Coast parent location (same scope as Q1's critical number).
GC_ROW = re.compile(r"^AFS-Gold Coast Total$", re.I)
# Sub-locations agreed with Adam Carter, Oct 2026. goal 0 = clear it all; None = track only.
LOCATIONS = [
    ("quarantine",      "GC Quarantine New 2015", 0,    re.compile(r"GC-QUARANTINE NEW 2015 Total$", re.I)),
    ("showroomMissing", "Showroom Missing",       0,    re.compile(r"Showroom-Missing-\d{4} Total$", re.I)),
    ("exDemo",          "GC Ex-Demo",             0,    re.compile(r"GC-Ex-Demo Total$", re.I)),
    ("arundel",         "Arundel Showroom",       0,    re.compile(r"Arundel Showroom Total$", re.I)),
    ("spareParts",      "GC Spare Parts",         None, re.compile(r"GC-Spare Parts Total$", re.I)),
]
MONTH_COL = re.compile(r"^([A-Za-z]{3})-(\d{2}) Value$")
MON = {m: i + 1 for i, m in enumerate("jan feb mar apr may jun jul aug sep oct nov dec".split())}


def money(s):
    s = (s or "").strip().replace("$", "").replace(",", "").replace(" ", "")
    if s in ("", "-"):
        return None
    if s.startswith("(") and s.endswith(")"):
        s = "-" + s[1:-1]
    try:
        return round(float(s))
    except ValueError:
        return None


def main():
    req = urllib.request.Request(FEED_URL, headers={"User-Agent": "deadstock-tracker"})
    text = urllib.request.urlopen(req, timeout=60).read().decode("utf-8-sig")
    if text.lstrip().startswith("<"):
        sys.exit("Feed returned HTML, not CSV — is the LOCATION SUMMARY tab published to the web?")
    rows = list(csv.reader(io.StringIO(text)))

    # Header row: has a "Location" cell followed by "Mmm-YY Value" cells.
    hdr_i, loc_col, mcols = None, None, []
    for i, r in enumerate(rows):
        cells = [c.strip() for c in r]
        if "Location" in cells:
            lc = cells.index("Location")
            mc = [(j, MONTH_COL.match(c)) for j, c in enumerate(cells) if j > lc and MONTH_COL.match(c)]
            if mc:
                hdr_i, loc_col, mcols = i, lc, mc
                break
    if hdr_i is None:
        sys.exit("Couldn't find the location-by-month table (header 'Location' + 'Mmm-YY Value').")

    months = [f"20{m.group(2)}-{MON[m.group(1).lower()]:02d}" for _, m in mcols]

    def find(rx):
        for r in rows[hdr_i + 1:]:
            if len(r) > loc_col and rx.search(r[loc_col].strip()):
                return [money(r[j]) if j < len(r) else None for j, _ in mcols]
        return None

    gc = find(GC_ROW)
    if gc is None or gc[-1] is None:
        sys.exit("AFS-Gold Coast Total row missing or empty.")
    locs = []
    for key, name, goal, rx in LOCATIONS:
        v = find(rx)
        if v is None:
            print(f"warning: no row for {name}; filling zeros (location cleared or renamed?)")
            v = [0] * len(months)
        locs.append({"key": key, "name": name, "goal": goal, "values": [x if x is not None else 0 for x in v]})

    today = datetime.date.today().isoformat()
    daily = []
    if os.path.exists(PREV):
        try:
            daily = json.load(open(PREV)).get("daily", [])
        except Exception:
            daily = []
    daily = [d for d in daily if d.get("date") != today]
    daily.append({"date": today, "gc": gc[-1], "locations": {l["key"]: l["values"][-1] for l in locs}})
    daily = daily[-DAILY_KEEP:]

    out = {
        "asOf": today,
        "months": months,
        "gc": gc,
        "locations": locs,
        "daily": daily,
        "note": "Deadstock Tracker - FY27, LOCATION SUMMARY tab (NetSuite). Month columns are closing values; "
                "the newest column is today's value. Written daily by the deadstock-tracker GitHub Action.",
    }
    json.dump(out, open(OUT, "w"), indent=2)
    print(f"GC {gc[-1]:,} · sub-locations " + ", ".join(f"{l['name']} {l['values'][-1]:,}" for l in locs))


if __name__ == "__main__":
    main()
