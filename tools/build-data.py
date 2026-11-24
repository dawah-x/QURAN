#!/usr/bin/env python3
"""Regenerate assets/quran-data.js from data/Quran_text.csv.

The CSV is the source of truth (columns: id, sura, aya, uthmani). The generated
JS file assigns window.QURAN = { meta, counts, verses } where verses[s-1][a-1]
is the Uthmani text of that ayah. Run after editing the CSV:

    python3 tools/build-data.py
"""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "data" / "Quran_text.csv"
OUT_PATH = ROOT / "assets" / "quran-data.js"
SURAH_COUNT = 114


def main():
    with CSV_PATH.open(encoding="utf-8", newline="") as fh:
        rows = list(csv.DictReader(fh))

    surahs = [[] for _ in range(SURAH_COUNT)]
    for i, row in enumerate(rows, 1):
        s = int(row["sura"])
        a = int(row["aya"])
        assert 1 <= s <= SURAH_COUNT, f"bad sura in row {i}"
        assert int(row["id"]) == i, f"non-sequential id in row {i}"
        assert a == len(surahs[s - 1]) + 1, f"non-sequential aya at {s}:{a}"
        surahs[s - 1].append(row["uthmani"])

    total = sum(len(v) for v in surahs)
    assert total == len(rows), "verse count mismatch"
    payload = {
        "meta": {
            "source": "Quran_text.csv (Uthmani / Hafs reading)",
            "surahCount": SURAH_COUNT,
            "verseCount": total,
            "font": "KFGQPC HAFS Uthmanic Script",
        },
        "counts": [len(v) for v in surahs],
        "verses": surahs,
    }

    OUT_PATH.write_text(
        "/* Generated from data/Quran_text.csv (%s Uthmani verses). Do not edit by hand. */\n"
        % format(total, ",")
        + "window.QURAN = "
        + json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUT_PATH.relative_to(ROOT)}: {SURAH_COUNT} surahs, {total} verses, "
          f"{OUT_PATH.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
