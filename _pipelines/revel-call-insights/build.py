"""Build the data file behind the Revel call insights dashboard.

Reads the published "Revel call analysis" Google Sheet (one row per Aircall
call, with an AI analysis and the transcript), sorts each analysed call into
the dashboard's categories and writes revel-call-insights/data.js.

    python build.py                 # download the sheet
    python build.py --csv calls.csv # use a local export instead

This repo and its Actions logs are public. The output keeps only whitelisted
fields: no phone numbers, emails, recordings or full transcripts, and the short
quotes it does keep are scrubbed of anything that looks like contact details.
The script prints counts only, never record contents.
"""
import argparse
import csv
import io
import json
import os
import re
import sys
import urllib.request
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pricing
import taxonomy

# The same published sheet the master dashboard's Call Insights tab reads. Set
# REVEL_CALLS_CSV_URL (e.g. as an Actions secret) to point somewhere else.
SHEET_CSV_URL = os.environ.get("REVEL_CALLS_CSV_URL") or (
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vSGepLwTQvk_niQff7RNd-t0-jETfjjGbjsVtp_G-DNDfcPL4LN6sqNPGxMKmqJPXnQQIF_ImWuttBQ"
    "/pub?gid=1761896659&single=true&output=csv"
)
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "revel-call-insights" / "data.js"
BRISBANE = timezone(timedelta(hours=10))  # the sales team's clock; Queensland has no daylight saving

QUALITY = {"excellent": 4, "good": 3, "fair": 2, "poor": 1}
SATISFACTION = {"very_satisfied": 4, "satisfied": 3, "neutral": 2, "dissatisfied": 1, "very_dissatisfied": 1}
SENTIMENT = {"very_negative": -2, "negative": -1, "neutral": 0, "positive": 1, "very_positive": 2}
SEGMENTS = {
    "residential_home_sauna": "Residential", "residential_apartment": "Residential",
    "commercial_gym_spa": "Commercial", "commercial_recovery_center": "Commercial", "commercial_airbnb": "Commercial",
    "commercial_facility": "Commercial", "other_commercial": "Commercial", "institutional_medical": "Commercial",
}
POST_PURCHASE_FILTERS = {"ai_classified_post_purchase", "post_purchase_service"}

_EMAIL = re.compile(r"[\w.+-]+\s*@\s*[\w-]+(?:\s*\.\s*[\w-]+)+")
_PHONE = re.compile(r"(?:\+?\d[\d\s().-]{6,}\d)")


def scrub(text, limit=220):
    text = re.sub(r"\s+", " ", (text or "")).strip()
    text = _EMAIL.sub("[email]", text)
    text = _PHONE.sub(lambda m: m.group(0) if len(re.sub(r"\D", "", m.group(0))) < 8 else "[number]", text)
    if len(text) > limit:
        text = text[: limit - 1].rsplit(" ", 1)[0] + "…"
    return text


def window(text, rx, width=230):
    """The part of a transcript line around the phrase that matched, so long turns stay short."""
    text = re.sub(r"\s+", " ", text or "").strip()
    m = rx.search(text) if rx else None
    if not m or len(text) <= width:
        return scrub(text, width)
    start = max(0, m.start() - width // 2)
    piece = text[start:start + width]
    if start > 0:
        piece = "…" + piece.split(" ", 1)[-1]
    if start + width < len(text):
        piece = piece.rsplit(" ", 1)[0] + "…"
    return scrub(piece, width + 2)


def started_at(row):
    try:
        ts = json.loads(row.get("raw_json") or "{}")["call"]["started_at"]
        return datetime.fromtimestamp(int(ts), BRISBANE)
    except (ValueError, KeyError, TypeError):
        pass
    try:
        return datetime.strptime(row["call_datetime_iso"][:19], "%Y-%m-%d %H:%M:%S")
    except (ValueError, KeyError):
        return None


def load_rows(csv_path):
    csv.field_size_limit(min(sys.maxsize, 2**31 - 1))
    if csv_path:
        handle = open(csv_path, newline="", encoding="utf-8")
    else:
        with urllib.request.urlopen(SHEET_CSV_URL, timeout=300) as resp:
            print(f"Sheet download: HTTP {resp.status}")
            handle = io.StringIO(resp.read().decode("utf-8"), newline="")
    with handle:
        return list(csv.DictReader(handle))


def build(rows):
    agents = sorted({(r.get("agent") or "").strip() or "Unassigned" for r in rows})
    agent_ix = {a: i for i, a in enumerate(agents)}
    volume = Counter()
    calls = []

    for row in rows:
        when = started_at(row)
        if not when:
            continue
        day = when.strftime("%Y-%m-%d")
        agent = (row.get("agent") or "").strip() or "Unassigned"
        direction = "O" if (row.get("direction") or "").lower().startswith("out") else "I"
        analysed = (row.get("should_analyze") or "").strip().upper() == "TRUE"
        status = "A" if analysed else ("S" if row.get("filter_reason") in POST_PURCHASE_FILTERS else "X")
        volume[(day, agent_ix[agent], direction, status)] += 1
        if not analysed:
            continue

        call_turns = pricing.turns(row.get("transcript_text"))
        customer_text = " ".join(t for s, t in call_turns if s == "external")
        price_class, offer_type, pressure_line, offer_line = pricing.analyse(call_turns)

        stage = (row.get("buying_stage") or "").strip()
        outcome = (row.get("call_outcome") or "").strip()
        is_sales = stage != "post_purchase" and (outcome == "purchased" or outcome in taxonomy.NOT_CLOSED_OUTCOMES)
        not_closed = None
        if is_sales and outcome != "purchased":
            not_closed = taxonomy.not_closed_reason(
                outcome, row.get("outcome_reason"), row.get("objections_unresolved"),
                row.get("barrier_primary"), row.get("barrier_type_primary"))

        try:
            sentiment_score = round(float(row.get("sentiment_score")), 2)
        except (TypeError, ValueError):
            sentiment_score = None
        try:
            duration = int(float(row.get("duration_sec") or 0))
        except ValueError:
            duration = 0

        calls.append({
            "id": row.get("call_id"),
            "d": day,
            "h": when.strftime("%H:%M"),
            "a": agent_ix[agent],
            "dir": direction,
            "dur": duration,
            "cat": taxonomy.product_categories(
                row.get("products_category_general"), row.get("primary_product_interest"),
                row.get("products_mentioned_specific")),
            "pi": scrub(row.get("primary_product_interest"), 80),
            "seg": SEGMENTS.get(row.get("customer_segment"), ""),
            "rsn": taxonomy.call_reason(stage, direction, row.get("trigger_event_primary") or "",
                                        row.get("motivation_primary") or "", row.get("trigger_event_secondary") or "",
                                        row.get("job_functional") or ""),
            "trig": scrub(row.get("trigger_event_primary"), 120),
            "req": taxonomy.customer_requests(
                customer_text, f"{row.get('missing_information_critical', '')} {row.get('confusion_topic', '')}",
                price_class in ("PO", "PH")),
            "rap": QUALITY.get(row.get("rapport_quality"), 0),
            "nd": QUALITY.get(row.get("needs_discovery_quality"), 0),
            "pm": QUALITY.get(row.get("product_matching_quality"), 0),
            "oh": QUALITY.get(row.get("objection_handling_quality"), 0),
            "ce": QUALITY.get(row.get("closing_effectiveness"), 0),
            "sat": SATISFACTION.get(row.get("customer_satisfaction_apparent"), 0),
            "sl": SENTIMENT.get(row.get("sentiment_label")),
            "ss": sentiment_score,
            "out": outcome,
            "stg": stage,
            "sale": is_sales,
            "nc": not_closed,
            "why": scrub(row.get("outcome_reason"), 160),
            "obj": scrub(row.get("objections_unresolved"), 120),
            "pr": price_class,
            "pt": offer_type,
            "ps": (row.get("price_sensitivity_level") or "").strip(),
            "pq": window(pressure_line, pricing.PRESSURE) if pressure_line else "",
            "oq": window(offer_line, pricing.OFFER_ANY) if offer_line else "",
            "comp": taxonomy.competitors(row.get("competitors_mentioned")),
            "cmod": taxonomy.competitor_models(scrub(row.get("competitor_models_specific"), 160)),
            "cpc": (row.get("competitive_price_comparison") or "").strip(),
            "edge": taxonomy.themes(row.get("our_perceived_advantage"), taxonomy.REVEL_EDGE_THEMES),
            "gap": taxonomy.themes(row.get("our_perceived_disadvantage"), taxonomy.REVEL_GAP_THEMES),
            "edt": scrub(row.get("our_perceived_advantage"), 110),
            "gpt": scrub(row.get("our_perceived_disadvantage"), 110),
            "q": scrub(row.get("verbatim_quote_most_revealing"), 200),
            "co": scrub(row.get("coaching_opportunity_specific"), 140),
        })

    calls.sort(key=lambda c: (c["d"], c["h"]))
    return {
        "generated": datetime.now(BRISBANE).strftime("%Y-%m-%d %H:%M"),
        "agents": agents,
        "productCategories": taxonomy.PRODUCT_CATEGORIES,
        "callReasons": [label for label, _ in taxonomy.CALL_REASONS] + [taxonomy.OTHER_REASON],
        "requests": taxonomy.REQUEST_LABELS,
        "notClosedReasons": [label for label, _ in taxonomy.NOT_CLOSED_REASONS] + [taxonomy.OTHER_NOT_CLOSED],
        "edgeThemes": [label for label, _ in taxonomy.REVEL_EDGE_THEMES],
        "gapThemes": [label for label, _ in taxonomy.REVEL_GAP_THEMES],
        "priceClasses": pricing.CLASS_LABELS,
        "offerTypes": pricing.OFFER_LABELS,
        "volume": [[d, a, di, s, n] for (d, a, di, s), n in sorted(volume.items())],
        "calls": calls,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--csv", help="local CSV export of the sheet (default: download it)")
    args = parser.parse_args()

    rows = load_rows(args.csv)
    data = build(rows)
    if len(data["calls"]) < 100:
        sys.exit(f"Only {len(data['calls'])} analysed calls found in {len(rows)} rows; refusing to overwrite the dashboard data.")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    OUT.write_text(f"window.REVEL_CALLS={payload};\n", encoding="utf-8")
    first, last = data["calls"][0]["d"], data["calls"][-1]["d"]
    print(f"Rows read: {len(rows)}; analysed calls: {len(data['calls'])} ({first} to {last}); "
          f"wrote {OUT.relative_to(ROOT)} ({len(payload) / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
