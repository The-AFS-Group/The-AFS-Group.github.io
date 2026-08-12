#!/usr/bin/env python3
"""
HGB BHAG tracker — daily unattended update.

Chain: NetSuite saved search "GAF BHAG Data" (customsearch6578)
  -> GURUS daily export -> Google Sheet (published CSV)
  -> this job (classify v4 rule) -> hgb-tracker.json -> pages repo
  -> GAF master dashboard OPSP tab.

Deliberately has NO NetSuite, Google or personal-account dependency: the sheet
is read via its published-CSV endpoint and the result is pushed to the pages
repo with a repo-owned deploy key. Survives any individual's departure.

Definition v4 (locked with Adam Carter 4 Aug 2026): a Home Gym Builder sale =
GAF AU / Online-AU cart with order total > $3,376 AND
  Path 1: >=1 anchor in All-In-One Trainers or Home Gyms & Multi-Station, OR
  Path 2: >=1 anchor + >=1 other attach-eligible distinct SKU, OR
  Path 3: >=2 anchors.
Counted cumulatively from 1 Jul 2025 (FY26 start) toward 10,000 by 2030.
FY26 baseline of record: 1,257.

Modes:
  exact  — feed date floor <= 2025-07-01: everything computed from the feed,
           including fy26SamePoint (restores the dashboard YoY row).
  legacy — feed floor later (rolling window): count = frozen FY26 baseline
           + FY27-to-date from the feed; fy26SamePoint omitted.
"""
import csv, io, json, os, re, sys, datetime, urllib.request

# The published-CSV endpoint of the GURUS-fed sheet. Kept out of the public
# repo as an Actions secret (HGB_FEED_URL) while the export still carries
# customer contact columns.
FEED_URL = os.environ.get("HGB_FEED_URL", "").strip()
if not FEED_URL:
    sys.exit("FATAL: HGB_FEED_URL env var is not set — add it as a repo Actions secret")
TARGET = 10000
FY26_BASELINE = 1257
FY26_START = datetime.date(2025, 7, 1)
FY27_START = datetime.date(2026, 7, 1)
GATE = 3376.0

AIO_HG = {'All-In-One Trainers - All-In-One Trainers', 'All-In-One Trainers',
          'Home Gyms & Multi-Station Units'}
ANCHOR = AIO_HG | {
    'Rigs & Racks - Rigs', 'Rigs & Racks - Power Racks', 'Power Racks',
    'Treadmills - Motorised Treadmill', 'Treadmills - Manual Treadmill',
    'Manual Treadmills', 'Treadmills',
    'Bikes - Fan Bikes', 'Fan Bikes', 'Bikes - Spin Bikes',
    'Bikes - Upright Bikes', 'Bikes - Recumbent Bikes', 'Recumbent Bikes',
    'Rowers', 'Ski Trainers', 'Ski', 'Ellipticals',
    'Stair Climbers', 'Stair Climber'}
ATTACH_ONLY = {
    'Storage', 'Storage - Bar & Plate Storage', 'Storage - Dumbbell Storage',
    'Storage - Functional Storage',
    'Benches', 'Benches - Adjustable', 'Benches - Flat', 'Benches - Sliding',
    'Dumbbells', 'Dumbbells & Kettlebells - Adjustable Dumbbells',
    'Dumbbells & Kettlebells - Fixed Dumbbells', 'Dumbbells & Kettlebells - Kettlebells',
    'Barbells', 'Barbells & Weight Plates - Barbell Collars',
    'Barbells & Weight Plates - Bumper Plates', 'Barbells & Weight Plates - Olympic Barbells',
    'Barbells & Weight Plates - Speciality Barbells', 'Barbells & Weight Plates - Weight Plates',
    'Saunas', 'Ice Baths', 'Hyrox', 'Sleds',
    'Balls - Slam Balls', 'Balls - Wall Balls',
    'Bags - Core Bags', 'Vests', 'Boxes - Foam', 'Boxes - Wooden',
    'Training Aids', 'Training Accessories',
    'Flooring', 'Rubber Flooring - Home Flooring', 'Rubber Flooring - Commercial Flooring',
    'Turf'}
ATTACH = ANCHOR | ATTACH_ONLY
# SKU overrides for anchor variants whose NetSuite subcategory is blank or off
# (established on the 4 Aug 2026 baseline run).
AIO_HG_SKU = {'F-F100-V2', 'F-G6-B', 'F-X15-V2', 'F-G3-NOLEGPRESS', 'CENTR-WS.1', 'I-FT10-PRO'}
ANCHOR_SKU = {'F-PPR', 'F-GLIDE-T'}
# Description fallback for anchor SKUs the subcategory map misses entirely.
DESC_ANCHOR = re.compile(r'ALL[- ]IN[- ]ONE TRAINER|HOME GYM|FUNCTIONAL TRAINER', re.I)
DESC_EXCLUDE = re.compile(r'ATTACHMENT|SPARE|UPGRADE|PART|MAT |ANCHOR|STRAP', re.I)


def base_sku(s):
    s = re.sub(r'^\(GF\)\s*', '', s.strip())
    s = re.sub(r'_Box\d+$', '', s)
    s = re.sub(r'\s+--\s.*$', '', s)
    return s


def parse_date(s):
    d, m, y = s.split('/')
    return datetime.date(int(y), int(m), int(d))


def money(s):
    s = (s or '').replace(',', '').replace('$', '').strip()
    return float(s) if s else 0.0


def resolve_columns(hdr):
    """Name-based column lookup, robust to the PII columns being removed."""
    def one(name):
        idx = [i for i, h in enumerate(hdr) if h.strip() == name]
        if not idx:
            sys.exit(f"FATAL: feed is missing required column {name!r}: {hdr}")
        return idx[0]
    cols = {
        'date': one('Date'),
        'doc': one('Document Number'),
        'sub': one('Subcategory'),
        'desc': one('Description'),
        'total': one('Amount (Transaction Total)'),
    }
    # SKU column: NetSuite emits it as a second "Name" directly after
    # Description. After the customer Name column is dropped it may be the
    # only "Name" left.
    names = [i for i, h in enumerate(hdr) if h.strip() == 'Name']
    after_desc = [i for i in names if i == cols['desc'] + 1]
    if after_desc:
        cols['sku'] = after_desc[0]
    elif len(names) == 1:
        cols['sku'] = names[0]
    else:
        sys.exit(f"FATAL: cannot identify the SKU 'Name' column in {hdr}")
    pii = [h for h in ('Email', 'Customer Phone (Populate on save)') if h in [x.strip() for x in hdr]]
    if pii:
        print(f"WARNING: feed still carries PII columns {pii} on a published sheet")
    return cols


def is_anchor(sku, sub, desc):
    if sub in ANCHOR or sku in AIO_HG_SKU or sku in ANCHOR_SKU:
        return True
    return bool(DESC_ANCHOR.search(desc)) and not DESC_EXCLUDE.search(desc) \
        and sub not in ATTACH_ONLY


def qualifies(o):
    if o['total'] <= GATE:
        return False
    anchors = aio = attach = 0
    for sku, (sub, desc) in o['skus'].items():
        a = is_anchor(sku, sub, desc)
        if a:
            anchors += 1
            if sub in AIO_HG or sku in AIO_HG_SKU:
                aio += 1
        if a or sub in ATTACH:
            attach += 1
    if anchors >= 2:
        return True
    if anchors >= 1 and attach >= 2:
        return True
    return aio >= 1


def main():
    raw = urllib.request.urlopen(FEED_URL, timeout=120).read().decode('utf-8')
    rows = list(csv.reader(io.StringIO(raw)))
    if len(rows) < 10000:
        sys.exit(f"FATAL: feed has only {len(rows)} rows — export looks broken or empty")
    cols = resolve_columns(rows[0])

    orders = {}
    for r in rows[1:]:
        if len(r) <= cols['total'] or not r[cols['date']] or not r[cols['doc']]:
            continue
        o = orders.setdefault(r[cols['doc']], {
            'date': parse_date(r[cols['date']]),
            'total': money(r[cols['total']]),
            'skus': {}})
        o['skus'][base_sku(r[cols['sku']])] = (r[cols['sub']].strip(), r[cols['desc']])

    floor = min(o['date'] for o in orders.values())
    today = datetime.date.today()
    builds = sorted(o['date'] for o in orders.values() if qualifies(o))
    fy27 = sum(1 for d in builds if d >= FY27_START)
    exact = floor <= FY26_START

    if exact:
        count = sum(1 for d in builds if d >= FY26_START)
        fy26_full = sum(1 for d in builds if FY26_START <= d < FY27_START)
        try:
            same_point_end = datetime.date(today.year - 1, today.month, today.day)
        except ValueError:  # 29 Feb
            same_point_end = datetime.date(today.year - 1, today.month, 28)
        fy26_same = sum(1 for d in builds if FY26_START <= d <= same_point_end)
        if not (1100 <= fy26_full <= 1500):
            sys.exit(f"FATAL: exact-mode FY26 count {fy26_full} is implausible vs baseline {FY26_BASELINE}")
        print(f"exact mode: floor {floor}, FY26 computed {fy26_full} (baseline {FY26_BASELINE}), "
              f"cumulative {count}, FY27 {fy27}, same-point {fy26_same}")
    else:
        count = FY26_BASELINE + fy27
        fy26_same = None
        print(f"legacy mode: floor {floor} is after FY26 start; count = {FY26_BASELINE} + {fy27} = {count}")

    if not (1257 <= count <= TARGET):
        sys.exit(f"FATAL: cumulative count {count} out of plausible range")

    payload = {
        "count": count, "target": TARGET,
        "asOf": today.strftime("%-d %b %Y"),
        "window": "cumulative since 1 Jul 2025 (FY26 start)",
        "periodStart": "2025-07-01", "periodEnd": "2030-12-31",
        "fy27ToDate": fy27, "fy26Baseline": FY26_BASELINE,
        "note": ("Three-path rule, Path 1 = AIO / Home Gym anchor only (locked with Adam 4 Aug 2026). "
                 "FY26 baseline 1,257 builds. Source: NetSuite saved search GAF BHAG Data via GURUS "
                 "sheet feed, GAF AU + Online-AU. Updated unattended by the hgb-tracker GitHub Action in this repo."),
    }
    if fy26_same is not None:
        payload["fy26SamePoint"] = fy26_same

    with open("hgb-tracker.json", "w") as f:
        json.dump(payload, f, indent=2)
        f.write("\n")
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
