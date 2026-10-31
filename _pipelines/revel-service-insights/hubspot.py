"""HubSpot Desk tickets for the Revel service dashboard.

Reads the three Revel ticket pipelines (Customer Service, Warranty, Forms) through
the CRM search API and turns each ticket into a row with no customer details:
pipeline, stage, owner, dates, response and close times, and the issue,
product, models and components read from the subject, claim form and first email.

Customer Service tickets with no owner are left out: almost all of them are
automated mail (payouts, remittances, newsletters, spam) that nobody works.

Needs a private app token with the `tickets` scope (and `crm.objects.owners.read`
for names) in HUBSPOT_TOKEN. Without it, build.py keeps the last snapshot.
"""
import json
import os
import re
import urllib.request
from datetime import datetime, timedelta, timezone

import service

API = "https://api.hubapi.com"
BRISBANE = timezone(timedelta(hours=10))

PIPELINES = {
    "2729912521": ("C", "Customer Service"),
    "2704947438": ("W", "Warranty"),
    "3452743907": ("F", "Forms"),
}
STAGES = {
    # Revel | Customer Service
    "3731188952": "New enquiry", "3731188954": "Waiting on us", "3731188953": "Waiting on them", "5056707829": "Under review",
    "5057194228": "Courier follow up", "3727853805": "Escalated", "3731188955": "Complete",
    # Revel | Warranty
    "3731028154": "New claim", "4734760177": "Waiting on us", "4734760178": "Waiting on them", "3731028162": "Under review",
    "3731028164": "With technician", "5056713974": "Communicating with factory", "3731028163": "Confirming parts availability",
    "6158081248": "Parts ordered from factory", "5055704253": "Escalated", "3731028165": "Complete",
    # Revel Forms
    "4724876485": "New", "4724876486": "Waiting on contact", "4724876487": "Waiting on us", "4724876488": "Closed",
}
CLOSED_STAGES = {"3731188955", "3731028165", "4724876488"}
SOURCES = {"EMAIL": "Email", "FORM": "Form", "PHONE": "Phone", "CHAT": "Chat", "SMS": "SMS"}

PROPERTIES = [
    "subject", "content", "hs_pipeline", "hs_pipeline_stage", "hubspot_owner_id", "createdate", "closed_date", "time_to_close",
    "time_to_first_agent_reply", "hs_is_one_touch_ticket", "source_type", "num_notes", "hs_num_times_contacted", "warranty_claim",
    "hs_ticket_priority", "product_description", "how_did_the_problem_occur_",
]
SEARCHES = [
    [{"propertyName": "hs_pipeline", "operator": "EQ", "value": "2729912521"}, {"propertyName": "hubspot_owner_id", "operator": "HAS_PROPERTY"}],
    [{"propertyName": "hs_pipeline", "operator": "EQ", "value": "2704947438"}],
    [{"propertyName": "hs_pipeline", "operator": "EQ", "value": "3452743907"}],
]


def _call(path, token, body=None):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body else None, method="POST" if body else "GET",
                                 headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch(token):
    """Raw tickets ({id, properties}) and an owner id -> name map."""
    tickets = []
    for filters in SEARCHES:
        # The search API stops at 10,000 results per query, so page by create date.
        since = "0"
        while True:
            body = {"filterGroups": [{"filters": filters + [{"propertyName": "createdate", "operator": "GT", "value": since}]}],
                    "sorts": [{"propertyName": "createdate", "direction": "ASCENDING"}], "properties": PROPERTIES, "limit": 200}
            after, got = None, []
            while True:
                if after:
                    body["after"] = after
                page = _call("/crm/v3/objects/tickets/search", token, body)
                got += page.get("results", [])
                after = page.get("paging", {}).get("next", {}).get("after")
                if not after or len(got) >= 9800:
                    break
            tickets += got
            if len(got) < 9800:
                break
            since = str(int(datetime.fromisoformat(got[-1]["properties"]["createdate"].replace("Z", "+00:00")).timestamp() * 1000))
    owners, after = {}, None
    while True:
        page = _call("/crm/v3/owners?limit=500" + (f"&after={after}" if after else ""), token)
        for o in page.get("results", []):
            owners[str(o["id"])] = f"{o.get('firstName') or ''} {o.get('lastName') or ''}".strip()
        after = page.get("paging", {}).get("next", {}).get("after")
        if not after:
            break
    print(f"HubSpot: {len(tickets)} tickets, {len(owners)} owners")
    seen, unique = set(), []
    for t in tickets:
        if t["id"] not in seen:
            seen.add(t["id"])
            unique.append(t)
    return unique, owners


def _when(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(BRISBANE)
    except ValueError:
        return None


def _hours(ms):
    try:
        return round(int(float(ms)) / 3.6e6, 1)
    except (TypeError, ValueError):
        return None


def _int(v):
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return 0


_ORDER_NO = re.compile(r"\b(?:SO|PO|INV)?\d{5,}\b", re.I)


def derive(raw, owners, product_categories):
    """Dashboard rows (no customer details) from raw tickets."""
    owner_names = sorted({(owners.get(str(t["properties"].get("hubspot_owner_id") or "")) or "Unassigned").strip() or "Unassigned"
                          for t in raw})
    owner_ix = {n: i for i, n in enumerate(owner_names)}
    rows = []
    for t in raw:
        p = t["properties"]
        pipe = PIPELINES.get(p.get("hs_pipeline"))
        created = _when(p.get("createdate"))
        if not pipe or not created:
            continue
        subject = p.get("subject") or ""
        headline = _ORDER_NO.sub(" ", f"{subject} {p.get('how_did_the_problem_occur_') or ''} {p.get('product_description') or ''}")
        body = re.sub(r"\s+", " ", p.get("content") or "")[:1500]
        if service.is_notice(subject):
            issue, more = service.ADMIN_NOTICE, []
        else:
            issue, more = service.classify_issue(headline, body)
        text = f"{headline} {body}"
        closed = _when(p.get("closed_date"))
        stage = p.get("hs_pipeline_stage") or ""
        owner = (owners.get(str(p.get("hubspot_owner_id") or "")) or "Unassigned").strip() or "Unassigned"
        one_touch = p.get("hs_is_one_touch_ticket")
        warranty = p.get("warranty_claim")
        rows.append({
            "id": str(t["id"]),
            "p": pipe[0],
            "st": STAGES.get(stage, "Other"),
            "o": 0 if stage in CLOSED_STAGES else 1,
            "ow": owner_ix[owner],
            "d": created.strftime("%Y-%m-%d"),
            "cd": closed.strftime("%Y-%m-%d") if closed and stage in CLOSED_STAGES else "",
            "ttc": _hours(p.get("time_to_close")) if stage in CLOSED_STAGES else None,
            "tfr": _hours(p.get("time_to_first_agent_reply")),
            "ot": {"true": 1, "false": 0}.get(one_touch),
            "src": SOURCES.get(p.get("source_type") or "", ""),
            "nn": _int(p.get("num_notes")),
            "nc": _int(p.get("hs_num_times_contacted")),
            "wc": {"Yes": 1, "No": 0}.get(warranty),
            "iss": issue,
            "iss2": more,
            "cat": product_categories("", headline, body),
            "mdl": service.models(text),
            "cmp": service.components(text) if issue != service.ADMIN_NOTICE else [],
        })
    rows.sort(key=lambda r: (r["d"], r["id"]))
    return {"owners": owner_names, "tickets": rows}
