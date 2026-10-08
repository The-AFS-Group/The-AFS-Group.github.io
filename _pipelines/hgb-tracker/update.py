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

Definition v5 (v4 three-path rule locked with Adam Carter 4 Aug 2026; v5 anchor
classification agreed 8 Oct 2026): a Home Gym Builder sale =
GAF AU / Online-AU cart with order total > $3,376 AND
  Path 1: >=1 "path 1" anchor (All-In-One Trainers, Home Gyms & Multi-Station,
          functional trainers incl. the Force USA Functional Trainer Rack and
          REP Altitude / Ares / side-mount functional trainers), OR
  Path 2: >=1 anchor + >=1 other attach-eligible distinct SKU, OR
  Path 3: >=2 anchors.

v5 changes how an anchor is recognised, not the paths:
  * anchor_skus.json holds the explicit SKU lists (edit it, not this file, when
    a new anchor SKU needs naming, e.g. one "marker" SKU per multi-box product).
  * Any SKU whose description says All-In-One Trainer / Home Gym / Functional
    Trainer counts as a path 1 anchor even with a blank or "attachment"
    subcategory, unless the description marks it as a component (cables, guide
    rods, shrouds, upgrades, box 2+, weight packages ...).
  * Every run writes hgb-review.json: SKUs sold on qualifying-size carts in the
    last 120 days that look like anchors (blank subcategory or anchor keywords)
    but are not classified, so new products get caught rather than silently
    missed.
Counted cumulatively from 1 Jul 2025 (FY26 start) toward 10,000 by 2030.
FY26 baseline of record: re-locked with Adam Carter 8 Oct 2026 for v5. The
NetSuite replica of v5 gave 1,311 (1,286 under v4 + 20 Functional Trainer
Rack carts + 5 REP Ares 2.0 carts); the exact-mode run reports the feed's own
figure as fy26Computed, and FY26_BASELINE is set to that figure once seen.
History: 1,257 manual pull -> 1,286 automated v4 (12 Aug 2026) -> v5.

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
FY26_BASELINE = 1311   # v5 replica estimate; set to fy26Computed after the first v5 run
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
# Explicit SKU lists live in anchor_skus.json so new products can be added
# without touching code. path1 = counts like an All-In-One Trainer;
# anchor = general anchor (paths 2/3); exclude = never an anchor.
_SKUS = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "anchor_skus.json")))
PATH1_SKU = set(_SKUS["path1"])
ANCHOR_SKU = set(_SKUS["anchor"])
NOT_ANCHOR_SKU = set(_SKUS.get("exclude", []))
# Description rules catch new SKUs that arrive with a blank or "attachment"
# subcategory (e.g. REP multi-box products created without a subcategory).
DESC_PATH1 = re.compile(r'ALL[- ]IN[- ]ONE TRAINER|HOME GYM|FUNCTIONAL TRAINER', re.I)
DESC_COMPONENT = re.compile(
    r'CABLE|GUIDE ROD|SHROUD|HEADPLATE|STICKER|UPGRADE|SPARE|\bPARTS?\b|STRAP|\bMAT\b|'
    r'WEIGHT (PACKAGE|STACK)|PEG ?BOARD|WALL[- ]?MOUNT|STORAGE|BOX ?[2-9]|CONNECTOR|'
    r'J[- ]?HOOK|SPOTTER|HANDLE|BAR\b|ANCHOR', re.I)
# Words that suggest an anchor product; used only to flag unclassified SKUs.
DESC_LOOKS_ANCHOR = re.compile(
    r'RACK|TRAINER|HOME GYM|TREADMILL|BIKE|ROWER|\bERG\b|LEG PRESS|HACK SQUAT|STEPR|'
    r'CLIMBER|ELLIPTICAL|\bSKI\b|SMITH|MULTI ?GYM|CABLE MACHINE|UPRIGHT|SQUAT', re.I)


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


def anchor_class(sku, sub, desc):
    """'path1', 'anchor' or None."""
    if sku in NOT_ANCHOR_SKU:
        return None
    if sku in PATH1_SKU or sub in AIO_HG:
        return 'path1'
    if DESC_PATH1.search(desc) and not DESC_COMPONENT.search(desc) and sub not in ATTACH_ONLY:
        return 'path1'
    if sku in ANCHOR_SKU or sub in ANCHOR:
        return 'anchor'
    return None


def qualifies(o):
    if o['total'] <= GATE:
        return False
    anchors = aio = attach = 0
    for sku, (sub, desc) in o['skus'].items():
        c = anchor_class(sku, sub, desc)
        if c:
            anchors += 1
            if c == 'path1':
                aio += 1
        if c or sub in ATTACH:
            attach += 1
    if anchors >= 2:
        return True
    if anchors >= 1 and attach >= 2:
        return True
    return aio >= 1


def review_list(orders, today, days=120):
    """SKUs on qualifying-size carts in the last `days` that look like anchors
    but are not classified, so a person can add them to anchor_skus.json."""
    since = today - datetime.timedelta(days=days)
    seen = {}
    for o in orders.values():
        if o['date'] < since or o['total'] <= GATE:
            continue
        for sku, (sub, desc) in o['skus'].items():
            if anchor_class(sku, sub, desc) or sku in NOT_ANCHOR_SKU:
                continue
            if DESC_COMPONENT.search(desc):
                continue
            if sub and (sub in ATTACH_ONLY or 'ttachment' in sub):
                continue
            if DESC_LOOKS_ANCHOR.search(desc):
                r = seen.setdefault(sku, {"sku": sku, "description": desc[:90],
                                          "subcategory": sub or "(blank)", "carts": 0})
                r["carts"] += 1
    return sorted(seen.values(), key=lambda r: -r["carts"])


def fetch_feed():
    """Fetch the published CSV with diagnostics and one retry — Google's edge
    occasionally serves an empty/interstitial response to datacenter IPs."""
    import time
    last = None
    for attempt in range(3):
        req = urllib.request.Request(FEED_URL, headers={
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) hgb-tracker",
            "Accept": "text/csv,*/*"})
        with urllib.request.urlopen(req, timeout=120) as r:
            data = r.read()
            print(f"fetch attempt {attempt + 1}: HTTP {r.status}, {len(data)} bytes, final host {r.url.split('/')[2]}")
            if len(data) > 100_000:
                return data.decode("utf-8")
            last = data[:300]
        time.sleep(10)
    sys.exit(f"FATAL: feed fetch returned a tiny/empty body after 3 attempts; first bytes: {last!r}")


def main():
    raw = fetch_feed()
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

    review = review_list(orders, today)
    with open("hgb-review.json", "w") as f:
        json.dump({"asOf": today.strftime("%-d %b %Y"), "windowDays": 120,
                   "note": "SKUs that look like anchors but are not classified. Add each to anchor_skus.json (path1 / anchor / exclude).",
                   "skus": review}, f, indent=2)
        f.write("\n")
    if review:
        print(f"REVIEW: {len(review)} unclassified anchor-like SKU(s) on qualifying-size carts:")
        for r in review[:25]:
            print(f"  {r['sku']:<32} {r['carts']:>3} carts  [{r['subcategory']}] {r['description']}")

    if not (1257 <= count <= TARGET):
        sys.exit(f"FATAL: cumulative count {count} out of plausible range")

    payload = {
        "count": count, "target": TARGET,
        "asOf": today.strftime("%-d %b %Y"),
        "window": "cumulative since 1 Jul 2025 (FY26 start)",
        "periodStart": "2025-07-01", "periodEnd": "2030-12-31",
        "fy27ToDate": fy27, "fy26Baseline": FY26_BASELINE,
        "note": ("Three-path rule v5: Path 1 = AIO / Home Gym / functional trainer anchors incl. Functional Trainer Rack and REP Altitude/Ares "
                 "(v4 locked 4 Aug 2026; v5 anchor classification agreed with Adam 8 Oct 2026). "
                 f"FY26 baseline {FY26_BASELINE:,} (re-locked for v5). "
                 "Source: NetSuite saved search GAF BHAG Data via GURUS "
                 "sheet feed, GAF AU + Online-AU. Updated unattended by the hgb-tracker GitHub Action in this repo."),
    }
    if fy26_same is not None:
        payload["fy26SamePoint"] = fy26_same
    if exact:
        payload["fy26Computed"] = fy26_full
    payload["reviewSkus"] = len(review)

    with open("hgb-tracker.json", "w") as f:
        json.dump(payload, f, indent=2)
        f.write("\n")
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
