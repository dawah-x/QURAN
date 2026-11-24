#!/usr/bin/env python3
"""Regenerate the offline Hadith section from the committed verbatim snapshot.

    python3 tools/build-hadith.py

Source: data/hadith_fawazahmed0_editions.json.gz — an exact snapshot of six
`editions/*.min.json` files from fawazahmed0/hadith-api@1 (Unlicense). The
Bengali translations in that dataset originate from hadithbd.com; we credit
both in CREDITS.md and in the reader. Nothing is fetched at runtime; this
script is a build-time convenience, and the site itself has no build step.

Outputs (all deterministic, byte-identical on every run):

  assets/hadith-index.js          small metadata + section list (loaded at boot)
  assets/hadith/<book>/<sec>.js   one lazy shard per non-empty section

A record is an 8-field array (see FIELDS below) so the 15,152 hadiths stay
compact. The loader in assets/app.js injects a shard only when a section or a
single hadith is opened; full-text search loads them in batches on demand.
"""
from __future__ import annotations

import gzip
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SNAPSHOT = ROOT / "data/hadith_fawazahmed0_editions.json.gz"
OUT = ROOT / "assets"
VERSION = "9"

FIELDS = ["i", "n", "an", "bn", "ar", "en", "r", "g"]
# i  = 1-based position inside the book (stable deep-link id)
# n  = dataset hadithnumber (may be fractional, e.g. 1390.2)
# an = dataset arabicnumber = international / canonical hadith number
# bn / ar / en = verbatim Bengali / Arabic / English text
# r  = narrator, derived conservatively from the Bengali opening (or "")
# g  = dataset grades joined (empty for Bukhari/Muslim; the books are sahih)

BOOKS = {
    "bukhari": {
        "bn": "সহীহ বুখারী",
        "ar": "صحيح البخاري",
        "en": "Sahih al-Bukhari",
        "edition": "তাওহীদ পাবলিকেশন",
        "site": "https://www.hadithbd.com/hadith/bukhari/",
    },
    "muslim": {
        "bn": "সহীহ মুসলিম",
        "ar": "صحيح مسلم",
        "en": "Sahih Muslim",
        "edition": "হাদীস একাডেমী",
        "site": "https://www.hadithbd.com/hadith/muslim/",
    },
}

# Conservative: only the "… (রাঃ) হতে/থেকে বর্ণিত" opening is treated as a
# narrator. No interpretation of the hadith text itself is added.
NARRATOR = re.compile(r"([^।\n]{3,120}?)\s*(?:হতে|থেকে)\s*বর্ণিত")


def narrator(text: str) -> str:
    m = NARRATOR.search(text[:500])
    if not m:
        return ""
    s = re.sub(r"^\s*(?:[০-৯\d]+[.)]\s*)+", "", m.group(1)).strip()
    s = s.strip(" ,;؛،\"'‘’”()[]{}\\/")
    if not s or len(s) > 90 or "আল্লাহ তা'আলার বাণী" in s:
        return ""
    return s


def num(value):
    """Keep numbers as numbers, everything else as a string (or empty)."""
    if value is None:
        return ""
    if isinstance(value, bool):
        return ""
    return value


def section_of(rows):
    """Assign a section id to each row.

    `reference.book` is the section, except that 0 also marks rows whose
    reference is missing. A few Muslim rows carry a wrong section number
    (e.g. 43 in the middle of section 1); those outliers are ignored and the
    previous section is carried forward. The dataset is in reading order.
    """
    out, cur = [], 0
    for row in rows:
        b = (row.get("reference") or {}).get("book") or 0
        try:
            b = int(b)
        except (TypeError, ValueError):
            b = 0
        if b and cur <= b <= cur + 1:
            cur = b
        out.append(cur)
    return out


def main() -> None:
    snap = json.loads(gzip.decompress(SNAPSHOT.read_bytes()).decode("utf-8"))
    eds = snap["editions"]

    index = {
        "version": VERSION,
        "fields": FIELDS,
        "source": {
            "dataset": "fawazahmed0/hadith-api@1",
            "license": "Unlicense (public domain)",
            "repository": snap["repository"],
            "revision": snap["revision"],
            "banglaOrigin": "hadithbd.com",
            "note": "বাংলা অনুবাদের মূল উৎস hadithbd.com; ডেটাসেট fawazahmed0/hadith-api (Unlicense)। hadithbd.com থেকে সরাসরি ব্যাপক কপি/স্ক্র্যাপ করা হয়নি। লেখা অপরিবর্তিত।",
        },
        "books": {},
    }

    shards = 0
    for book, info in BOOKS.items():
        ben = eds["ben-" + book]
        ara = eds["ara-" + book]
        eng = eds["eng-" + book]
        brows, arows, erows = ben["hadiths"], ara["hadiths"], eng["hadiths"]
        assert len(brows) == len(arows) == len(erows), book
        assert [x["hadithnumber"] for x in brows] == [x["hadithnumber"] for x in arows] == \
               [x["hadithnumber"] for x in erows], book + " numbering"
        sections = ben["metadata"]["sections"]
        details = ben["metadata"]["section_details"]
        sec_ids = section_of(brows)

        groups: dict[int, list] = {}
        for pos, (b, a, e, sec) in enumerate(zip(brows, arows, erows, sec_ids), 1):
            bn = b.get("text") or ""
            rec = [
                pos,
                num(b.get("hadithnumber")),
                num(b.get("arabicnumber")),
                bn,
                a.get("text") or "",
                e.get("text") or "",
                narrator(bn),
                " | ".join(str(x) for x in (b.get("grades") or []) if x),
            ]
            groups.setdefault(sec, []).append(rec)

        sec_list = []
        for key in sorted(sections, key=int):
            sid = int(key)
            rows = groups.get(sid, [])
            sec_list.append({
                "id": sid,
                "name": sections[key],
                "count": len(rows),
                "first": rows[0][0] if rows else 0,
                "last": rows[-1][0] if rows else 0,
                "hadithFirst": details.get(key, {}).get("hadithnumber_first", 0),
                "hadithLast": details.get(key, {}).get("hadithnumber_last", 0),
            })

        info = dict(info)
        info.update({
            "id": book,
            "total": len(brows),
            "sections": sec_list,
            "shards": sum(1 for s in sec_list if s["count"]),
        })
        index["books"][book] = info

        folder = OUT / "hadith" / book
        folder.mkdir(parents=True, exist_ok=True)
        for old in folder.glob("*.js"):
            old.unlink()
        for sec in sec_list:
            rows = groups.get(sec["id"], [])
            if not rows:
                continue
            payload = json.dumps(rows, ensure_ascii=False, separators=(",", ":"))
            text = (
                "/* DAWAH X — %s, অধ্যায় %d · %s · %d টি হাদিস · উৎস: %s */\n"
                "window.HADITH_DATA['%s'][%d]=%s;\n"
                % (book, sec["id"], sec["name"], len(rows), snap["repository"],
                   book, sec["id"], payload)
            )
            (folder / ("%d.js" % sec["id"])).write_text(text, encoding="utf-8")
            shards += 1

    head = (
        "/* DAWAH X — Hadith index (v%s). Generated by tools/build-hadith.py;\n"
        "   do not edit by hand. Verbatim data: fawazahmed0/hadith-api@1 (Unlicense),\n"
        "   Bengali translations originate from hadithbd.com — see CREDITS.md. */\n"
        "window.HADITH_DATA={bukhari:{},muslim:{}};\n"
        "window.HADITH_INDEX=%s;\n" % (VERSION, json.dumps(index, ensure_ascii=False, separators=(",", ":")))
    )
    (OUT / "hadith-index.js").write_text(head, encoding="utf-8")

    print("hadith-index.js: %d books, %d lazy shards, %d hadiths" % (
        len(index["books"]), shards, sum(b["total"] for b in index["books"].values())))


if __name__ == "__main__":
    main()
