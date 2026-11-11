#!/usr/bin/env python3
"""Turn submitted files into plain text Claude can read, before drafting.

    python3 scripts/extract_text.py --out .brain/work sources/inbox/BRAIN-0007 [more dirs or files]

Writes one .txt per file plus manifest.md. PDFs need `pdftotext` (poppler-utils).
Unknown types are listed in the manifest so Claude can open them directly (images, PDFs).
This runs before Claude, so Claude needs no shell access to read spreadsheets or Word files.
"""
from __future__ import annotations

import argparse
import csv
import shutil
import subprocess
from pathlib import Path


def pdf(p: Path) -> str:
    if not shutil.which("pdftotext"):
        return "(pdftotext not installed: open the PDF directly)"
    r = subprocess.run(["pdftotext", "-layout", str(p), "-"], capture_output=True, text=True, timeout=120)
    text = r.stdout.strip()
    return text or "(no text layer: scanned PDF. Open it directly to read the pages as images.)"


def xlsx(p: Path) -> str:
    import openpyxl
    wb = openpyxl.load_workbook(p, data_only=True, read_only=True)
    out = []
    for ws in wb.worksheets:
        out.append(f"=== Sheet: {ws.title}")
        for i, row in enumerate(ws.iter_rows(values_only=True), start=1):
            if any(c is not None and str(c).strip() for c in row):
                cells = ["" if c is None else str(c).replace("\n", " / ") for c in row]
                out.append(f"[row {i}] " + " | ".join(cells))
    return "\n".join(out)


def csv_text(p: Path) -> str:
    with open(p, newline="", encoding="utf-8", errors="replace") as f:
        return "\n".join(f"[row {i}] " + " | ".join(r) for i, r in enumerate(csv.reader(f), start=1))


def docx(p: Path) -> str:
    import docx as d
    doc = d.Document(str(p))
    out = [para.text for para in doc.paragraphs if para.text.strip()]
    for ti, table in enumerate(doc.tables, start=1):
        out.append(f"=== Table {ti}")
        for row in table.rows:
            out.append(" | ".join(c.text.strip().replace("\n", " / ") for c in row.cells))
    return "\n".join(out)


HANDLERS = {".pdf": pdf, ".xlsx": xlsx, ".xlsm": xlsx, ".csv": csv_text, ".docx": docx,
            ".txt": lambda p: p.read_text(errors="replace"), ".md": lambda p: p.read_text(errors="replace"),
            ".json": lambda p: p.read_text(errors="replace"), ".eml": lambda p: p.read_text(errors="replace")}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("paths", nargs="*")
    args = ap.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    files = []
    for p in map(Path, args.paths):
        if p.is_dir():
            files += sorted(x for x in p.rglob("*") if x.is_file())
        elif p.is_file():
            files.append(p)
    lines = ["# Files to read", "", "| File | Size | Text extract |", "|---|---|---|"]
    for f in files:
        h = HANDLERS.get(f.suffix.lower())
        size = f"{f.stat().st_size / 1024:.0f} KB"
        if not h:
            lines.append(f"| `{f}` | {size} | none: open the file directly |")
            continue
        try:
            text = h(f)
        except Exception as e:  # noqa: BLE001 - one bad file must not stop the run
            text = f"(could not extract: {e}. Open the file directly.)"
        target = out / (f.name + ".txt")
        target.write_text(text, encoding="utf-8")
        lines.append(f"| `{f}` | {size} | `{target}` ({len(text):,} chars) |")
    if not files:
        lines.append("| (no files: the request is text only) | | |")
    (out / "manifest.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"{len(files)} file(s) extracted to {out}")


if __name__ == "__main__":
    main()
