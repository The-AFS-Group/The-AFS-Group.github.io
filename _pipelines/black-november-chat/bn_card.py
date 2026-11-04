#!/usr/bin/env python3
"""Black November daily post, branded Google Chat card (GAF or Revel).

Usage: python3 -I bn_card.py INPUT.json --brand GAF|REVEL [--test] [--as-day N] [--out card.json] [--post]
Without --post it only writes the card JSON. With --post it sends it to $BLACK_NOVEMBER_CHAT_WEBHOOK (GAF)
or $BLACK_NOVEMBER_REVEL_CHAT_WEBHOOK (Revel).
"""
import csv, io, json, os, re, subprocess, sys, datetime as dt

HERE = os.path.dirname(os.path.abspath(__file__))
GAF_MAIN = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT72MxE6-ziV7qfKCkHXatwJC47qjSAm0Fv0553yd09v3b0fLo-9QI3VZ-ehF_qjpaDNdd9jrYwDbU6/pub?gid=0&single=true&output=csv"

WS = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSthi8lBLdL3UAlIoFhcMMkaKctY5iy-_O4Im0wHA91zS9l4yEBp9pQHPh0wP8qdhs-pBsERh8rQBWA/pub"
WS_ACT = WS + "?gid=1261715133&single=true&output=csv"
WS_BUD = WS + "?gid=555000001&single=true&output=csv"

GAF_TARGETS = [24253, 42581, 26761, 22766, 16313, 31025, 22313, 13989, 19393, 35990,
               32216, 22498, 17758, 22579, 9752, 42948, 41199, 29228, 42303, 45582,
               17844, 18214, 26457, 26218, 38193, 33067, 52238, 21292, 31596, 60855]
GAF_TARGETS[-1] += 887420 - sum(GAF_TARGETS)

# Revel Nov 2026 weighted targets (total $905,255): Nov 2025 Revel created GP (NetSuite searches 6212 + 6236),
# aligned by weekday (Fri 27 Nov 2026 <-> Fri 28 Nov 2025), scaled to the sheet's $30,175.17/day budget x 30.
REVEL_TARGETS = [
    18600, 22572, 15660, 35722, 34727, 33483, 14041, 11446, 31523, 16877,
    15208, 43401, 40244, 25051, 20339, 23519, 32667, 16008, 22335, 32184,
    20100, 26624, 19517, 54345, 28960, 32179, 59069, 63178, 46731, 48945,
]
REVEL_LY = [
    16072.22, 19504.47, 13532.12, 30867.5, 30007.25, 28932.46, 12132.77, 9890.89, 27239.49, 14583.69,
    13140.93, 37502.59, 34774.51, 21647.0, 17574.95, 20322.93, 28227.79, 13832.79, 19299.86, 27810.64,
    17368.21, 23005.9, 16865.05, 46959.42, 25024.47, 27806.02, 51041.22, 54592.22, 40380.09, 42293.09,
]

# Best Revel created-GP day to date (30 Jun 2026, EOFY); the record alert needs to beat this.
REVEL_RECORD_FLOOR = 128938.59

BRANDS = {
    "GAF": dict(name="Gym and Fitness", short="GAF", accent="#F26422", ink="#000000", grey="#424242",
                targets=GAF_TARGETS, ly=None,
                icon="https://cdn.shopify.com/s/files/1/1950/1891/files/GAF-Icon.png",
                hook="BLACK_NOVEMBER_CHAT_WEBHOOK"),
    "REVEL": dict(name="Revel", short="REVEL", accent="#25B34B", ink="#485D4D", grey="#485D4D",
                  targets=REVEL_TARGETS, ly=REVEL_LY,
                  icon="https://cdn.shopify.com/s/files/1/1950/1891/files/REVEL_Logo-Icon.png?v=1769576830",
                  hook="BLACK_NOVEMBER_REVEL_CHAT_WEBHOOK"),
}


def money(x):
    x = float(x)
    if abs(x) >= 1_000_000:
        return f"${x/1_000_000:.2f}M"
    if abs(x) >= 1000:
        return f"${x/1000:.1f}k"
    return f"${x:,.0f}"


def num(s):
    s = (s or "").replace("$", "").replace(",", "").replace("%", "").strip()
    try:
        return float(s)
    except ValueError:
        return None


def totals(rows):
    net = sum(num(r.get("Amount (Net)")) or 0 for r in rows)
    gp = sum(num(r.get("Est. Gross Profit (Line)")) or 0 for r in rows)
    return net, gp, (gp / net * 100 if net else 0)


def history(brand, inp):
    """{date: (gp_created, gp_created_budget)}. GAF: public daily sheet. Revel: NetSuite 6212 + 6236 rows in the input."""
    out = {}
    if brand == "REVEL":
        for r in inp.get("history_rows", []):
            try:
                x = dt.datetime.strptime(r["Date"].strip(), "%d/%m/%Y").date()
            except ValueError:
                continue
            out[x] = ((out.get(x, (0, 0))[0] or 0) + (num(r.get("Est. Gross Profit (Line)")) or 0), 0)
        return out
    text = subprocess.run(["curl", "-sSL", "--fail", GAF_MAIN], capture_output=True, text=True, check=True).stdout
    for r in csv.DictReader(io.StringIO(text)):
        try:
            d = dt.datetime.strptime(r["DATE"].strip(), "%d/%m/%Y").date()
        except ValueError:
            continue
        out[d] = (num(r["GROSS PROFIT CREATED"]), num(r["GROSS PROFIT CREATED (BUDGET)"]))
    return out


def fetch(url):
    return subprocess.run(["curl", "-sSL", "--fail", url], capture_output=True, text=True, check=True).stdout


def wholesale(d):
    """(revenue, gp, gp_budget) month to date for GAF Wholesale, or None if no invoices yet."""
    month = d.strftime("%b %Y")
    gp_budget = None
    for r in csv.reader(io.StringIO(fetch(WS_BUD))):
        if r and r[0].strip() == month:
            gp_budget = num(r[3])
    rev = cogs = 0.0
    n = 0
    for r in csv.DictReader(io.StringIO(fetch(WS_ACT))):
        acct = (r.get("Account") or "").strip()
        if (r.get("Period") or "").strip() != month or not acct[:1].isdigit():
            continue
        v = num(r.get("Amount")) or 0
        n += 1
        if acct[0] == "4":
            rev += v
        elif acct[0] == "5":
            cogs += v
    return None if n == 0 else (rev, rev - cogs, gp_budget)


def bar(ratio, n=10):
    filled = max(0, min(n, round(ratio * n)))
    return "▰" * filled + "▱" * (n - filled)


def build(inp, brand, as_day=None, test=False, wrap=False):
    b = BRANDS[brand]
    d = dt.date.fromisoformat(inp["date"])
    hist = history(brand, inp)
    c_net, c_gp, c_pct = totals(inp["created_rows"])
    f_net, f_gp, f_pct = totals(inp["dispatched_rows"])
    if brand == "REVEL" and d in hist and abs(hist[d][0] - c_gp) > 1:
        print(f"WARNING: search 6228 says {c_gp:.2f} but 6212+6236 history says {hist[d][0]:.2f} for {d}", file=sys.stderr)
    hist[d] = (c_gp, (hist.get(d) or (None, 0))[1])
    in_nov = d.year == 2026 and d.month == 11

    def target(x):
        return b["targets"][x.day - 1] if (x.year == 2026 and x.month == 11) else ((hist.get(x) or (None, 0))[1] or 0)

    dim = (dt.date(d.year + (d.month == 12), d.month % 12 + 1, 1) - dt.date(d.year, d.month, 1)).days
    days = [dt.date(d.year, d.month, i) for i in range(1, dim + 1)]
    mtd = sum((hist.get(x, (0, 0))[0] or 0) for x in days if x <= d)
    m_target = sum(target(x) for x in days)
    t_to_date = sum(target(x) for x in days if x <= d)
    tgt = target(d)
    ratio = c_gp / tgt if tgt else 0
    prior_max = max([(v[0] or 0) for k, v in hist.items() if k < d] or [0])
    if brand == "REVEL":
        prior_max = max(prior_max, REVEL_RECORD_FLOOR)
    if b["ly"] and in_nov:
        ly = b["ly"][d.day - 1]
    elif b["ly"]:
        ly = None
    else:
        ly = (hist.get(d - dt.timedelta(days=364)) or (None, 0))[0]
    n = d.day - 1 if in_nov else (as_day or 1)   # sale Day 1 = Mon 2 Nov
    left = 30 - d.day if in_nov else 29 - n
    final_day = in_nov and d.day == 30
    gap = mtd - t_to_date

    if not tgt:
        status, tag = "NO TARGET SET", "SCOREBOARD"
    elif ratio >= 1.5:
        status, tag = "SMASHING THE TARGET", "ON FIRE"
    elif ratio >= 1.0:
        status, tag = "TARGET HIT", "SMASHED IT"
    elif ratio >= 0.75:
        status, tag = "SO CLOSE", "FINISH THE JOB"
    else:
        status, tag = "BELOW TARGET", "NEW DAY, NEW CHANCE"

    if final_day:
        tag = "FINAL DAY"
    acc, ink, grey = b["accent"], b["ink"], b["grey"]
    f = lambda c, t: f'<font color="{c}">{t}</font>'
    def P(html):
        html = re.sub(r'<font color="([^"]+)"><b>(.*?)</b></font>', r'<b><font color="\1">\2</font></b>', html)
        return {"textParagraph": {"text": html}}

    sections = []
    sections.append({"widgets": [
        P(f(grey, "<b>" + "CREATED · THE BIG ONE" + "</b>") + "<br>" + f(acc, f"<b>{money(c_gp)}</b>") + f(grey, f" GP   ·   {money(c_net)} net sales   ·   {c_pct:.1f}% GP")),
        P(f(grey, "<b>" + "FULFILLED · OUT THE DOOR" + "</b>") + "<br>" + f(acc, f"<b>{money(f_gp)}</b>") + f(grey, f" GP   ·   {money(f_net)} net sales   ·   {f_pct:.1f}% GP")),
    ]})
    if tgt:
        tl = f(acc, f"<b>{status}</b>") + f(grey, f"  {money(c_gp)} GP vs {money(tgt)} daily target  ") + f(acc, f"<b>{ratio*100:.0f}%</b>") + "<br>" + f(acc, bar(ratio))
    else:
        tl = f(acc, f"<b>{status}</b>") + f(grey, f"  {money(c_gp)} GP, no daily target available")
    if ly:
        tl += "<br>" + f(grey, f"Same day last year: {money(ly)} GP")
    pace = ("Ahead of pace by " if gap >= 0 else "Behind pace by ") + money(abs(gap))
    if gap < 0 and left > 0:
        pace += f"  ·  need {money((m_target - mtd) / left)}/day to land the month"
    if m_target:
        ml = f(grey, "<b>" + "MONTH TO DATE" + "</b>") + "<br>" + f(acc, f"<b>{money(mtd)}</b>") + f(grey, f" of {money(m_target)} target  ") + f(acc, f"<b>{mtd/m_target*100:.0f}%</b>") + "<br>" + f(acc, bar(mtd / m_target)) + "<br>" + f(grey, pace)
    else:
        ml = f(grey, "<b>" + "MONTH TO DATE" + "</b>") + "<br>" + f(acc, f"<b>{money(mtd)}</b>") + f(grey, " GP, no month target available")
    sections.append({"widgets": [P(tl), P(ml)]})
    if c_gp > prior_max > 0:
        sections.append({"widgets": [P(f(acc, "<b>NEW RECORD</b>") + f(grey, f"  Biggest GP day in our tracked history. Previous best {money(prior_max)}."))]})
    lines = []
    for i, t in enumerate(inp["top5"][:5], 1):
        name = (t.get("description") or t.get("sku") or "").strip()
        name = name if len(name) <= 48 else name[:45] + "..."
        q = int(float(t["qty"]))
        lines.append(f(acc, f"<b>{i}</b>") + f(grey, f"  {name}  ·  {q} unit{'s' if q != 1 else ''}  ·  ") + f(acc, f"<b>{money(t['net'])}</b>"))
    sections.append({"header": "TOP 5 SELLERS (CREATED)", "widgets": [P("<br>".join(lines))]})
    if brand == "GAF":
        w = wholesale(d)
        if w is None:
            wl = f(grey, "<b>" + "WHOLESALE  " + "</b>") + f(acc, "<b>First invoices of the month still to land.</b>") + f(grey, " Let's get them in!")
        else:
            wl = f(grey, "<b>" + "WHOLESALE (INVOICED, MONTH TO DATE)" + "</b>") + "<br>" + f(acc, f"<b>{money(w[0])}</b>") + f(grey, " revenue   ·   ") + f(acc, f"<b>{money(w[1])}</b>") + f(grey, " GP")
            if w[2]:
                wl += f(grey, f" vs {money(w[2])} GP budget  ") + f(acc, f"<b>{w[1] / w[2] * 100:.0f}%</b>")
        sections.append({"widgets": [P(wl)]})
    if final_day:
        sections.append({"widgets": [P(f(acc, "<b>FINAL DAY OF THE SALE.</b>") + f(grey, " Month wrap to follow at 10am."))]})
    elif left > 0:
        sections.append({"widgets": [P(f(grey, f"{left} day{'s' if left != 1 else ''} to go. Who's making tomorrow even bigger?"))]})

    title = "BLACK NOVEMBER · FINAL DAY" if final_day else f"BLACK NOVEMBER · DAY {n} OF 29"
    sub = f"{b['name']} · {d.strftime('%A %d %b')} · {tag}"
    if test:
        title = "TEST · " + title
    card = {"cardsV2": [{"cardId": "bn", "card": {
        "header": {"title": title, "subtitle": sub, "imageUrl": b["icon"], "imageType": "CIRCLE"},
        "sections": sections}}]}
    plain = f"{title}: {b['name']} {d.strftime('%a %d %b')}. Created GP {money(c_gp)} vs {money(tgt)} target. Month to date {money(mtd)} of {money(m_target)}."
    card["text"] = plain
    if wrap:
        best = max([x for x in days if hist.get(x, (0, 0))[0]], key=lambda x: hist[x][0])
        hit = sum(1 for x in days if hist.get(x, (0, 0))[0] and (hist.get(x, (0, 0))[0] or 0) >= target(x))
        played = sum(1 for x in days if hist.get(x, (0, 0))[0])
        wsec = [{"widgets": [P(
            f(grey, "<b>" + "MONTH GP CREATED" + "</b>") + "<br>" + f(acc, f"<b>{money(mtd)}</b>") + f(grey, f" vs {money(m_target)} target  ") + f(acc, f"<b>{mtd/(m_target or 1)*100:.0f}%</b>") + "<br>" + f(acc, bar(mtd / (m_target or 1)))),
            P(f(grey, "<b>" + "BEST DAY" + "</b>") + "<br>" + f(acc, f"<b>{best.strftime('%a %d %b')}</b>") + f(grey, " at ") + f(acc, f"<b>{money(hist[best][0])}</b>") + f(grey, " GP")),
            P(f(grey, "<b>" + "DAYS ON OR ABOVE TARGET" + "</b>") + "<br>" + f(acc, f"<b>{hit}</b>") + f(grey, f" of {played} trading days"))]}]
        if brand == "GAF":
            w = wholesale(d)
            if w is not None:
                wl = f(grey, "<b>" + "WHOLESALE (INVOICED, MONTH)" + "</b>") + "<br>" + f(acc, f"<b>{money(w[0])}</b>") + f(grey, " revenue   ·   ") + f(acc, f"<b>{money(w[1])}</b>") + f(grey, " GP")
                if w[2]:
                    wl += f(grey, f" vs {money(w[2])} GP budget  ") + f(acc, f"<b>{w[1] / w[2] * 100:.0f}%</b>")
                wsec.append({"widgets": [P(wl)]})
        wsec.append({"widgets": [P(f(acc, "<b>Thank you, team. What a month.</b>"))]})
        card = {"cardsV2": [{"cardId": "bnwrap", "card": {
            "header": {"title": ("TEST · " if test else "") + "BLACK NOVEMBER · MONTHLY WRAP", "subtitle": f"{b['name']} · November 2026", "imageUrl": b["icon"], "imageType": "CIRCLE"},
            "sections": wsec}}], "text": f"Black November monthly wrap: {b['name']} GP created {money(mtd)} vs {money(m_target)} target."}
    return card, dict(brand=brand, accent=acc, ink=ink, grey=grey)


if __name__ == "__main__":
    a = sys.argv[1:]
    brand = a[a.index("--brand") + 1].upper()
    inp = json.load(open(a[0]))
    as_day = int(a[a.index("--as-day") + 1]) if "--as-day" in a else None
    card, _ = build(inp, brand, as_day, "--test" in a, "--wrap" in a)
    out = a[a.index("--out") + 1] if "--out" in a else None
    if out:
        json.dump(card, open(out, "w"), ensure_ascii=False, indent=1)
    print(json.dumps(card, ensure_ascii=False)[:400], "...")
    if "--post" in a:
        hook = os.environ[BRANDS[brand]["hook"]]
        res = subprocess.run(["curl", "-sS", "-X", "POST", "-H", "Content-Type: application/json; charset=UTF-8",
                              "--data", json.dumps(card), hook], capture_output=True, text=True)
        resp = json.loads(res.stdout or "{}")
        print("\nPOSTED:" if "name" in resp else "\nPOST FAILED:", resp.get("name") or resp)
        sys.exit(0 if "name" in resp else 1)
