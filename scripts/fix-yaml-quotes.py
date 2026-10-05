#!/usr/bin/env python3
"""Authoring helper: quote plain YAML scalars that contain ': ' or ' #' (which would break parsing).
Usage: python3 scripts/fix-yaml-quotes.py content/**/*.yaml"""
import re, sys

KEY = re.compile(r'^(\s*(?:- )?[a-z_]+:\s)(?![|>"\'\[{])(.*)$')
ITEM = re.compile(r'^(\s*- )(?![|>"\'\[{])(.*)$')

def q(v: str) -> str:
    return '"' + v.replace('\\', '\\\\').replace('"', '\\"') + '"'

for path in sys.argv[1:]:
    out, changed, in_block, block_indent = [], 0, False, 0
    for line in open(path, encoding="utf8").read().split("\n"):
        indent = len(line) - len(line.lstrip())
        if in_block:
            if line.strip() == "" or indent > block_indent:
                out.append(line); continue
            in_block = False
        m = KEY.match(line) or ITEM.match(line)
        if m:
            head, val = m.group(1), m.group(2).rstrip()
            if re.match(r'^[a-z_]+:\s', val) and ITEM.match(line) and not KEY.match(line):
                out.append(line)  # "- key: value" handled by KEY
            elif (": " in val or " #" in val or val.endswith(":")) and val:
                line = head + q(val); changed += 1
        if re.search(r':\s*[|>][-+]?\s*$', line):
            in_block, block_indent = True, indent
        out.append(line)
    if changed:
        open(path, "w", encoding="utf8").write("\n".join(out))
        print(f"{path}: quoted {changed} value(s)")
