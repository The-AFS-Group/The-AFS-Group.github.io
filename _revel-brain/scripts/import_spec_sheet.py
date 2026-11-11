#!/usr/bin/env python3
"""Turn the "Revel Product Spec Sheets" workbook into draft Brain cards.

    python3 scripts/import_spec_sheet.py "Revel_Product_Spec_Sheets.xlsx" \
        --as-of 2026-11-11 [--products-js ../revel-brain-inbox/products.js]

Writes cards/<category>/<product>/<topic>.md (status "In review", no approvals)
and seed/<category>.md, the pull-request description for each category batch
with every conflict and gap found. Prices are left out on purpose: they change
with every promotion and Shopify is their source of truth.

Facts are copied from the sheet as written. The only edits are listed in the
seed report (typo fixes); everything else that looks wrong is flagged, not fixed.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).resolve().parent))
from brainlib import ROOT, load_config, slugify, write_card  # noqa: E402

SHEET = "Product Specs"
LIB_SHEET = "PDF Library"
COLS = ["product", "category", "skus", "price", "general", "dimensions",
        "electrical", "warranty", "manual", "info_sheet", "page"]

CATEGORY_MAP = {
    "Traditional Sauna": ("sauna-traditional", None),
    "Barrel Sauna": ("sauna-traditional", "Barrel"),
    "Infrared Sauna": ("sauna-infrared", None),
    "Hybrid Sauna": ("sauna-hybrid", None),
    "Contrast Package": ("bundles", "Contrast package"),
    "Ice Bath": ("ice-bath", None),
    "Chiller": ("ice-bath", "Chiller"),
    "Heater & Stones": ("heaters-controls", None),
    "Red Light": ("red-light", None),
    "Accessory": ("accessories", None),
}

# Section headings in the "General & Inclusions" column, and where they go.
ROUTES = {
    "accessories": ("specs", "In the box"),
    "inclusions": ("specs", "In the box"),
    "product specifications": ("specs", None),
    "product variation disclaimer": ("specs", "Product variation"),
    "installation & clearance requirements": ("install", "Installation & clearance"),
    "outdoor sauna disclaimer": ("care", "Outdoor timber finish"),
    "oiling": ("care", "Oiling"),
    "hybrid heating modes": ("care", "Hybrid heating modes"),
    "water quality": ("specs", "Water quality"),
    "connectivity & controls": ("specs", "Connectivity & controls"),
}

# Obvious typos fixed on import. Each fix is listed in the seed report.
TYPO_FIXES = [
    (re.compile(r"\bComponetry\b"), "Componentry", "'Componetry' -> 'Componentry'"),
    (re.compile(r"Outer Body: 200W\)"), "Outer Body: 200(W)", "'200W)' -> '200(W)'"),
    (re.compile(r"^Temperature:(?=\S)", re.M), "Temperature: ", "space after 'Temperature:'"),
    (re.compile(r"\(lower  bench\)"), "(lower bench)", "double space in '(lower bench)'"),
]

STANDARD_AMPS = {10, 15, 16, 20, 25, 32, 40, 50, 63}


# ----------------------------------------------------------------- parsing

def clean_cell(v) -> str:
    if v is None:
        return ""
    s = str(v).replace("\r", "").strip()
    return "" if s.lower() == "none" else s


def short_name(name: str) -> str:
    s = re.sub(r"^Revel\s+", "", name.strip())
    gen = ""
    if re.search(r"next gen", s, re.I):
        gen = " (Next Gen)"
    m = re.search(r"\(Gen (\d+)\)", s)
    if m:
        gen = f" (Gen {m.group(1)})"
    s = re.sub(r"\s*[-–]\s*Next Gen\b|\s*\(Gen \d+\)", "", s, flags=re.I)
    s = re.sub(r"(\d(?:-\d)?)\s*Person\b", r"\1P", s)
    s = re.sub(
        r"\b(Traditional Finnish Sauna|Traditional Cedar Barrel Sauna|Traditional Barrel Sauna|"
        r"Full Spectrum Infrared Cabin Sauna|Full Spectrum Infrared Cedar Sauna|"
        r"Full Spectrum Infrared Sauna|Far Infrared Sauna|Infrared Cabin Sauna|"
        r"Infrared & Traditional Hybrid Sauna|Traditional Cabin)\b", "", s)
    s = s.replace("– Premium Cedar Ice Bath", "").replace("- Premium Cedar Ice Bath", "")
    s = re.sub(r"\s+-\s+(?=\d)", " ", s)          # "Eden - 4P" -> "Eden 4P"
    s = re.sub(r"\s{2,}", " ", s).strip(" -–")
    return s + gen


def split_line(line: str):
    """'Key: Value' -> (key, value); anything else -> (None, line)."""
    m = re.match(r"^([^:]{1,60}?)\s*:\s*(.+)$", line)
    if m and not re.search(r"https?$", m.group(1)):
        return m.group(1).strip(), m.group(2).strip()
    return None, line


def is_heading(line: str) -> bool:
    bare = line.rstrip(":").strip()
    if bare.lower() in ROUTES:
        return True
    if line.endswith(":") and ":" not in line[:-1] and len(line) < 70:
        return True
    if ":" in bare:
        return False
    letters = re.sub(r"[^A-Za-z]", "", bare)
    if bare.upper() == bare and len(letters) > 3 and len(bare) < 70:
        return True
    # "ELECTRICAL (For Harvia heater sold Separately)"
    return bool(re.match(r"^[A-Z]{4,}\b(?! [a-z])", bare)) and len(bare) < 70 and bare.split()[0].isupper()


def parse_block(text: str):
    """Return [{h, items, topic, label}] where items are (key|None, value).

    A known heading (ROUTES) decides which card a section belongs to; any other
    heading is a sub-heading and stays with the section above it.
    """
    sections, cur = [], {"h": None, "items": [], "topic": None, "label": None}
    for raw in text.split("\n"):
        line = re.sub(r"^\s*[•\-\*]\s*", "", raw).strip()
        if not line:
            continue
        if is_heading(line):
            if cur["items"] or cur["h"]:
                sections.append(cur)
            h = line.rstrip(":").strip()
            route = ROUTES.get(h.lower())
            if route:
                cur = {"h": h, "items": [], "topic": route[0], "label": route[1]}
            else:
                cur = {"h": h, "items": [], "topic": cur["topic"], "label": nice_heading(h)}
            continue
        cur["items"].append(split_line(line))
    if cur["items"] or cur["h"]:
        sections.append(cur)
    return sections


def nice_heading(h: str) -> str:
    if h.upper() == h:
        h = h.title().replace("&", "&").replace(" And ", " and ")
    return h


def render_items(items) -> list[str]:
    out = []
    for k, v in items:
        out.append(f"- **{k}:** {v}" if k else f"- {v}")
    return out


def find_fact(sections, *keys):
    keys = [k.lower() for k in keys]
    for sec in sections:
        for k, v in sec["items"]:
            if k and k.lower().rstrip("?") in keys:
                return v
    return None


def watts_in(text: str | None) -> list[float]:
    if not text:
        return []
    vals = []
    for num, unit in re.findall(r"(\d[\d,]*(?:\.\d+)?)\s*(kW|W|Watts)\b", text, re.I):
        n = float(num.replace(",", ""))
        vals.append(n * 1000 if unit.lower() == "kw" else n)
    if not vals and re.fullmatch(r"\s*\d{3,5}\s*", text or ""):
        vals.append(float(text))
    return vals


def amps_in(text: str | None):
    if not text:
        return None
    m = re.search(r"(\d+(?:\.\d+)?)\s*Amp", text, re.I)
    return float(m.group(1)) if m else None


# ----------------------------------------------------------------- products

class Product:
    def __init__(self, row_no: int, rec: dict, as_of: str):
        self.row = row_no
        self.rec = rec
        self.name = rec["product"].strip()
        self.sheet_category = rec["category"].strip()
        self.cat_slug, self.type = CATEGORY_MAP.get(self.sheet_category, ("accessories", None))
        if self.cat_slug == "accessories" and re.search(r"red\s*light", self.name, re.I):
            self.cat_slug = "red-light"
        self.short = short_name(self.name)
        self.slug = slugify(self.short)
        self.skus = [s.strip() for s in re.split(r"[\n,]+", rec["skus"]) if s.strip()]
        self.as_of = as_of
        self.fixes: list[str] = []
        for col in ("general", "dimensions", "electrical", "warranty"):
            txt = rec[col]
            for rx, rep, label in TYPO_FIXES:
                new = rx.sub(rep, txt)
                if new != txt:
                    self.fixes.append(f"{col}: {label}")
                    txt = new
            rec[col] = txt
        self.general = parse_block(rec["general"])
        self.dimensions = parse_block(rec["dimensions"])
        self.electrical = parse_block(rec["electrical"])
        self.warranty = parse_block(rec["warranty"])
        self.components: dict[str, list[tuple[str, "Product"]]] = {}
        self.component_notes: dict[str, list[str]] = {}

    @property
    def card_dir(self) -> str:
        return f"cards/{self.cat_slug}/{self.slug}"

    def card_id(self, topic: str) -> str:
        return f"{self.card_dir}/{topic}"

    def codes(self) -> list[str]:
        """Codes other products' SKUs embed this product by (SKU minus 'R-')."""
        out = set()
        for s in self.skus:
            c = norm_sku(s)
            c = re.sub(r"^R-", "", c)
            out.add(c)
            out.add(re.sub(r"-(IG)$", "", c))
        if len(self.skus) > 1:
            toks = [norm_sku(s).split("-") for s in self.skus]
            pre = []
            for group in zip(*toks):
                if len(set(group)) == 1:
                    pre.append(group[0])
                else:
                    break
            if len(pre) >= 3:
                out.add("-".join(pre[1:] if pre[0] == "R" else pre))
        return [c for c in out if len(c) >= 5]


def norm_sku(s: str) -> str:
    return s.upper().replace("-BLK", "-BLACK")


def contains_code(sku: str, code: str) -> bool:
    return re.search(r"(^|-)" + re.escape(code) + r"($|-)", norm_sku(sku)) is not None


# ----------------------------------------------------------------- card bodies

def sources_meta(p: Product, extra: list[dict] | None = None) -> list[dict]:
    src = [{"type": "Spec sheet", "ref": f"Revel Product Spec Sheets.xlsx, Product Specs row {p.row}",
            "date": p.as_of}]
    if p.rec["page"]:
        src.append({"type": "Product page", "ref": p.rec["page"]})
    if p.rec["manual"]:
        src.append({"type": "Product manual", "ref": p.rec["manual"]})
    for e in extra or []:
        src.append(e)
    return src


def sources_md(meta_sources: list[dict]) -> list[str]:
    out = ["## Sources", ""]
    for s in meta_sources:
        d = f" ({s['date']})" if s.get("date") else ""
        out.append(f"- {s['type']}: {s['ref']}{d}")
    return out


def header(p: Product, topic_label: str) -> list[str]:
    sku = ", ".join(f"`{s}`" for s in p.skus) if p.skus else "n/a"
    return [f"# {p.short} · {topic_label}", "",
            f"**Product:** {p.name}  ", f"**SKUs:** {sku}  ", "**Markets:** AU", ""]


def base_meta(p: Product, topic: str, cfg: dict, sources: list[dict], audience="customer") -> dict:
    meta = {
        "id": p.card_id(topic),
        "title": f"{p.short} · {cfg['topics'][topic]}",
        "product": p.name,
        "skus": p.skus,
        "category": cfg["categories"][p.cat_slug],
    }
    if p.type:
        meta["type"] = p.type
    meta.update({
        "topic": cfg["topics"][topic],
        "markets": ["AU"],
        "audience": audience,
        "source": sources,
        "approved_by": [],
        "approved_on": None,
        "approval_pr": None,
        "review_by": None,
        "status": "In review",
    })
    return meta


def variants_table(p: Product) -> list[str]:
    if not p.components:
        return []
    rows = ["| SKU | Includes |", "|---|---|"]
    for sku in p.skus:
        parts = [f"{c.short} ([card]({ '/' + c.card_id('specs') }.md))" for _, c in p.components.get(sku, [])]
        parts += p.component_notes.get(sku, [])
        rows.append(f"| `{sku}` | {'; '.join(parts) if parts else 'Base product only'} |")
    return ["## Variants by SKU", "",
            "_Decoded from the SKU codes against the heater, controller and chiller SKUs on the "
            "spec sheet. Tristan to confirm._", ""] + rows + [""]


def specs_body(p: Product) -> str:
    out = header(p, "Specs")
    facts, subs, notes = [], defaultdict(list), []
    for sec in p.general:
        if sec["topic"] not in (None, "specs"):
            continue
        if sec["label"] == "Product variation":
            notes += [v for _, v in sec["items"]]
        elif sec["label"]:
            subs[sec["label"]] += sec["items"]
        else:
            facts += sec["items"]
    if facts:
        out += ["## Key facts", ""] + render_items(facts) + [""]
    for sub, items in subs.items():
        out += [f"### {sub}", ""] + render_items(items) + [""]
    dims = [it for sec in p.dimensions for it in sec["items"]]
    if dims:
        out += ["## Dimensions & weight", ""] + render_items(dims) + [""]
    out += variants_table(p)
    if notes:
        out += ["## Notes", ""] + [f"- **Product variation:** {n}" for n in notes] + [""]
    return "\n".join(out)


def install_items(p: Product):
    return [sec for sec in p.general if sec["topic"] == "install"]


def care_items(p: Product):
    return [sec for sec in p.general if sec["topic"] == "care"]


def section_lines(sections) -> list[str]:
    out = []
    for sec in sections:
        title = sec["label"] or (nice_heading(sec["h"]) if sec["h"] else None)
        if title:
            out += [f"### {title}", ""]
        out += render_items(sec["items"]) + [""]
    return out


def is_heater(c: "Product") -> bool:
    n = c.name.lower()
    return c.cat_slug == "heaters-controls" and "heater" in n and "control" not in n


def kw_label(watts: float) -> str:
    return f"{watts / 1000:g} kW"


def electrical_customer_line(p: Product, heaters: list["Product"]) -> str | None:
    txt = p.rec["electrical"]
    parts = []
    power = find_fact(p.electrical, "power", "max power")
    socket = find_fact(p.electrical, "socket")
    elec = find_fact(p.electrical, "electrician required", "electrician required?")
    w = watts_in(power)
    a = amps_in(socket)
    if w and a:
        w_txt = f"{int(max(w)):,} W" if len(w) == 1 else f"up to {int(max(w)):,} W"
        a_txt = f"{a:g}"
        if socket and "dedicated circuit" in socket.lower():
            parts.append(f"The {p.short} draws {w_txt} and needs its own {a_txt} amp dedicated circuit. "
                         "It has no plug and must be hard-wired by a licensed electrician.")
        else:
            parts.append(f"The {p.short} runs on 220–240 V, draws {w_txt} and plugs into a {a_txt} amp power point.")
    if elec:
        if elec.lower().startswith("no"):
            parts.append("No electrician is needed.")
        elif "10 amp" in elec.lower():
            parts.append("If the power point is a standard 10 amp outlet, a licensed electrician needs to "
                         "upgrade it to 15 amp first.")
    if "doesn't come with a heater" in txt or "doesn't have a power cord" in txt:
        vent = " and ventilation" if re.search(r"lighting\s*&\s*ventilation", txt, re.I) else ""
        if "doesn't come with a heater" in txt:
            parts.append(f"The cabin's LED lighting{vent} runs off a standard 10 amp power point. The Harvia "
                         "heater is sold separately, has no plug, and must be hard-wired by a licensed "
                         "electrician on its own circuit.")
            if heaters:
                by_kw = {}
                for h in heaters:
                    hw = watts_in(find_fact(h.electrical, "power"))
                    ha = amps_in(find_fact(h.electrical, "socket"))
                    if hw and ha:
                        by_kw.setdefault(max(hw), set()).add(ha)
                if by_kw:
                    bits = []
                    for i, (kw, amps) in enumerate(sorted(by_kw.items())):
                        amp_txt = " or ".join(f"{a:g}" for a in sorted(amps))
                        bits.append(f"a {kw_label(kw)} heater needs a {amp_txt} amp dedicated circuit" if i == 0
                                    else f"a {kw_label(kw)} heater a {amp_txt} amp circuit")
                    txt = bits[0] if len(bits) == 1 else ", ".join(bits[:-1]) + " and " + bits[-1]
                    parts.append(f"The circuit depends on the heater: {txt}.")
    return " ".join(parts) if parts else None


def heater_table(p: Product) -> tuple[list[str], list[Product]]:
    heaters, rows = [], []
    for sku in p.skus:
        comps = [c for _, c in p.components.get(sku, [])]
        hs = [c for c in comps if is_heater(c)]
        ctrl = [c for c in comps if "xenio" in c.name.lower()]
        ctrl_txt = ctrl[0].short if ctrl else ("Built-in (manual heater)" if hs and "electronic" not in hs[0].name.lower() else "")
        for h in hs:
            heaters.append(h)
            rows.append(f"| `{sku}` | {h.short} | {find_fact(h.electrical, 'power') or '?'} | "
                        f"{find_fact(h.electrical, 'socket') or '?'} | {ctrl_txt} |")
    if not rows:
        return [], []
    return (["### Heater options by SKU", "",
             "_From the heater cards. The electrician confirms the circuit on site._", "",
             "| SKU | Heater | Power | Circuit | Controller |", "|---|---|---|---|---|"] + rows + [""]), heaters


def electrical_body(p: Product) -> str:
    out = header(p, "Electrical")
    out += ["## Facts", ""] + section_lines(p.electrical)
    table, heaters = heater_table(p)
    out += table
    line = electrical_customer_line(p, heaters)
    if line:
        out += ["## Customer-ready answer", "", line, ""]
    return "\n".join(out)


def warranty_customer_line(p: Product) -> str | None:
    resi, comm, plain, residential_only, extra = [], [], [], False, []
    ctx = None
    for sec in p.warranty:
        h, items = sec["h"], sec["items"]
        if h:
            hl = h.lower()
            if "residential" in hl and "only" in hl:
                residential_only = True
            ctx = "comm" if "commercial" in hl else "resi" if "residential" in hl else ctx
        for k, v in items:
            if not k:
                vl = v.lower()
                if "residential use only" in vl:
                    residential_only = True
                elif re.fullmatch(r"\d+\s*years?(\s*warranty)?", vl):
                    plain.append(re.sub(r"\s*warranty", "", vl))
                else:
                    extra.append(v.rstrip(".") + ".")
                continue
            kl = k.lower()
            if kl.startswith("for residential use only"):
                residential_only = True
                plain.append(v.lower())
                continue
            if kl.startswith("for residential use"):
                resi.append(("", v.lower()))
                continue
            if kl.startswith("for commercial use"):
                comm.append(("", v.lower()))
                continue
            if kl == "warranty":
                plain.append(v.lower())
                continue
            (comm if ctx == "comm" else resi).append((k.lower(), v.lower()))

    def join(items):
        txt = [f"{k} {v}".strip() for k, v in items]
        return txt[0] if len(txt) == 1 else ", ".join(txt[:-1]) + " and " + txt[-1]

    parts = []
    if resi:
        label = ", residential use" if comm or residential_only else ""
        if all(k == "" for k, _ in resi):
            parts.append(f"The {p.short} has a {resi[0][1]} warranty for residential use.")
        else:
            parts.append(f"Warranty on the {p.short}{label}: {join(resi)}.")
    elif plain:
        parts.append(f"The {p.short} comes with a {plain[0].replace(' years', '-year').replace(' year', '-year')} warranty.")
    if comm:
        if all(k == "" for k, _ in comm):
            parts.append(f"For commercial use it's {comm[0][1]}.")
        else:
            parts.append(f"For commercial use: {join(comm)}.")
    if residential_only and not comm:
        parts.append("It's warranted for residential use only.")
    parts += extra
    return " ".join(parts) if parts else None


def warranty_body(p: Product) -> str:
    out = header(p, "Warranty")
    out += ["## Facts", ""] + section_lines(p.warranty)
    line = warranty_customer_line(p)
    if line:
        out += ["## Customer-ready answer", "", line, ""]
    return "\n".join(out)


STD_CLEARANCE = ["100mm Rear and Sides", "300mm Overhead", "Unobstructed Front Access"]


def install_body(p: Product, sections) -> str:
    out = header(p, "Install")
    out += ["## Facts", ""] + section_lines(sections)
    flat = [v for sec in sections for _, v in sec["items"]]
    if all(any(s.lower() in f.lower() for f in flat) for s in STD_CLEARANCE):
        out += ["## Customer-ready answer", "",
                f"The {p.short} is designed for residential use only. It needs at least 100 mm clearance at "
                "the rear and sides, 300 mm overhead and unobstructed access at the front. Don't install it in "
                "an enclosed space or a commercial setting: installing outside these requirements voids the "
                "warranty.", ""]
    return "\n".join(out)


def care_body(p: Product, sections) -> str:
    out = header(p, "Care")
    out += ["## Facts", ""] + section_lines(sections)
    return "\n".join(out)


def has_topic(c: Product, topic: str) -> bool:
    if topic == "specs":
        return bool(c.rec["general"] or c.rec["dimensions"])
    if topic == "electrical":
        return bool(c.rec["electrical"])
    if topic == "warranty":
        return bool(c.rec["warranty"]) and not re.search(r"Dimensions|Net Weight", c.rec["warranty"])
    return False


def bundle_specs_body(p: Product) -> str:
    out = header(p, "Specs")
    comps = {c.card_id("specs"): c for sku in p.skus for _, c in p.components.get(sku, [])}
    out += ["## What's in the package", ""]
    for cid, c in comps.items():
        links = [f"[{t}](/{c.card_id(t)}.md)" for t in ("specs", "electrical", "warranty") if has_topic(c, t)]
        out.append(f"- {c.name} ({', '.join(links)})" if links else f"- {c.name}")
    for notes in p.component_notes.values():
        out += [f"- {n}" for n in notes]
    out += ["", "Specs, electrical and warranty for a package are those of each product in it. "
            "Answer from the component cards.", ""]
    return "\n".join(out)


# ----------------------------------------------------------------- flags

class Flags:
    def __init__(self):
        self.items: list[dict] = []

    def add(self, kind, p: Product | None, topic, text):
        self.items.append({"kind": kind, "cat": p.cat_slug if p else "all",
                           "product": p.short if p else "All", "row": p.row if p else None,
                           "topic": topic, "text": text})


def check_product(p: Product, flags: Flags, lib_notes: dict):
    for fx in p.fixes:
        flags.add("fixed", p, "", f"Typo fixed on import ({fx}).")
    for s in p.skus:
        if not s.upper().startswith("R-"):
            flags.add("check", p, "specs", f"SKU `{s}` doesn't follow the `R-` format. Confirm it is current.")
    power = find_fact(p.electrical, "power", "max power")
    socket = find_fact(p.electrical, "socket")
    w, a = watts_in(power), amps_in(socket)
    for sec in p.electrical:
        heater = next((v for k, v in sec["items"] if k and k.lower() == "heater"), None)
        sec_w = watts_in(next((v for k, v in sec["items"] if k and k.lower() == "power"), None))
        kw = re.search(r"(\d+(?:\.\d+)?)\s*kw\b", heater or "", re.I)
        if kw and sec_w and abs(float(kw.group(1)) * 1000 - max(sec_w)) > 1:
            flags.add("conflict", p, "electrical",
                      f"Says `Heater: {heater}` but power is {int(max(sec_w)):,} W"
                      + (f" and the SKU is `{p.skus[0]}`" if p.skus else "") + ".")
    if w and a and socket and "plug" not in socket.lower() and "socket" not in socket.lower():
        load = max(w) / 240
        if a + 0.01 < load:
            flags.add("conflict", p, "electrical", f"{int(max(w)):,} W draws {load:.1f} A at 240 V, more than the {a:g} A stated.")
    if a and a not in STANDARD_AMPS:
        flags.add("check", p, "electrical",
                  f"`{socket}`: {a:g} A is the heater's load at 240 V, not a standard circuit or breaker "
                  "size. Confirm the circuit rating to quote customers.")
    if w and a and socket and ("plug" in socket.lower() or "outlet" in socket.lower()):
        if max(w) > a * 240 + 1:
            unit = "" if re.search(r"w", power or "", re.I) else " (the sheet gives no unit)"
            flags.add("conflict", p, "electrical",
                      f"Power {power}{unit} is more than a {a:g} A outlet supplies ({a * 240:,.0f} W at 240 V). "
                      "Confirm the power figure and the outlet needed.")
    if re.search(r"\b\d+\s*g\b", p.rec["general"]) and "Stones: 20g" in p.rec["general"]:
        flags.add("conflict", p, "specs", "`Stones: 20g`: almost certainly 20 kg.")
    if re.search(r"Dimensions|Net Weight", p.rec["warranty"]):
        flags.add("conflict", p, "warranty", "The warranty column holds dimensions, not warranty terms. "
                  "Warranty card not created; terms needed.")
    core = p.cat_slug in ("sauna-infrared", "sauna-traditional", "sauna-hybrid", "ice-bath", "red-light", "heaters-controls")
    if core and not p.rec["warranty"] and p.cat_slug != "bundles":
        flags.add("gap", p, "warranty", "No warranty terms on the spec sheet.")
    if core and not p.rec["manual"] and p.cat_slug != "bundles":
        flags.add("gap", p, "install", "No product manual linked.")
    if p.cat_slug == "sauna-infrared":
        note = lib_notes.get("Infrared Sauna", "")
        if "600mm front" in note and "Unobstructed Front Access" in p.rec["general"]:
            flags.add("conflict", p, "install", "Product says 'Unobstructed Front Access'; the Infrared "
                      "information sheet gives a 600 mm front clearance. Which should we quote?")
        if "65°C cutoff" in note and re.search(r"30 to 70°C", p.rec["general"]):
            flags.add("check", p, "specs", "Temperature range 30–70°C; the Infrared information sheet gives a "
                      "65°C cut-off and 42–54°C recommended. Confirm the maximum to quote.")
    if re.search(r"\blow emf\b", p.rec["general"], re.I):
        flags.add("claim", p, "specs", "Says 'Low EMF'. Approved EMF wording needed (see compliance/ EMF cards).")
    if re.search(r"Cost p/h", p.rec["electrical"]):
        flags.add("claim", p, "electrical", "Running-cost claim (`Cost p/h`). Confirm the tariff it assumes before it goes live.")
    if p.cat_slug != "bundles" and not (p.rec["general"] or p.rec["dimensions"]):
        flags.add("gap", p, "specs", "No specs on the spec sheet.")


# ----------------------------------------------------------------- main

def link_components(products: list[Product], flags: Flags):
    comp_pool = [c for c in products if c.cat_slug == "heaters-controls" or c.type == "Chiller"]
    base_pool = [c for c in products if c.cat_slug in ("sauna-infrared", "sauna-traditional", "sauna-hybrid", "ice-bath")
                 and c.type != "Chiller"]
    xenio = {("wifi" if "non" not in c.name.lower() else "non-wifi"): c
             for c in products if "xenio" in c.name.lower()}
    for p in products:
        if p.cat_slug not in ("sauna-traditional", "sauna-hybrid", "ice-bath", "bundles") or p.type == "Chiller":
            continue
        pool = comp_pool + (base_pool if p.cat_slug == "bundles" else [])
        for sku in p.skus:
            hits = []
            for c in pool:
                if c is p:
                    continue
                for code in c.codes():
                    if contains_code(sku, code):
                        hits.append((code, c))
            # keep the longest code per component, drop codes inside a longer match
            hits.sort(key=lambda h: -len(h[0]))
            kept = []
            for code, c in hits:
                if any(c is k[1] for k in kept) or any(code in k[0] and code != k[0] for k in kept):
                    continue
                kept.append((code, c))
            p.components[sku] = kept
            toks = norm_sku(sku).split("-")
            if ("XENIO" in toks or "XEN" in toks) and not any("xenio" in c.name.lower() for _, c in kept):
                nonwifi = "NON-WIFI" in norm_sku(sku) or "NO-WIFI" in norm_sku(sku)
                x = xenio.get("non-wifi" if nonwifi else "wifi")
                if x:
                    p.components[sku].append(("XENIO", x))
            names = [c.name.lower() for _, c in p.components[sku]]
            if any("manual" in n and "heater" in n for n in names) and any("xenio" in n for n in names):
                flags.add("check", p, "electrical",
                          f"SKU `{sku}` pairs a manual heater with a Xenio controller (a retrofit, per the Xenio "
                          "card). Confirm this variant ships the manual heater and not the electronic (E) model.")
            for tok, label in (("CHILLERMOB", "Mobile chiller (`CHILLERMOB`): no chiller with this code on the spec sheet"),
                               ("1HP-ICECHILL", "1HP chiller (`1HP-ICECHILL`): which 1HP chiller? Medium (`CHILLER-XY-10-M`) or Zero (`ICECHILL-SY-10-I`)")):
                if tok in norm_sku(sku):
                    p.component_notes.setdefault(sku, []).append(label)
                    flags.add("check", p, "specs", f"SKU `{sku}`: {label}.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("xlsx")
    ap.add_argument("--as-of", required=True, help="date the sheet was received, YYYY-MM-DD")
    ap.add_argument("--root", default=str(ROOT))
    ap.add_argument("--products-js", help="also write the product list for the Brain Inbox page")
    args = ap.parse_args()
    root = Path(args.root)
    cfg = load_config(root)

    wb = openpyxl.load_workbook(args.xlsx, data_only=True, read_only=True)
    rows = list(wb[SHEET].iter_rows(values_only=True))
    lib_notes = {}
    if LIB_SHEET in wb.sheetnames:
        for r in list(wb[LIB_SHEET].iter_rows(values_only=True))[1:]:
            if r and r[0] == "Category Information Sheet":
                lib_notes[clean_cell(r[1])] = clean_cell(r[3])
    info_sheets = {}
    if LIB_SHEET in wb.sheetnames:
        for r in list(wb[LIB_SHEET].iter_rows(values_only=True))[1:]:
            if r and r[0] == "Category Information Sheet":
                info_sheets[clean_cell(r[1])] = clean_cell(r[2])

    flags = Flags()
    products: list[Product] = []
    by_slug: dict[str, Product] = {}
    for i, r in enumerate(rows[1:], start=2):
        rec = {c: clean_cell(v) for c, v in zip(COLS, r)}
        if not rec["product"]:
            continue
        p = Product(i, rec, args.as_of)
        if p.slug in by_slug:
            first = by_slug[p.slug]
            diffs = []
            for col in ("general", "dimensions", "electrical", "warranty"):
                fa = {k: v for sec in getattr(first, col) for k, v in sec["items"] if k}
                fb = {k: v for sec in getattr(p, col) for k, v in sec["items"] if k}
                for k in sorted(set(fa) | set(fb)):
                    if fa.get(k) != fb.get(k):
                        diffs.append(f"{k} `{fa.get(k, '(blank)')}` vs `{fb.get(k, '(blank)')}`")
            keep, drop = (p, first) if (p.skus and p.skus[0].upper().startswith("R-") and
                                        not first.skus[0].upper().startswith("R-")) else (first, p)
            flags.add("conflict", keep, "specs",
                      f"Listed twice on the spec sheet (rows {first.row} and {p.row}, SKUs "
                      f"`{', '.join(first.skus)}` / `{', '.join(p.skus)}`) and they differ: {'; '.join(diffs) or 'no differences'}. "
                      f"Cards use row {keep.row}; confirm which is right and retire the other SKU.")
            by_slug[p.slug] = keep
            products = [x for x in products if x is not first] + [keep]
            continue
        by_slug[p.slug] = p
        products.append(p)

    manual_users = defaultdict(list)
    for p in products:
        if p.rec["manual"]:
            manual_users[p.rec["manual"].split("?")[0]].append(p)
    stop = {"revel", "manual", "a4", "pdf", "sauna", "heater", "electric", "harvia", "product", "v2", "gen"}
    for url, ps in manual_users.items():
        if len(ps) < 2:
            continue
        fname = url.rsplit("/", 1)[-1]
        toks = [t for t in re.split(r"[_\-.]+", fname) if len(t) >= 3 and not t.isdigit()
                and t.lower() not in stop and not re.fullmatch(r"[0-9a-f]{6,}|\d+[a-z]?", t, re.I)]
        for q in ps:
            foreign = [t for t in toks if t.lower() not in q.name.lower()
                       and any(t.lower() in o.name.lower() for o in ps if o is not q)]
            if foreign:
                flags.add("check", q, "install",
                          f"Manual link is `{fname}`, which names {', '.join(foreign)}, not this product. "
                          "Confirm the right manual.")

    link_components(products, flags)
    for p in products:
        check_product(p, flags, lib_notes)

    written = defaultdict(list)
    for p in products:
        info = info_sheets.get(p.sheet_category) or p.rec["info_sheet"]
        info_src = [{"type": "Category information sheet", "ref": info}] if info else []
        if p.cat_slug == "bundles":
            meta = base_meta(p, "specs", cfg, sources_meta(p))
            body = bundle_specs_body(p)
            write_card(root / f"{p.card_id('specs')}.md", meta, body + "\n" + "\n".join(sources_md(meta["source"])))
            written[p.cat_slug].append((p, ["specs"]))
            continue
        topics = []
        if p.rec["general"] or p.rec["dimensions"]:
            topics.append(("specs", specs_body(p), sources_meta(p)))
        if p.rec["electrical"]:
            topics.append(("electrical", electrical_body(p), sources_meta(p)))
        inst = install_items(p)
        if inst:
            topics.append(("install", install_body(p, inst), sources_meta(p, info_src)))
        care = care_items(p)
        if care:
            topics.append(("care", care_body(p, care), sources_meta(p, info_src)))
        if p.rec["warranty"] and not re.search(r"Dimensions|Net Weight", p.rec["warranty"]):
            topics.append(("warranty", warranty_body(p), sources_meta(p)))
        for topic, body, src in topics:
            meta = base_meta(p, topic, cfg, src)
            write_card(root / f"{p.card_id(topic)}.md", meta, body + "\n" + "\n".join(sources_md(src)))
        written[p.cat_slug].append((p, [t for t, _, _ in topics]))

    write_seed_reports(root, cfg, written, flags, args)

    if args.products_js:
        items = [{"name": p.name, "short": p.short, "category": cfg["categories"][p.cat_slug],
                  "id": p.card_dir} for p in sorted(products, key=lambda x: (list(cfg["categories"]).index(x.cat_slug), x.name))]
        Path(args.products_js).write_text(
            "// Generated by _revel-brain/scripts/import_spec_sheet.py. Product list for the Brain Inbox page.\n"
            "window.BRAIN_PRODUCTS = " + json.dumps(items, indent=1, ensure_ascii=False) + ";\n", encoding="utf-8")

    total = sum(len(t) for v in written.values() for _, t in v)
    print(f"{len(products)} products, {total} cards, {len(flags.items)} flags")


KIND_LABEL = {
    "conflict": "Conflict: sources disagree or a value looks wrong",
    "check": "Check: needs a decision before it goes live",
    "claim": "Claims and compliance wording (Ben)",
    "gap": "Gap: missing on the spec sheet",
    "fixed": "Fixed on import (typos only)",
}


def write_seed_reports(root: Path, cfg: dict, written, flags: Flags, args):
    seed = root / "seed"
    seed.mkdir(exist_ok=True)
    for cat, items in written.items():
        label = cfg["categories"][cat]
        n_cards = sum(len(t) for _, t in items)
        lines = [f"## Seed: {label} ({len(items)} products, {n_cards} cards)", "",
                 f"Draft cards created from **Revel Product Spec Sheets.xlsx** (received {args.as_of}) "
                 "by `scripts/import_spec_sheet.py`. Facts are copied as written on the sheet. Prices are "
                 "left out on purpose: Shopify stays the source of truth for price.", "",
                 "Every card is `status: In review`. When both approvers sign off and this merges, the "
                 "stamp workflow sets them Live with the approval date.", "",
                 "### Products", "", "| Product | SKUs | Cards |", "|---|---|---|"]
        for p, topics in sorted(items, key=lambda x: x[0].name):
            lines.append(f"| {p.name} | {len(p.skus)} | {', '.join(topics)} |")
        lines.append("")
        deps = sorted({c.cat_slug for p, _ in items for comps in p.components.values() for _, c in comps
                       if c.cat_slug != cat})
        if deps:
            names = [cfg["categories"][d] for d in deps]
            joined = names[0] if len(names) == 1 else ", ".join(names[:-1]) + " and " + names[-1]
            plural = len(names) > 1
            lines += [f"**Merge order:** these cards link to cards in the {joined} seed PR{'s' if plural else ''}. "
                      f"Merge {'those' if plural else 'that one'} first so the links work.", ""]
        cat_flags = [f for f in flags.items if f["cat"] == cat]
        lines += ["### What needs your attention", ""]
        if not cat_flags:
            lines += ["Nothing flagged.", ""]
        for kind in ("conflict", "check", "claim", "gap"):
            fs = [f for f in cat_flags if f["kind"] == kind]
            if not fs:
                continue
            lines += [f"**{KIND_LABEL[kind]}**", ""]
            groups = {}
            for f in fs:
                groups.setdefault((f["topic"], f["text"]), []).append(f)
            for (topic, text), g in groups.items():
                who = ", ".join(f"{f['product']} (row {f['row']})" for f in g)
                t = f" · {topic}" if topic else ""
                lines.append(f"- [ ] **{who}**{t}: {text}")
            lines.append("")
        fixed = [f for f in cat_flags if f["kind"] == "fixed"]
        if fixed:
            lines += [f"**{KIND_LABEL['fixed']}**", ""]
            groups = {}
            for f in fixed:
                groups.setdefault(f["text"], []).append(f"{f['product']} (row {f['row']})")
            for text, who in groups.items():
                lines.append(f"- {text.replace('Typo fixed on import (', '').rstrip(').')}: {', '.join(who)}")
            lines.append("")
        lines += ["### Approver checklist", ""]
        for a in cfg["approvers"]:
            lines.append(f"**{a['name']}**")
            lines += [f"- [ ] {c}" for c in a["checks"]]
            lines.append("")
        (seed / f"{cat}.md").write_text("\n".join(lines), encoding="utf-8")
    # One machine-readable list for scripts and the summary.
    (seed / "flags.json").write_text(json.dumps(flags.items, indent=1, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
