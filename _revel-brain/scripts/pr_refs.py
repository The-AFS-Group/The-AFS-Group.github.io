#!/usr/bin/env python3
"""Print the Brain Inbox refs (BRAIN-0007 ...) recorded in a PR or issue body, space separated.

    gh pr view 12 --json body --jq .body | python3 scripts/pr_refs.py
"""
import re
import sys

text = sys.stdin.read()
refs = []
for m in re.finditer(r"<!--\s*brain-(?:refs|inbox)\b([^>]*)-->", text):
    refs += re.findall(r"BRAIN-\d{4,}", m.group(1))
print(" ".join(dict.fromkeys(refs)))
