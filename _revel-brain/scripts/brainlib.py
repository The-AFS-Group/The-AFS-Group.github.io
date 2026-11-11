"""Shared helpers for the Revel Wellness Brain scripts.

A card is a Markdown file with YAML front matter. Front matter is always written
by dump_card() so key order and formatting stay identical across every card,
which keeps pull-request diffs small and readable.
"""
from __future__ import annotations

import datetime as dt
import os
import re
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent

# Folders that hold cards. Everything else (scripts, sources, docs) is ignored.
CARD_FOLDERS = ("cards", "compliance", "policies", "faq", "internal")

# Front matter key order. Unknown keys are kept, after these.
KEY_ORDER = [
    "id", "title", "product", "skus", "category", "type", "topic", "markets",
    "audience", "applies_to", "source", "approved_by", "approved_on",
    "approval_pr", "review_by", "review_months", "status",
]

APPROVAL_KEYS = ("approved_by", "approved_on", "approval_pr", "review_by")


def load_config(root: Path = ROOT) -> dict:
    with open(root / "brain.config.yml", encoding="utf-8") as f:
        return yaml.safe_load(f)


class Card:
    def __init__(self, path: Path, meta: dict, body: str, root: Path = ROOT):
        self.path = path
        self.meta = meta
        self.body = body
        self.root = root

    @property
    def rel(self) -> str:
        return self.path.relative_to(self.root).as_posix()

    @property
    def expected_id(self) -> str:
        return self.rel[:-3] if self.rel.endswith(".md") else self.rel

    @property
    def folder(self) -> str:
        return self.rel.split("/", 1)[0]

    def get(self, key, default=None):
        return self.meta.get(key, default)


FM_RE = re.compile(r"\A---\n(.*?)\n---\n?(.*)\Z", re.S)


def parse_card_text(text: str) -> tuple[dict, str]:
    m = FM_RE.match(text)
    if not m:
        raise ValueError("missing front matter (file must start with ---)")
    meta = yaml.safe_load(m.group(1)) or {}
    if not isinstance(meta, dict):
        raise ValueError("front matter is not a key: value map")
    # YAML turns 2026-11-11 into a date; keep dates as plain strings.
    for k, v in list(meta.items()):
        if isinstance(v, (dt.date, dt.datetime)):
            meta[k] = v.isoformat()[:10]
    return meta, m.group(2)


def read_card(path: Path, root: Path = ROOT) -> Card:
    meta, body = parse_card_text(path.read_text(encoding="utf-8"))
    return Card(path, meta, body, root)


def iter_card_paths(root: Path = ROOT):
    for folder in CARD_FOLDERS:
        base = root / folder
        if not base.exists():
            continue
        for p in sorted(base.rglob("*.md")):
            if p.name.upper() == "README.MD":
                continue
            yield p


def load_cards(root: Path = ROOT) -> tuple[list[Card], list[tuple[str, str]]]:
    cards, errors = [], []
    for p in iter_card_paths(root):
        try:
            cards.append(read_card(p, root))
        except Exception as e:  # noqa: BLE001 - report every bad file, keep going
            errors.append((p.relative_to(root).as_posix(), str(e)))
    return cards, errors


def _ordered(meta: dict) -> dict:
    out = {k: meta[k] for k in KEY_ORDER if k in meta}
    for k, v in meta.items():
        if k not in out:
            out[k] = v
    return out


class _Dumper(yaml.SafeDumper):
    pass


def _str_rep(dumper, data):
    if "\n" in data:
        return dumper.represent_scalar("tag:yaml.org,2002:str", data, style="|")
    return dumper.represent_scalar("tag:yaml.org,2002:str", data)


_Dumper.add_representer(str, _str_rep)


def dump_front_matter(meta: dict) -> str:
    text = yaml.dump(
        _ordered(meta), Dumper=_Dumper, default_flow_style=None, sort_keys=False,
        allow_unicode=True, width=4096,
    )
    return "---\n" + text + "---\n"


def dump_card(meta: dict, body: str) -> str:
    body = body.lstrip("\n")
    return dump_front_matter(meta) + "\n" + body.rstrip() + "\n"


def write_card(path: Path, meta: dict, body: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(dump_card(meta, body), encoding="utf-8")


def today(tz: str = "Australia/Brisbane") -> str:
    os.environ.setdefault("TZ", tz)
    try:
        import time
        time.tzset()
    except AttributeError:
        pass
    return dt.date.today().isoformat()


def add_months(iso_date: str, months: int) -> str:
    d = dt.date.fromisoformat(iso_date)
    y, m = divmod(d.month - 1 + months, 12)
    y += d.year
    m += 1
    # clamp day (e.g. 31 Jan + 1 month -> 28/29 Feb)
    for day in (d.day, 30, 29, 28):
        try:
            return dt.date(y, m, day).isoformat()
        except ValueError:
            continue
    raise ValueError(iso_date)


def slugify(text: str) -> str:
    s = text.lower()
    s = s.replace("&", " and ").replace("+", " plus ")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")
