#!/usr/bin/env python3
"""Build a small variable WOFF2 subset of Noto Sans Bengali for offline use.

Source (SIL OFL 1.1):
  https://github.com/google/fonts/tree/main/ofl/notosansbengali
  data/fonts/NotoSansBengali-VF.ttf  (upstream file: NotoSansBengali[wdth,wght].ttf)
  LICENSES/NotoSansBengali-OFL.txt   (verbatim license)

Only the glyphs this site actually uses are kept, so the whole Bengali UI
font costs ~40 KB instead of 460 KB. The UI never depends on a system Bengali
font again — important for offline / kiosk devices.

Requires fonttools + brotli (build-time only; runtime has no dependencies):
  python3 -m pip install fonttools brotli
  python3 tools/build-font.py
"""
from __future__ import annotations

import gzip
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data/fonts/NotoSansBengali-VF.ttf"
OUT = ROOT / "assets/NotoSansBengali.woff2"

# Ranges the UI font has to cover. Arabic is deliberately excluded: it is
# rendered by the KFGQPC HAFS font, not by this one.
RANGES = (
    (0x0020, 0x007E),   # ASCII (Latin, digits, punctuation)
    (0x00A0, 0x00FF),   # NBSP, Latin-1 punctuation
    (0x0980, 0x09FF),   # Bengali block
    (0x0964, 0x0965),   # danda / double danda (used in quotations)
    (0x2000, 0x206F),   # smart quotes, dashes, ZWNJ/ZWJ, LRM/RLM
    (0x20AC, 0x20AC),   # euro
    (0x2190, 0x21FF),   # arrows used in the UI
    (0x25CF, 0x25CF),   # bullet dot
    (0x2605, 0x2606),   # stars
)


def wanted_codepoints() -> set[int]:
    pts: set[int] = set()
    for lo, hi in RANGES:
        pts.update(range(lo, hi + 1))
    return pts


def repo_text_stats() -> tuple[int, int]:
    """Sanity check: how many distinct Bengali codepoints the data actually uses."""
    used: set[int] = set()
    with gzip.open(ROOT / "data/quranenc_bengali_zakaria.json.gz", "rt", encoding="utf-8") as fh:
        data = json.load(fh)
    for chapter in data.values():
        for v in chapter:
            used.update(ord(c) for c in v.get("text", ""))
            used.update(ord(c) for c in v.get("footnotes", ""))
    for rel in ("assets/app.js", "assets/surahs.js", "index.html", "CREDITS.md"):
        p = ROOT / rel
        if p.exists():
            used.update(ord(c) for c in p.read_text(encoding="utf-8"))
    bengali = {c for c in used if 0x0980 <= c <= 0x09FF}
    missing = bengali - wanted_codepoints()
    return len(bengali), len(missing)


def main() -> int:
    if not SRC.exists():
        sys.exit(f"missing source font: {SRC}")
    try:
        from fontTools.subset import Options, Subsetter
        from fontTools.ttLib import TTFont
    except ImportError:
        sys.exit("build needs: python3 -m pip install fonttools brotli")

    used, missing = repo_text_stats()
    if missing:
        sys.exit(f"uncovered Bengali codepoints: {[hex(c) for c in sorted(missing)]}")

    font = TTFont(SRC)
    opts = Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]          # keep Bengali conjunct/reshaping features
    opts.name_IDs = [1, 2, 3, 4, 6, 16, 17]
    opts.name_legacy = False
    opts.notdef_outline = True
    opts.recalc_bounds = True
    opts.drop_tables += ["DSIG"]
    sub = Subsetter(options=opts)
    sub.populate(unicodes=sorted(wanted_codepoints()))
    sub.subset(font)
    font.flavor = "woff2"
    OUT.parent.mkdir(parents=True, exist_ok=True)
    font.save(OUT)

    cmap = TTFont(OUT).getBestCmap()
    print(f"OK: {OUT.relative_to(ROOT)} — {OUT.stat().st_size:,} bytes, "
          f"{len(cmap)} codepoints, {used} Bengali codepoints used by the data")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
