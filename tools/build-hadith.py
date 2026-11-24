#!/usr/bin/env python3
"""Regenerate the offline Hadith library from committed verbatim snapshots.

    python3 tools/build-hadith.py

Sources (both stored verbatim, nothing is fetched at runtime):

  data/hadith_fawazahmed0_editions.json.gz
      6 minified editions from fawazahmed0/hadith-api@1 (Unlicense):
      ben/ara/eng × bukhari/muslim.
  data/hadith_v10_sources.json.gz
      12 more editions (ben/ara/eng × abudawud/tirmidhi/nasai/ibnmajah)
      from the same Unlicense dataset, plus 31 Mishkat chapter files and the
      chapter index from Ebrahim-ead/ead@main (Bengali + Arabic; origin
      muslimbangla.com). See CREDITS.md for licensing/provenance notes.

Outputs (deterministic, byte-identical on every run):

  assets/hadith-index.js          small metadata + section list (loaded at boot)
  assets/hadith/<book>/<sec>.js   one lazy shard per non-empty section

A record is an 8-field array (see FIELDS) so 40,569 hadiths stay compact.
The loader in assets/app.js injects a shard only when a section or a single
hadith is opened; full-text search loads shards in batches on demand.
"""
from __future__ import annotations

import gzip
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SNAPSHOT_FAWAZ = ROOT / "data/hadith_fawazahmed0_editions.json.gz"
SNAPSHOT_V10 = ROOT / "data/hadith_v10_sources.json.gz"
OUT = ROOT / "assets"
VERSION = "10"

FIELDS = ["i", "n", "an", "bn", "ar", "en", "r", "g"]
# i  = 1-based position inside the book (stable deep-link id)
# n  = dataset hadith number (may be fractional, e.g. 1390.2)
# an = dataset arabicnumber = international / canonical hadith number
# bn / ar / en = verbatim Bengali / Arabic / English text
# r  = narrator (derived from Bengali opening, or supplied by the Mishkat data)
# g  = grade (dataset grades / book-level sahih / Mishkat tahqiq label)

BOOKS = {
    "bukhari": {
        "bn": "সহীহ বুখারী", "short": "বুখারী", "ar": "صحيح البخاري",
        "en": "Sahih al-Bukhari", "edition": "তাওহীদ পাবলিকেশন",
        "site": "https://www.hadithbd.com/hadith/bukhari/", "source": "fawaz",
    },
    "muslim": {
        "bn": "সহীহ মুসলিম", "short": "মুসলিম", "ar": "صحيح مسلم",
        "en": "Sahih Muslim", "edition": "হাদীস একাডেমী",
        "site": "https://www.hadithbd.com/hadith/muslim/", "source": "fawaz",
    },
    "abudawud": {
        "bn": "সুনান আবূ দাউদ", "short": "আবূ দাউদ", "ar": "سنن أبي داود",
        "en": "Sunan Abu Dawud", "edition": "আল্লামা আলবানী একাডেমী",
        "site": "https://www.hadithbd.com/hadith/abu-dawud/", "source": "fawaz",
    },
    "tirmidhi": {
        "bn": "জামে আত-তিরমিজী", "short": "তিরমিজী", "ar": "جامع الترمذي",
        "en": "Jami' at-Tirmidhi", "edition": "তাহকীককৃত সংস্করণ",
        "site": "https://www.hadithbd.com/hadith/tirmidhi/", "source": "fawaz",
    },
    "nasai": {
        "bn": "সুনান আন-নাসায়ী", "short": "নাসায়ী", "ar": "سنن النسائي",
        "en": "Sunan an-Nasa'i", "edition": "হাদিস একাডেমি",
        "site": "https://www.hadithbd.com/hadith/nasai/", "source": "fawaz",
    },
    "ibnmajah": {
        "bn": "সুনান ইবনু মাজাহ", "short": "ইবনে মাজাহ", "ar": "سنن ابن ماجه",
        "en": "Sunan Ibn Majah", "edition": "তাওহীদ পাবলিকেশন",
        "site": "https://www.hadithbd.com/hadith/ibn-majah/", "source": "fawaz",
    },
    "mishkat": {
        "bn": "মিশকাতুল মাসাবীহ", "short": "মিশকাত", "ar": "مشكاة المصابيح",
        "en": "Mishkat al-Masabih", "edition": "মুসলিম বাংলা / হাদিস একাডেমি",
        "site": "https://www.hadithbd.com/hadith/mishkat/", "source": "mishkat",
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


def primary_grade(grades) -> str:
    """Pick Al-Albani's grade when present, else the first grader's."""
    if not grades:
        return ""
    if isinstance(grades, str):
        return grades.strip()
    if isinstance(grades, list):
        for g in grades:
            if isinstance(g, dict) and "albani" in str(g.get("name", "")).lower():
                return str(g.get("grade", "")).strip()
        for g in grades:
            if isinstance(g, dict):
                return str(g.get("grade", "")).strip()
            return str(g).strip()
    return ""


def num(value):
    if value is None or isinstance(value, bool):
        return ""
    return value


def section_of(rows):
    """Assign a section id to each row.

    `reference.book` is the section, except that 0 also marks rows whose
    reference is missing. A few rows carry a wrong section number (jumps or
    backwards); those outliers are ignored and the previous section is carried
    forward. The dataset is in reading order.
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


def fawaz_book(book: str, editions: dict):
    ben = editions["ben-" + book]
    ara = editions["ara-" + book]
    eng = editions["eng-" + book]
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
        groups.setdefault(sec, []).append([
            pos,
            num(b.get("hadithnumber")),
            num(b.get("arabicnumber")),
            bn,
            a.get("text") or "",
            e.get("text") or "",
            narrator(bn),
            primary_grade(b.get("grades")),
        ])

    sec_list = []
    for key in sorted(sections, key=int):
        sid = int(key)
        rows = groups.get(sid, [])
        det = details.get(key, {})
        sec_list.append({
            "id": sid,
            "name": sections[key],
            "count": len(rows),
            "first": rows[0][0] if rows else 0,
            "last": rows[-1][0] if rows else 0,
            "hadithFirst": det.get("hadithnumber_first", 0),
            "hadithLast": det.get("hadithnumber_last", 0),
        })
    return sec_list, groups


def mishkat_book(snap_v10: dict):
    chapters = snap_v10["mishkatChapters"]
    index = snap_v10["mishkatIndex"]
    meta = next(b for b in index["books"] if b["slug"] == "mishkat")
    by_id = {c["id"]: c for c in meta["chapters"]}
    sec_list, groups = [], {}
    pos = 0
    for key in sorted(chapters, key=int):
        cid = int(key)
        data = chapters[key]
        verses = data["verses"]
        rows = []
        for v in verses:
            pos += 1
            bn = (v.get("b") or "").replace("**", "")  # 4 stray markup artefacts
            rows.append([
                pos,
                num(v.get("i")),
                "",                      # no separate international number
                bn,
                v.get("a") or "",
                "",                      # no English edition in this source
                (v.get("n") or "").strip(),
                (v.get("g") or "").strip(),
            ])
        groups[cid] = rows
        ch = by_id.get(cid, {})
        sec_list.append({
            "id": cid,
            "name": ch.get("bn") or ("অধ্যায় " + str(cid)),
            "count": len(rows),
            "first": rows[0][0] if rows else 0,
            "last": rows[-1][0] if rows else 0,
            "hadithFirst": ch.get("from", rows[0][1] if rows else 0),
            "hadithLast": ch.get("to", rows[-1][1] if rows else 0),
        })
    return sec_list, groups


def main() -> None:
    s1 = json.loads(gzip.decompress(SNAPSHOT_FAWAZ.read_bytes()).decode("utf-8"))
    s2 = json.loads(gzip.decompress(SNAPSHOT_V10.read_bytes()).decode("utf-8"))
    editions = dict(s1["editions"])
    editions.update(s2["editions"])

    index = {
        "version": VERSION,
        "fields": FIELDS,
        "source": {
            "dataset": "fawazahmed0/hadith-api@1 (Unlicense) + Ebrahim-ead/ead (Mishkat)",
            "license": "Unlicense (six books) / Mishkat: no explicit license — see CREDITS.md",
            "repository": s1["repository"],
            "revision": s1["revision"],
            "banglaOrigin": "hadithbd.com",
            "mishkatOrigin": "muslimbangla.com",
            "note": "বাংলা অনুবাদের মূল উৎস hadithbd.com; ছয় গ্রন্থ fawazahmed0/hadith-api (Unlicense), মিশকাত muslimbangla.com-ভিত্তিক পাবলিক ডেটাসেট থেকে। hadithbd.com থেকে সরাসরি ব্যাপক কপি/স্ক্র্যাপ করা হয়নি। লেখা অপরিবর্তিত।",
        },
        "books": {},
    }

    shards = 0
    for book, info in BOOKS.items():
        if info["source"] == "fawaz":
            sec_list, groups = fawaz_book(book, editions)
            repo = s1["repository"]
        else:
            sec_list, groups = mishkat_book(s2)
            repo = s2["mishkat"]["repository"]

        item = dict(info)
        item.update({
            "id": book,
            "total": sum(s["count"] for s in sec_list),
            "sections": sec_list,
            "shards": sum(1 for s in sec_list if s["count"]),
        })
        index["books"][book] = item

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
                % (book, sec["id"], sec["name"], len(rows), repo,
                   book, sec["id"], payload)
            )
            (folder / ("%d.js" % sec["id"])).write_text(text, encoding="utf-8")
            shards += 1

    head = (
        "/* DAWAH X — Hadith index (v%s). Generated by tools/build-hadith.py;\n"
        "   do not edit by hand. Verbatim data: fawazahmed0/hadith-api@1 (Unlicense)\n"
        "   + Ebrahim-ead/ead (Mishkat, origin muslimbangla.com); Bangla origin\n"
        "   hadithbd.com — see CREDITS.md for the full provenance note. */\n"
        "window.HADITH_DATA={%s};\n"
        "window.HADITH_INDEX=%s;\n" % (
            VERSION,
            ",".join("%s:{}" % b for b in BOOKS),
            json.dumps(index, ensure_ascii=False, separators=(",", ":")))
    )
    (OUT / "hadith-index.js").write_text(head, encoding="utf-8")

    print("hadith-index.js: %d books, %d lazy shards, %d hadiths" % (
        len(index["books"]), shards, sum(b["total"] for b in index["books"].values())))
    for book, b in index["books"].items():
        live = [s for s in b["sections"] if s["count"]]
        print("  %-10s %5d hadiths · %2d shards · sections %d–%d" % (
            book, b["total"], len(live), live[0]["id"], live[-1]["id"]))


if __name__ == "__main__":
    main()
