"""Build the data file behind the Revel service insights dashboard.

Reads the published "Revel call analysis" Google Sheet (one row per Aircall
call, with a transcript) and keeps the after-sales service calls: the ones the
sheet screened out as post-purchase plus analysed calls at the post_purchase
stage. Each call is read for its issue, what the rep did, how it ended and how
the customer's mood moved. HubSpot Desk tickets come from hubspot.py.

    python build.py                          # download the sheet; tickets from HubSpot if HUBSPOT_TOKEN is set
    python build.py --csv calls.csv          # use a local export of the sheet
    python build.py --tickets-raw raw.jsonl  # tickets from a local export ({"id", "properties"} per line)

Without HUBSPOT_TOKEN or --tickets-raw, the last ticket snapshot (tickets.json,
no customer details) is reused so the call side can still refresh nightly.

This repo and its Actions logs are public. The output keeps only whitelisted,
derived fields: no phone numbers, emails, recordings, ticket subjects or full
transcripts. Short quotes are scrubbed of contact details and names after
greetings. The script prints counts only, never record contents.
"""
import argparse
import importlib.util
import json
import os
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from statistics import median

import hubspot
import service

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SALES = HERE.parent / "revel-call-insights"
sys.path.insert(0, str(SALES))
import pricing  # noqa: E402  (transcript turns)
import taxonomy  # noqa: E402  (product categories)

# The sales pipeline's build.py already knows how to download the sheet, read call
# times and scrub quotes; load it under another name so the two don't clash.
_spec = importlib.util.spec_from_file_location("sales_build", SALES / "build.py")
sales = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(sales)

OUT_DIR = ROOT / "revel-service-insights"
SNAPSHOT = HERE / "tickets.json"
SERVICE_FILTERS = {"ai_classified_post_purchase", "post_purchase_service"}
SATISFACTION = {"very_satisfied": 2, "satisfied": 1, "neutral": 0, "dissatisfied": -1, "very_dissatisfied": -2}

_GREETING_NAME = re.compile(r"\b((?i:thanks|thank you|cheers|hi|hey|hello|bye|morning|afternoon|sorry|mate)),? ((?!Revel|Rebel)[A-Z][a-z]+)\b")
_SELF_NAME = re.compile(r"\b((?i:this is|my name is|it'?s|you'?re speaking (?:to|with)|speaking with)) ((?!Revel|Rebel)[A-Z][a-z]+(?: [A-Z][a-z]+)?)")
_NAME_SPEAKING = re.compile(r"\b(?!Revel|Rebel)[A-Z][a-z]+(?: [A-Z][a-z]+)? (speaking)\b")
_ADDRESS = re.compile(r"\b\d{1,5}[a-z]?\s+(?:[A-Z][a-z]+\s+){1,3}(?:Road|Rd|Street|St|Avenue|Ave|Drive|Dr|Court|Ct|Place|Pl|Lane|Ln|Crescent|Cres|"
                      r"Parade|Pde|Highway|Hwy|Way|Close|Terrace|Tce|Boulevard|Grove|Circuit|Cct|Esplanade|Rise|Square)\b[^.?!]{0,60}")


# Calls to the 3PL, couriers, installers and technicians rather than a customer.
_SUPPLIER = re.compile(r"thanks for calling winning|welcome to winning|winning services|calling on behalf of (?:a company called )?re[vb]el|"
                       r"we have a customer (?:that|who)|one of our customers|for (?:a|our) customer (?:in|at|called)", re.I)
_IVR = re.compile(r"thanks? (?:you )?for calling|welcome to|press (?:one|two|three|\d)|your call is important|(?:this|the) call (?:may|is|will) (?:be )?record", re.I)
_VOICEMAIL = re.compile(r"after the (?:tone|beep)|leave (?:a|your) (?:brief |short )?(?:message|name)|(?:can'?t|cannot|unable to) (?:take|get to) (?:your|the) call|"
                        r"not available (?:to take|right now)|voicemail|mailbox", re.I)


def scrub(text, limit):
    text = _GREETING_NAME.sub(r"\1", text or "")
    text = _SELF_NAME.sub(r"\1 [name]", text)
    text = _NAME_SPEAKING.sub(r"[name] \1", text)
    text = _ADDRESS.sub("[address]", text)
    text = re.sub(r"\b(?:SO|PO)\d{6,}", "[order]", text)
    return sales.scrub(text, limit)


def merged(turns):
    """Collapse the diarised fragments into speaker turns, skipping one- or two-word backchannels."""
    out = []
    for speaker, text in turns:
        if out and out[-1][0] != speaker and len(text.split()) <= 2:
            continue
        if out and out[-1][0] == speaker:
            out[-1][1] = out[-1][1] + " " + text
        else:
            out.append([speaker, text])
    return [(s, t) for s, t in out]


def segments(turns):
    """Text by speaker for the opening (first 35%), closing (last 30%) and wrap-up (last 40%) of a call.

    A turn belongs to the closing or wrap-up when it ends inside it, so a long last turn isn't lost.
    """
    total = sum(len(t) for _, t in turns) or 1
    pos, seg = 0, defaultdict(list)
    for speaker, text in turns:
        start, end = pos / total, (pos + len(text)) / total
        pos += len(text)
        if start < 0.35:
            seg[(speaker, "open")].append(text)
        if end > 0.70:
            seg[(speaker, "close")].append(text)
        if end > 0.60:
            seg[(speaker, "wrap")].append(text)
    return {k: " ".join(v) for k, v in seg.items()}


def first_solution_at(turns, duration):
    """Rough seconds into the call when the rep first offered a fix or next step."""
    total = sum(len(t) for _, t in turns) or 1
    pos = 0
    for speaker, text in turns:
        if speaker == "internal" and service.solutions(text):
            return int(duration * pos / total) if duration else None
        pos += len(text)
    return None


def best_line(turns, speaker, rxs, width):
    """The richest line from one speaker that matches any of the patterns, cut down around the match."""
    best, best_score = "", 0
    for s, text in turns:
        if s != speaker or len(text.split()) < 8 or _IVR.search(text):
            continue
        score = service.hits(rxs, text)
        if score > best_score:
            best, best_score = text, score
    if not best:
        return ""
    rx = next(r for r in rxs if r.search(best))
    return scrub(sales.window(best, rx, width), width + 2)


# A good example fix is the rep walking through steps or explaining the cause, about the
# call's own problem: troubleshooting and explanation count double, then parts and issue words.
HOW_RX = [rx for _, rxs in service.SOLUTIONS[:2] for rx in rxs]
ACTION_RX = [rx for _, rxs in service.SOLUTIONS[2:6] for rx in rxs]
COMPONENT_RX = [rx for _, rxs in service.COMPONENTS for rx in rxs]
ISSUE_RX = dict(service.ISSUES)


def fix_line(turns, issue, width=220):
    best, best_score = "", 0
    for speaker, text in turns:
        if speaker != "internal" or len(text.split()) < 12:
            continue
        how, action = service.hits(HOW_RX, text), service.hits(ACTION_RX, text)
        if not how and not action:
            continue
        score = 2 * how + action + service.hits(COMPONENT_RX, text) + service.hits(ISSUE_RX.get(issue, []), text)
        if score > best_score:
            best, best_score = text, score
    if not best:
        return ""
    rx = next((r for r in HOW_RX if r.search(best)), None) or next(r for r in ACTION_RX if r.search(best))
    return scrub(sales.window(best, rx, width), width + 2)


def headline(row):
    note = (row.get("filter_details") or "").strip()
    if note.startswith("AI:"):
        return note[3:].strip()
    if note.startswith("Service call:"):
        return re.sub(r"\.\*|\\b|[()|]", " ", note[13:]).strip()
    return " ".join(x for x in (row.get("trigger_event_primary"), row.get("key_insight_1"), row.get("next_action_required_us")) if x)


def build_calls(rows):
    agents = sorted({(r.get("agent") or "").strip() or "Unassigned" for r in rows})
    agent_ix = {a: i for i, a in enumerate(agents)}
    calls, seen = [], set()
    for row in rows:
        if row.get("call_id") in seen:  # the sheet repeats a few calls
            continue
        service_call = row.get("filter_reason") in SERVICE_FILTERS or (
            (row.get("should_analyze") or "").upper() == "TRUE" and row.get("buying_stage") == "post_purchase")
        if not service_call:
            continue
        when = sales.started_at(row)
        raw_turns = pricing.turns(row.get("transcript_text"))
        # Skip voicemails and one-sided calls: the customer has to have said something.
        customer_turns = [t for s, t in raw_turns if s == "external"]
        if (not when or sum(len(t.split()) for t in customer_turns) < 20 or (row.get("voicemail_detected") or "").upper() == "TRUE"
                or (len(customer_turns) <= 4 and _VOICEMAIL.search(" ".join(customer_turns)))):
            continue
        seen.add(row.get("call_id"))
        turns = merged(raw_turns)
        seg = segments(raw_turns)
        customer = " ".join(t for s, t in raw_turns if s == "external")
        rep = " ".join(t for s, t in raw_turns if s == "internal")
        head = headline(row)
        issue, more = service.classify_issue(head, customer, rep)
        try:
            duration = int(float(row.get("duration_sec") or 0))
        except ValueError:
            duration = 0
        opening = service.mood(seg.get(("external", "open"), ""))
        closing = service.mood(seg.get(("external", "close"), ""))
        result = service.outcome(seg.get(("internal", "wrap"), ""), seg.get(("external", "wrap"), ""), closing)
        text = f"{head} {customer} {rep}"
        agent = (row.get("agent") or "").strip() or "Unassigned"
        calls.append({
            "id": row.get("call_id"),
            "d": when.strftime("%Y-%m-%d"),
            "h": when.strftime("%H:%M"),
            "a": agent_ix[agent],
            "dir": "O" if (row.get("direction") or "").lower().startswith("out") else "I",
            "dur": duration,
            "iss": issue,
            "iss2": more,
            "cat": taxonomy.product_categories(row.get("products_category_general"), head, f"{customer} {rep} {row.get('products_mentioned_specific') or ''}"),
            "mdl": service.models(text),
            "cmp": service.components(f"{head} {customer}"),
            "res": result,
            "sol": service.solutions(rep),
            "ts": first_solution_at(raw_turns, duration),
            "mo": opening,
            "mc": closing,
            "sat": SATISFACTION.get(row.get("customer_satisfaction_apparent")),
            "sup": 1 if _SUPPLIER.search(f"{customer[:600]} {rep[:600]}") else 0,
            "sum": scrub(head, 200),
            "fix": fix_line(turns, issue),
            "cq": best_line(turns, "external", ISSUE_RX.get(issue, []), 200),
        })
    calls.sort(key=lambda c: (c["d"], c["h"]))
    return agents, calls


# --- Playbook: the all-time "brain" seed -----------------------------------------------

def _rate(n, d):
    return round(n / d, 3) if d else None


def playbook(agents, calls, owners, tickets):
    by_issue = defaultdict(list)
    for c in calls:
        by_issue[c["iss"]].append(c)
    t_issue = defaultdict(list)
    for t in tickets:
        t_issue[t["iss"]].append(t)
    out = []
    for issue in service.ISSUE_LABELS + [service.OTHER_ISSUE]:
        cs, ts = by_issue.get(issue, []), t_issue.get(issue, [])
        if not cs and not ts:
            continue
        cust = [c for c in cs if not c["sup"]]  # mood is about customers, not couriers or suppliers
        upset = [c for c in cust if c["mo"] < 0]
        sols = []
        for label in service.SOLUTION_LABELS:
            used = [c for c in cs if label in c["sol"]]
            if len(used) < 5:
                continue
            up = [c for c in used if c["mo"] < 0 and not c["sup"]]
            mood_base = [c for c in used if not c["sup"]]
            sols.append({"solution": label, "calls": len(used), "resolvedOnCall": _rate(sum(c["res"] == "R" for c in used), len(used)),
                         "resolvedOrBooked": _rate(sum(c["res"] in "RF" for c in used), len(used)),
                         "upsetTurnedAround": _rate(sum(c["mc"] >= 0 for c in up), len(up)),
                         "endedPositive": _rate(sum(c["mc"] > 0 for c in mood_base), len(mood_base))})
        # Rank by how the customer ended the call: booking-type approaches are "booked" by definition.
        sols.sort(key=lambda s: -(s["endedPositive"] or 0))
        fixes = []
        for c in sorted(cs, key=lambda c: (c["res"] != "R", -c["mc"], -len(c["fix"]))):
            if c["fix"] and c["res"] in "RF" and c["mc"] >= 0 and not c["sup"] and c["fix"] not in fixes:
                fixes.append(c["fix"])
            if len(fixes) >= 6:
                break
        people = []
        for a, group in Counter(c["a"] for c in cs).most_common():
            mine = [c for c in cs if c["a"] == a]
            if len(mine) >= 8 and agents[a] != "Unassigned":
                people.append({"name": agents[a], "calls": len(mine), "resolvedOnCall": _rate(sum(c["res"] == "R" for c in mine), len(mine)),
                               "resolvedOrBooked": _rate(sum(c["res"] in "RF" for c in mine), len(mine))})
        people.sort(key=lambda p: -(p["resolvedOrBooked"] or 0))
        closed = [t for t in ts if not t["o"] and t["ttc"] is not None]
        owners_closed = defaultdict(list)
        for t in closed:
            owners_closed[t["ow"]].append(t["ttc"])
        fastest = sorted(((median(v), owners[o], len(v)) for o, v in owners_closed.items() if len(v) >= 5))
        out.append({
            "issue": issue,
            "calls": len(cs),
            "tickets": len(ts),
            "products": Counter(cat for c in cs + ts for cat in c["cat"]).most_common(),
            "models": Counter(m for c in cs + ts for m in c["mdl"]).most_common(6),
            "components": Counter(m for c in cs + ts for m in c["cmp"]).most_common(6),
            "callOutcomes": {k: _rate(sum(c["res"] == k for c in cs), len(cs)) for k in service.OUTCOMES},
            "upsetCallers": len(upset),
            "upsetTurnedAround": _rate(sum(c["mc"] >= 0 for c in upset), len(upset)),
            "solutions": sols,
            "exampleFixes": fixes,
            "howCustomersDescribeIt": list(dict.fromkeys(c["cq"] for c in cust if c["cq"]))[:5],
            "bestOnCalls": people[:3],
            "ticketMedianDaysToClose": round(median(t["ttc"] for t in closed) / 24, 1) if closed else None,
            "fastestTicketOwners": [{"name": n, "medianDaysToClose": round(h / 24, 1), "closed": k} for h, n, k in fastest[:3]],
        })
    out.sort(key=lambda p: -(p["calls"] + p["tickets"]))
    return out


def load_tickets(raw_path):
    token = os.environ.get("HUBSPOT_TOKEN")
    raw, owners = None, None
    if raw_path:
        raw = [json.loads(line) for line in open(raw_path, encoding="utf-8") if line.strip()]
        owners = json.loads(Path(raw_path).with_suffix(".owners.json").read_text(encoding="utf-8"))
    elif token:
        try:
            raw, owners = hubspot.fetch(token)
        except Exception as exc:  # keep the call side refreshing if HubSpot is down
            print(f"HubSpot fetch failed ({type(exc).__name__}); keeping the last ticket snapshot")
    if raw is not None:
        snap = hubspot.derive(raw, owners, taxonomy.product_categories)
        snap["pulled"] = datetime.now(sales.BRISBANE).strftime("%Y-%m-%d %H:%M")
        if len(snap["tickets"]) >= 500:
            SNAPSHOT.write_text(json.dumps(snap, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        return snap
    if SNAPSHOT.exists():
        return json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    return {"owners": [], "tickets": [], "pulled": ""}


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--csv", help="local CSV export of the call sheet (default: download it)")
    parser.add_argument("--tickets-raw", help="local raw ticket export, one {id, properties} per line, with a matching .owners.json")
    args = parser.parse_args()

    rows = sales.load_rows(args.csv)
    agents, calls = build_calls(rows)
    if len(calls) < 500:
        sys.exit(f"Only {len(calls)} service calls found in {len(rows)} rows; refusing to overwrite the dashboard data.")
    snap = load_tickets(args.tickets_raw)

    data = {
        "generated": datetime.now(sales.BRISBANE).strftime("%Y-%m-%d %H:%M"),
        "ticketsPulled": snap.get("pulled", ""),
        "agents": agents,
        "owners": snap["owners"],
        "issues": service.ISSUE_LABELS + [service.OTHER_ISSUE],
        "adminIssue": service.ADMIN_NOTICE,
        "solutions": service.SOLUTION_LABELS,
        "components": service.COMPONENT_LABELS,
        "outcomes": service.OUTCOMES,
        "productCategories": taxonomy.PRODUCT_CATEGORIES,
        "pipelines": {k: v for k, v in hubspot.PIPELINES.values()},
        "calls": calls,
        "tickets": snap["tickets"],
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    (OUT_DIR / "data.js").write_text(f"window.REVEL_SERVICE={payload};\n", encoding="utf-8")
    book = {"generated": data["generated"], "about": "Revel after-sales issues with what fixed them, from Aircall service calls and HubSpot Desk tickets. "
                                                     "Rates are shares of calls. resolvedOnCall: fixed or answered on the call; resolvedOrBooked: that or a next step "
                                                     "booked; endedPositive: the customer sounded positive at the end; upsetTurnedAround: of callers who opened upset, "
                                                     "the share who ended no longer upset. Solutions are ranked by endedPositive.",
            "issues": playbook(agents, calls, snap["owners"], [t for t in snap["tickets"] if t["iss"] != service.ADMIN_NOTICE])}
    (OUT_DIR / "playbook.json").write_text(json.dumps(book, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Rows read: {len(rows)}; service calls: {len(calls)} ({calls[0]['d']} to {calls[-1]['d']}); "
          f"tickets: {len(snap['tickets'])}; wrote revel-service-insights/data.js ({len(payload) / 1e6:.1f} MB) and playbook.json")


if __name__ == "__main__":
    main()
