#!/usr/bin/env python3
"""Revel Wellness Brain: checks and housekeeping.

    python3 scripts/brain.py validate [--base origin/main] [--md report.md]
    python3 scripts/brain.py conflicts [--md report.md]
    python3 scripts/brain.py index                       # rewrite INDEX.md
    python3 scripts/brain.py stamp --pr 12 --date 2026-11-20 --approvers "Tristan Krutz,Ben Coleman" FILE...
    python3 scripts/brain.py due [--days 30] [--md out.md]
    python3 scripts/brain.py approvals --reviews reviews.json --head SHA
    python3 scripts/brain.py digest --prs prs.json --issues issues.json [--md out.md]
    python3 scripts/brain.py checklist                   # approver checklist for PR bodies

validate and conflicts exit 1 when they find an error, so CI blocks the merge.
Warnings are reported but never block.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from brainlib import (APPROVAL_KEYS, ROOT, Card, add_months, load_cards, load_config,  # noqa: E402
                      parse_card_text, today, write_card)

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class Report:
    def __init__(self, title: str):
        self.title = title
        self.errors: list[tuple[str, str]] = []
        self.warnings: list[tuple[str, str]] = []

    def error(self, where, msg):
        self.errors.append((where, msg))

    def warn(self, where, msg):
        self.warnings.append((where, msg))

    def markdown(self) -> str:
        out = [f"### {self.title}", ""]
        if not self.errors and not self.warnings:
            out.append("All clear.")
        if self.errors:
            out += [f"**{len(self.errors)} to fix before merge**", ""]
            out += [f"- `{w}`: {m}" for w, m in self.errors] + [""]
        if self.warnings:
            out += [f"**{len(self.warnings)} for the approvers to look at**", ""]
            out += [f"- `{w}`: {m}" for w, m in self.warnings] + [""]
        return "\n".join(out) + "\n"

    def emit(self, md_path: str | None):
        text = self.markdown()
        print(text)
        if md_path:
            Path(md_path).write_text(text, encoding="utf-8")
        return 1 if self.errors else 0


# ------------------------------------------------------------------ validate

def labels(cfg, key):
    return set(cfg[key].values()) if isinstance(cfg[key], dict) else set(cfg[key])


def validate_card(c: Card, cfg: dict, rep: Report):
    m, w = c.meta, c.rel
    for k in ("id", "title", "topic", "markets", "audience", "source", "status",
              "approved_by", "approved_on", "review_by"):
        if k not in m:
            rep.error(w, f"missing `{k}`")
    if m.get("id") != c.expected_id:
        rep.error(w, f"`id` must be `{c.expected_id}` (its path), not `{m.get('id')}`")
    if m.get("topic") not in labels(cfg, "topics"):
        rep.error(w, f"topic `{m.get('topic')}` is not one of {sorted(labels(cfg, 'topics'))}")
    bad = set(m.get("markets") or []) - set(cfg["markets"])
    if not m.get("markets") or bad:
        rep.error(w, f"markets must be a list from {cfg['markets']}")
    if m.get("status") not in cfg["statuses"]:
        rep.error(w, f"status `{m.get('status')}` is not one of {cfg['statuses']}")
    if m.get("audience") not in cfg["audiences"]:
        rep.error(w, f"audience must be one of {cfg['audiences']}")
    if c.folder == "internal" and m.get("audience") != "internal":
        rep.error(w, "cards in internal/ must be `audience: internal`")
    src = m.get("source")
    if not isinstance(src, list) or not src or not all(isinstance(s, dict) and s.get("type") and s.get("ref") for s in src):
        rep.error(w, "`source` must list at least one {type, ref}")
    for k in ("approved_on", "review_by"):
        v = m.get(k)
        if v is not None and not DATE_RE.match(str(v)):
            rep.error(w, f"`{k}` must be YYYY-MM-DD")
    if m.get("status") in ("Live", "Retired") and m.get("approved_on") and not m.get("approved_by"):
        rep.error(w, "approved but `approved_by` is empty")
    if m.get("status") == "Draft":
        rep.warn(w, "status is Draft: it won't go live. Set `In review` when it's ready for approval.")
    if c.folder == "cards":
        parts = c.rel.split("/")
        if len(parts) != 4:
            rep.error(w, "product cards live at cards/<category>/<product>/<topic>.md")
        else:
            cat_slug, topic_slug = parts[1], parts[3][:-3]
            if cat_slug not in cfg["categories"]:
                rep.error(w, f"unknown category folder `{cat_slug}`")
            elif m.get("category") != cfg["categories"][cat_slug]:
                rep.error(w, f"category must be `{cfg['categories'][cat_slug]}` for folder `{cat_slug}`")
            if topic_slug not in cfg["topics"]:
                rep.error(w, f"file name must be a topic: {list(cfg['topics'])}")
            elif m.get("topic") != cfg["topics"][topic_slug]:
                rep.error(w, f"topic must be `{cfg['topics'][topic_slug]}` for file `{topic_slug}.md`")
        if not m.get("product"):
            rep.error(w, "missing `product`")
        if not isinstance(m.get("skus"), list):
            rep.error(w, "`skus` must be a list")
    if not re.search(r"^# ", c.body, re.M):
        rep.error(w, "body needs a `# Title` line")
    if not re.search(r"^## Sources", c.body, re.M):
        rep.error(w, "body needs a `## Sources` section")


def git(*args) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, check=True).stdout


def changed_files(base: str) -> list[str]:
    out = git("diff", "--name-only", "--relative", "--diff-filter=ACMR", f"{base}...HEAD")
    return [l for l in out.splitlines() if l.endswith(".md")]


def base_meta(base: str, rel: str):
    try:
        text = git("show", f"{base}:./{rel}")
    except subprocess.CalledProcessError:
        return None
    try:
        return parse_card_text(text)[0]
    except ValueError:
        return None


def cmd_validate(args) -> int:
    cfg = load_config()
    rep = Report("Card checks")
    cards, bad = load_cards()
    for where, msg in bad:
        rep.error(where, msg)
    ids = defaultdict(list)
    for c in cards:
        validate_card(c, cfg, rep)
        ids[c.get("id")].append(c.rel)
    for i, paths in ids.items():
        if len(paths) > 1:
            rep.error(", ".join(paths), f"duplicate id `{i}`")
    if args.base:
        # Pull request rules: approvals are written only by the stamp workflow after merge.
        by_rel = {c.rel: c for c in cards}
        for rel in changed_files(args.base):
            c = by_rel.get(rel)
            if not c:
                continue
            old = base_meta(args.base, rel)
            if old is None:
                if c.get("approved_by") or c.get("approved_on") or c.get("approval_pr"):
                    rep.error(rel, "new card: leave approved_by/approved_on/approval_pr empty, the stamp fills them")
            else:
                for k in APPROVAL_KEYS:
                    if (old.get(k) or None) != (c.get(k) or None):
                        rep.error(rel, f"`{k}` changed. Only the stamp workflow changes approval fields")
            if c.get("status") == "Live":
                rep.error(rel, "a changed card must be `In review` (or `Retired`). The stamp sets Live after both approvals")
    return rep.emit(args.md)


# ------------------------------------------------------------------ conflicts

FACT_RE = re.compile(r"^- \*\*(.+?):\*\* (.+)$", re.M)
LINK_RE = re.compile(r"\]\((/[^)\s]+\.md)\)")


def facts(c: Card) -> dict:
    return {k.strip().lower(): v.strip() for k, v in FACT_RE.findall(c.body)}


def word_hit(text: str, term: str) -> bool:
    return re.search(r"(?<![A-Za-z])" + re.escape(term) + r"(?![A-Za-z])", text, re.I) is not None


def cmd_conflicts(args) -> int:
    cfg = load_config()
    rep = Report("Conflict checks")
    cards, _ = load_cards()
    by_id = {c.get("id"): c for c in cards}
    today_s = today(cfg.get("timezone", "Australia/Brisbane"))

    # 1. A SKU must belong to one product (bundles and shared cards excepted).
    sku_owner = defaultdict(set)
    for c in cards:
        if c.folder == "cards" and "/bundles/" not in c.rel:
            for s in c.get("skus") or []:
                sku_owner[str(s).upper()].add("/".join(c.rel.split("/")[:3]))
    for sku, owners in sku_owner.items():
        if len(owners) > 1:
            rep.error(sku, f"SKU is on more than one product: {', '.join(sorted(owners))}")

    # 2. Same product, same fact, different value across its cards (e.g. two circuit ratings).
    by_product = defaultdict(list)
    for c in cards:
        if c.folder == "cards":
            by_product["/".join(c.rel.split("/")[:3])].append(c)
    watch = ("socket", "power", "voltage", "capacity", "product weight", "max temp", "temperature range")
    for prod, cs in by_product.items():
        seen = defaultdict(dict)
        for c in cs:
            for k, v in facts(c).items():
                if k in watch:
                    seen[k][c.rel] = v
        for k, vals in seen.items():
            if len(set(vals.values())) > 1:
                rep.error(prod, f"`{k}` differs between cards: " + "; ".join(f"{p.split('/')[-1]} `{v}`" for p, v in vals.items()))

    # 3. Heater tables on sauna cards must match the heater's own card.
    heater_socket = {}
    for c in cards:
        if "/heaters-controls/" in c.rel and c.rel.endswith("/electrical.md"):
            sock = facts(c).get("socket")
            if sock:
                heater_socket[(c.get("title") or "").split(" · ")[0]] = sock
    for c in cards:
        for row in re.findall(r"^\| `[^`]+` \| ([^|]+?) \| [^|]+ \| ([^|]+?) \|", c.body, re.M):
            name, circuit = row[0].strip(), row[1].strip()
            if name in heater_socket and heater_socket[name] != circuit:
                rep.error(c.rel, f"heater table says {name} needs `{circuit}`; its heater card says `{heater_socket[name]}`")

    # 4. Links between cards should resolve. A warning, not an error: a link can point at a card
    #    that's in another pull request (merge that one first).
    for c in cards:
        for link in LINK_RE.findall(c.body):
            if not (ROOT / link.lstrip("/")).exists():
                rep.warn(c.rel, f"links to `{link}`, which isn't in the Brain yet (merge the PR that adds it first)")
        for a in c.get("applies_to") or []:
            if not (ROOT / f"{a}").exists() and not (ROOT / f"{a}.md").exists():
                rep.warn(c.rel, f"`applies_to` names `{a}`, which isn't in the Brain yet")

    # 5. Customer-facing cards: no internal-only terms; health claims need Ben.
    for c in cards:
        if c.get("audience") != "customer":
            continue
        text = c.body
        for t in cfg.get("internal_terms", []):
            if word_hit(text, t):
                rep.error(c.rel, f"customer card mentions `{t}`. Move that detail to internal/")
        hits = [t for t in cfg.get("claim_terms", []) if word_hit(text, t)]
        if hits:
            rep.warn(c.rel, f"health or performance wording for Ben to check: {', '.join(hits)}")

    # 6. Housekeeping.
    for c in cards:
        rb = c.get("review_by")
        if c.get("status") == "Live" and rb and str(rb) < today_s:
            rep.warn(c.rel, f"past its review date ({rb})")
        if c.get("status") == "In review" and not args.allow_in_review:
            rep.warn(c.rel, "still `In review` on this branch")
    return rep.emit(args.md)


# ------------------------------------------------------------------ index

def cmd_index(args) -> int:
    cfg = load_config()
    cards, _ = load_cards()
    status_count = defaultdict(int)
    for c in cards:
        status_count[c.get("status")] += 1
    lines = [
        "# Revel Wellness Brain · Index", "",
        "_Generated by `scripts/brain.py index` after every approved merge. Don't edit by hand._", "",
        "How to use: find the product (or SKU) below, open the topic card, answer only from it, and cite "
        "the card id and its approval date. Only **Live** cards are approved. **Retired** cards are for "
        "past buyers (label the answer as legacy). Ignore anything else.", "",
        "**Cards:** " + ", ".join(f"{s} {n}" for s, n in sorted(status_count.items())), "",
    ]
    products = defaultdict(dict)
    meta_prod = {}
    for c in cards:
        if c.folder == "cards":
            key = "/".join(c.rel.split("/")[:3])
            products[key][c.rel.split("/")[3][:-3]] = c
            meta_prod[key] = c
    topics = list(cfg["topics"])
    for cat, label in cfg["categories"].items():
        keys = sorted(k for k in products if k.split("/")[1] == cat)
        if not keys:
            continue
        lines += [f"## {label}", "", "| Product | Cards (status, approved) |", "|---|---|"]
        for k in keys:
            c0 = meta_prod[k]
            cells = []
            for t in topics:
                c = products[k].get(t)
                if c:
                    appr = c.get("approved_on") or "not yet"
                    cells.append(f"[{t}](/{c.rel}) ({c.get('status')}, {appr})")
            lines.append(f"| {c0.get('product')} | {' · '.join(cells)} |")
        lines.append("")
    for folder, title in (("compliance", "Compliance (shared)"), ("policies", "Policies"), ("faq", "FAQ"),
                          ("internal", "Internal only (never paste into customer replies)")):
        cs = [c for c in cards if c.folder == folder]
        if cs:
            lines += [f"## {title}", ""]
            lines += [f"- [{c.get('title')}](/{c.rel}) ({c.get('status')}, {c.get('approved_on') or 'not yet'})" for c in cs]
            lines.append("")
    lines += ["## SKU lookup", "", "| SKU | Product folder |", "|---|---|"]
    rows = set()
    for k, c in meta_prod.items():
        for s in c.get("skus") or []:
            rows.add((str(s), k))
    lines += [f"| `{s}` | [{k.split('/')[-1]}](/{k}/) |" for s, k in sorted(rows)]
    out = Path(args.out or ROOT / "INDEX.md")
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {out} ({len(cards)} cards)")
    return 0


# ------------------------------------------------------------------ stamp

def cmd_stamp(args) -> int:
    cfg = load_config()
    approvers = [a.strip() for a in args.approvers.split(",") if a.strip()]
    if not approvers:
        print("no approvers given", file=sys.stderr)
        return 1
    n = 0
    for f in args.files:
        p = (ROOT / f).resolve()
        if not p.exists() or p.suffix != ".md" or p.name.upper() == "README.MD":
            continue
        rel = p.relative_to(ROOT).as_posix()
        if rel.split("/", 1)[0] not in ("cards", "compliance", "policies", "faq", "internal"):
            continue
        meta, body = parse_card_text(p.read_text(encoding="utf-8"))
        if meta.get("status") in ("In review", "Draft", "Live", None):
            meta["status"] = "Live"
        meta["approved_by"] = approvers
        meta["approved_on"] = args.date
        meta["approval_pr"] = args.pr
        months = int(meta.get("review_months") or cfg["review"]["default_months"])
        meta["review_by"] = add_months(args.date, months)
        write_card(p, meta, body)
        n += 1
        print(f"stamped {rel}: {meta['status']}, review by {meta['review_by']}")
    print(f"{n} card(s) stamped")
    return 0


# ------------------------------------------------------------------ due

def due_cards(cfg, days: int):
    cards, _ = load_cards()
    t = dt.date.fromisoformat(today(cfg.get("timezone", "Australia/Brisbane")))
    horizon = (t + dt.timedelta(days=days)).isoformat()
    out = []
    for c in cards:
        rb = c.get("review_by")
        if c.get("status") == "Live" and rb and str(rb) <= horizon:
            out.append((str(rb), c))
    return sorted(out, key=lambda x: x[0])


def cmd_due(args) -> int:
    cfg = load_config()
    items = due_cards(cfg, args.days)
    lines = []
    for rb, c in items:
        lines.append(f"- [ ] `{c.rel}`: review by {rb} (approved {c.get('approved_on')}, PR #{c.get('approval_pr')})")
    text = "\n".join(lines) + ("\n" if lines else "")
    print(text or "Nothing due.")
    if args.md:
        Path(args.md).write_text(text, encoding="utf-8")
    if args.json:
        Path(args.json).write_text(json.dumps([c.rel for _, c in items]), encoding="utf-8")
    return 0


# ------------------------------------------------------------------ approvals

def cmd_approvals(args) -> int:
    """Both named approvers must have APPROVED the current head commit."""
    cfg = load_config()
    reviews = json.loads(Path(args.reviews).read_text())
    latest = {}
    for r in sorted(reviews, key=lambda r: r.get("submitted_at") or ""):
        login = (r.get("user") or {}).get("login", "").lower()
        if r.get("state") in ("APPROVED", "CHANGES_REQUESTED", "DISMISSED"):
            latest[login] = r
    missing, done = [], []
    for a in cfg["approvers"]:
        r = latest.get(str(a["github"]).lower())
        if r and r.get("state") == "APPROVED" and r.get("commit_id") == args.head:
            done.append(a["name"])
        else:
            missing.append(a["name"])
    result = {"ok": not missing, "approved": done, "missing": missing,
              "description": ("Approved by " + " and ".join(done)) if not missing
              else ("Waiting for " + " and ".join(missing))}
    print(json.dumps(result))
    return 0


# ------------------------------------------------------------------ digest

def business_days(start: dt.date, end: dt.date) -> int:
    d, n = start, 0
    while d < end:
        d += dt.timedelta(days=1)
        if d.weekday() < 5:
            n += 1
    return n


def cmd_digest(args) -> int:
    cfg = load_config()
    t = dt.date.fromisoformat(today(cfg.get("timezone", "Australia/Brisbane")))
    sla = cfg["review"]["approval_sla_business_days"]
    prs = json.loads(Path(args.prs).read_text()) if args.prs else []
    issues = json.loads(Path(args.issues).read_text()) if args.issues else []
    lines = [f"## Brain weekly digest · {t.strftime('%-d %b %Y')}", ""]
    if prs:
        lines += [f"### Waiting for approval ({len(prs)})", "",
                  "| PR | Waiting | Labels |", "|---|---|---|"]
        for pr in sorted(prs, key=lambda p: p["createdAt"]):
            opened = dt.date.fromisoformat(pr["createdAt"][:10])
            bd = business_days(opened, t)
            late = " ⚠️ over SLA" if bd > sla else ""
            labs = ", ".join(l["name"] for l in pr.get("labels", []))
            lines.append(f"| [#{pr['number']} {pr['title']}]({pr['url']}) | {bd} business days{late} | {labs} |")
        lines.append("")
    else:
        lines += ["### Waiting for approval", "", "Nothing waiting.", ""]
    stuck = [i for i in issues if not any(l["name"] == "drafted" for l in i.get("labels", []))]
    if stuck:
        lines += [f"### Inbox items not drafted yet ({len(stuck)})", ""]
        lines += [f"- [#{i['number']} {i['title']}]({i['url']})" for i in stuck] + [""]
    due = due_cards(cfg, cfg["review"]["warn_days"])
    if due:
        lines += [f"### Cards due for review in the next {cfg['review']['warn_days']} days ({len(due)})", ""]
        lines += [f"- `{c.rel}` by {rb}" for rb, c in due[:50]] + [""]
    lines += [f"_SLA: approve or reject within {sla} business days._"]
    text = "\n".join(lines) + "\n"
    print(text)
    if args.md:
        Path(args.md).write_text(text, encoding="utf-8")
    return 0


def cmd_checklist(args) -> int:
    cfg = load_config()
    print("### Approver checklist\n")
    for a in cfg["approvers"]:
        print(f"**{a['name']}**")
        print("\n".join(f"- [ ] {c}" for c in a["checks"]))
        print()
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    v = sub.add_parser("validate")
    v.add_argument("--base", help="git ref of main; turns on the pull-request rules")
    v.add_argument("--md")
    c = sub.add_parser("conflicts")
    c.add_argument("--md")
    c.add_argument("--allow-in-review", action="store_true", help="don't warn about In review cards (PR branches)")
    i = sub.add_parser("index")
    i.add_argument("--out")
    s = sub.add_parser("stamp")
    s.add_argument("--pr", type=int, required=True)
    s.add_argument("--date", required=True)
    s.add_argument("--approvers", required=True)
    s.add_argument("files", nargs="*")
    d = sub.add_parser("due")
    d.add_argument("--days", type=int, default=30)
    d.add_argument("--md")
    d.add_argument("--json")
    a = sub.add_parser("approvals")
    a.add_argument("--reviews", required=True)
    a.add_argument("--head", required=True)
    g = sub.add_parser("digest")
    g.add_argument("--prs")
    g.add_argument("--issues")
    g.add_argument("--md")
    sub.add_parser("checklist")
    args = ap.parse_args()
    return {"checklist": cmd_checklist, "validate": cmd_validate, "conflicts": cmd_conflicts, "index": cmd_index, "stamp": cmd_stamp,
            "due": cmd_due, "approvals": cmd_approvals, "digest": cmd_digest}[args.cmd](args)


if __name__ == "__main__":
    sys.exit(main())
