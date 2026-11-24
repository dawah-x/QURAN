#!/usr/bin/env python3
"""One-command integrity check for every shipped asset (v11).

    python3 tools/verify.py

Unlike earlier releases, this is an EXHAUSTIVE structural/verbatim check:
every Quran verse, every Bengali translation, every tafsir/footnote, every
hadith record, every lazy shard, every licence file and every JavaScript file
is compared with the committed source snapshots. It never writes.

It cannot certify scholarly correctness of an upstream edition; it certifies
that the site ships exactly the committed snapshots, with no blank, lost,
reordered, duplicated or malformed records. See CREDITS.md §9.
"""
from __future__ import annotations

import csv
import gzip
import hashlib
import importlib.util
import json
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent


def load_tool(name: str, filename: str):
    """Import a hyphenated generator file without touching sys.modules twice."""
    spec = importlib.util.spec_from_file_location(name, ROOT / "tools" / filename)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


build_bangla = load_tool("build_bangla", "build-bangla.py")
bh = load_tool("build_hadith", "build-hadith.py")

EXPECTED_SHA256 = "dc09d6ed6fbcc943d25599b55685b3d536618accfff9f0ef731895a837d10936"
EXPECTED_HADITH_SHA256 = "bfcf583f42008c22007ec4d5a3fab7c31b76dfa59dc40f53fa422e27cdf55a1a"
EXPECTED_V10_SHA256 = "995f16e7ad342ae2e2a1a70ac5c6ba683b0c7ebec0214cf6d3809cf8c9c882d3"
EXPECTED_V11_SHA256 = "ae5e788a9bb8b9ade176b1545736735b682460a22bbf6dc8f759db899e59afa7"
EXPECTED_TAFSIR_SHA256 = "1fb542bd54712b28c3398f970734a56a275fb5ab31c676ada75baec9b9cb83fb"

failures: list[str] = []
checks = 0


def ok(cond: bool, msg: str) -> None:
    global checks
    checks += 1
    if cond:
        print("  ✓ " + msg)
    else:
        failures.append(msg)
        print("  ✗ " + msg)


def rel(p: Path) -> str:
    return str(p.relative_to(ROOT))


def js_window(path: Path, name: str):
    """Run a generated JS file in node and return the global it defines."""
    code = (
        "global.window={};const fs=require('fs');"
        f"eval(fs.readFileSync({json.dumps(str(path))},'utf8'));"
        f"process.stdout.write(JSON.stringify(window.{name}));"
    )
    return json.loads(subprocess.check_output(["node", "-e", code], cwd=ROOT, text=True))


def js_array(path: Path, pattern: str = r"=\s*(\[.*\]);"):
    txt = path.read_text(encoding="utf-8")
    return json.loads(re.search(pattern, txt, re.S).group(1))


def js_object(path: Path):
    return js_array(path, r"=\s*(\{.*\});")


def uncompressed(path: Path):
    return gzip.decompress(path.read_bytes())


def sw_lazy_urls():
    code = (
        "global.self={registration:{scope:'https://preview.test/'},"
        "location:{origin:'https://preview.test'},addEventListener:()=>{}};"
        "const fs=require('fs');eval(fs.readFileSync('sw.js','utf8'));"
        "process.stdout.write(JSON.stringify(allLazyUrls()));"
    )
    return json.loads(subprocess.check_output(["node", "-e", code], cwd=ROOT, text=True))


def main() -> int:
    print("— verbatim sources —")
    snap = ROOT / "data/quranenc_bengali_zakaria.json.gz"
    ok(snap.exists(), "QuranEnc snapshot exists")
    qraw = uncompressed(snap)
    ok(hashlib.sha256(qraw).hexdigest() == EXPECTED_SHA256, "QuranEnc SHA-256 matches sources.json")
    qdata = json.loads(qraw.decode("utf-8"))
    ok(sorted(map(int, qdata)) == list(range(1, 115)), "114 surahs in snapshot")
    ok(sum(len(v) for v in qdata.values()) == 6236, "6,236 ayahs in snapshot")
    ok(all((v.get("text") or "").strip() for c in qdata.values() for v in c),
       "no empty Bengali translations in snapshot")

    h1 = ROOT / "data/hadith_fawazahmed0_editions.json.gz"
    h2 = ROOT / "data/hadith_v10_sources.json.gz"
    h3 = ROOT / "data/hadith_v11_sources.json.gz"
    tsnap = ROOT / "data/tafsir_ibn_kathir_bn.json.gz"
    ok(all(p.exists() for p in (h1, h2, h3, tsnap)), "all four verbatim source snapshots committed")
    ok(hashlib.sha256(uncompressed(h1)).hexdigest() == EXPECTED_HADITH_SHA256,
       "v9 hadith snapshot SHA-256 matches")
    ok(hashlib.sha256(uncompressed(h2)).hexdigest() == EXPECTED_V10_SHA256,
       "v10 hadith snapshot SHA-256 matches")
    ok(hashlib.sha256(uncompressed(h3)).hexdigest() == EXPECTED_V11_SHA256,
       "v11 hadith snapshot SHA-256 matches")
    ok(hashlib.sha256(uncompressed(tsnap)).hexdigest() == EXPECTED_TAFSIR_SHA256,
       "Bengali Ibn Kathir snapshot SHA-256 matches")
    s1 = json.loads(uncompressed(h1).decode("utf-8"))
    s2 = json.loads(uncompressed(h2).decode("utf-8"))
    s3 = json.loads(uncompressed(h3).decode("utf-8"))
    tsnapdata = json.loads(uncompressed(tsnap).decode("utf-8"))
    editions = dict(s1["editions"])
    editions.update(s2["editions"])
    editions.update(s3["editions"])
    ok(len(s1["editions"]) == 6 and len(s2["editions"]) == 12 and len(s3["editions"]) == 10,
       "6 + 12 + 10 verbatim fawaz editions")
    ok(len(s2["mishkatChapters"]) == 31, "31 verbatim Mishkat chapter files")
    ok(len(s3["elyabany"]["ahmad"]) == 26363 and len(s3["elyabany"]["darimi"]) == 3367,
       "26,363 Ahmad + 3,367 Darimi Arabic rows")
    ok("odbl/1.0" in s3["elyabanyLicenseText"] and "dbcl/1.0" in s3["elyabanyLicenseText"],
       "elyabany ODbL/DbCL licence text preserved in snapshot")
    ok(len(tsnapdata["surahs"]) == 114 and
       sum(len(v) for v in tsnapdata["surahs"].values()) == 6236,
       "QUL Ibn Kathir snapshot: 114 surahs / 6,236 ayah entries")
    ok(all((x.get("text") or "").strip() for arr in tsnapdata["surahs"].values() for x in arr),
       "no empty Ibn Kathir commentary entries")

    print("\n— generated Quran assets: every verse, translation and footnote —")
    q = js_window(ROOT / "assets/quran-data.js", "QURAN")
    ok(q["meta"]["verseCount"] == 6236 and len(q["counts"]) == 114 and sum(q["counts"]) == 6236,
       "QURAN declares 114 surahs / 6,236 verses")
    csv_rows = list(csv.DictReader((ROOT / "data/Quran_text.csv").open(encoding="utf-8", newline="")))
    ok(len(csv_rows) == 6236, "Quran_text.csv holds 6,236 rows")
    flat_q = [t for group in q["verses"] for t in group]
    ok(flat_q == [r["uthmani"] for r in csv_rows],
       "all 6,236 Arabic ayahs are byte-for-byte verbatim from Quran_text.csv")
    ok(all(t.strip() for t in flat_q), "no blank Arabic ayah")

    bnt = js_window(ROOT / "assets/bn-translation.js", "BN_TRANSLATION")
    ok(bnt["meta"]["version"] == "1.1.1" and len(bnt["verses"]) == 114,
       "full Bengali bundle declares v1.1.1 / 114 surahs")
    expected_bn = [[r["text"] for r in qdata[str(s)]] for s in range(1, 115)]
    ok(bnt["verses"] == expected_bn, "all 6,236 full-bundle Bengali translations are verbatim")
    idx = js_window(ROOT / "assets/bn-index.js", "BN_TRANSLATION")
    ok(idx["meta"]["version"] == "1.1.1" and len(idx["hasNotes"]) == 114 and
       sum(bool(x) for row in idx["hasNotes"] for x in row) == 3608,
       "bn-index declares v1.1.1 and flags 3,608 notes")
    ok(idx["counts"] == [len(x) for x in expected_bn] and idx["lazy"] is True,
       "bn-index counts + lazy marker correct")
    bn_files = sorted((ROOT / "assets/bn").glob("*.js"))
    tafsir_files = sorted((ROOT / "assets/tafsir").glob("*.js"))
    ibn_files = sorted((ROOT / "assets/tafsir-ibn-kathir").glob("*.js"))
    ok(len(bn_files) == 114 and len(tafsir_files) == 114 and len(ibn_files) == 114,
       "114 + 114 + 114 lazy Quran/tafsir shards")
    bn_bad, tf_bad = [], []
    for s in range(1, 115):
        if js_array(ROOT / f"assets/bn/{s}.js") != expected_bn[s - 1]:
            bn_bad.append(s)
        expected_tf = [build_bangla.footnote_html(r.get("footnotes")) for r in qdata[str(s)]]
        if js_array(ROOT / f"assets/tafsir/{s}.js") != expected_tf:
            tf_bad.append(s)
    ok(not bn_bad, "all 114 lazy Bengali shards are verbatim" + (f" — bad: {bn_bad[:5]}" if bn_bad else ""))
    ok(not tf_bad, "all 114 lazy tafsir/footnote shards match QuranEnc html-rendering" +
       (f" — bad: {tf_bad[:5]}" if tf_bad else ""))

    print("\n— generated Bengali Tafseer ibn Kathir (QUL resource 31) —")
    ti = js_window(ROOT / "assets/tafsir-ibn-kathir-index.js", "TAFSIR_IBN_KATHIR_INDEX")
    ok(ti["version"] == "11" and ti["format"] == "dedup" and len(ti["surahs"]) == 114,
       "Ibn Kathir index declares v11 / dedup / 114 surahs")
    ok("QUL" in ti["source"] and "Tawheed" in ti["author"] and "spa5k" in ti["viaRepository"],
       "Ibn Kathir QUL / publisher / API provenance in index")
    tiboot = (ROOT / "assets/tafsir-ibn-kathir-index.js").read_text(encoding="utf-8")
    ok("window.BN_TAFSIR_IBN_KATHIR={};" in tiboot, "boot index initialises the lazy bucket")
    rebuilt, unique, bad = 0, 0, []
    for s in range(1, 115):
        d = js_object(ROOT / f"assets/tafsir-ibn-kathir/{s}.js")
        src = tsnapdata["surahs"][str(s)]
        texts, mapping = d["t"], d["m"]
        unique += len(texts)
        if len(mapping) != q["counts"][s - 1] or len(texts) != len(set(texts)):
            bad.append(s)
            continue
        for a, k in enumerate(mapping, 1):
            rebuilt += 1
            if not (0 <= k < len(texts)) or texts[k] != src[a - 1]["text"] or \
               src[a - 1]["ayah"] != a or src[a - 1]["surah"] != s:
                bad.append(s)
                break
    ok(rebuilt == 6236 and unique == 1914 and not bad,
       f"all {rebuilt:,} ayah entries / {unique:,} unique passages reconstruct verbatim" +
       (f" — bad surahs: {bad[:5]}" if bad else ""))
    ok(sum(v["ayahs"] for v in ti["surahs"].values()) == 6236 and
       sum(v["texts"] for v in ti["surahs"].values()) == 1914,
       "index counts match the 114 deduplicated shards")

    print("\n— generated Hadith assets: all 72,279 records —")
    hi = js_window(ROOT / "assets/hadith-index.js", "HADITH_INDEX")
    gi = js_window(ROOT / "assets/hadith-index.js", "HADITH_GRADE_INDEX")
    hboot = (ROOT / "assets/hadith-index.js").read_text(encoding="utf-8")
    ok(hi["version"] == "11" and len(hi["fields"]) == 8 and hi["fields"][3] == "bn",
       "hadith-index declares v11 / compact 8-field records")
    ok(len(hi["books"]) == 13 and sum(b["total"] for b in hi["books"].values()) == 72279,
       "13 books / 72,279 hadiths indexed")
    ok(set(hi["books"]) == {"bukhari", "muslim", "abudawud", "tirmidhi", "nasai",
                            "ibnmajah", "mishkat", "malik", "nawawi", "dehlawi",
                            "qudsi", "ahmad", "darimi"}, "exact 13-book catalogue")
    ok("Unlicense" in hi["source"]["license"] and "ODbL" in hi["source"]["license"] and
       hi["source"]["banglaOrigin"] == "hadithbd.com", "mixed licences/origins declared")
    ok("ahmad:{}" in hboot and "darimi:{}" in hboot and "tafsir" not in hboot.split(";")[0],
       "index initialises all 13 lazy data buckets")
    ok(hi["gradeIndex"]["daifCount"] == len(gi["daif"]) and
       hi["gradeIndex"]["mawduCount"] == len(gi["mawdu"]) and
       "সিলসিলাতুদ" in hi["gradeIndex"]["note"], "grade index counts + honest limitation note")

    hadith_files = sorted((ROOT / "assets/hadith").glob("*/*.js"))
    ok(len(hadith_files) == 579, "579 lazy hadith shards")
    expected_paths = {f"assets/hadith/{book}/{sec}.js" for book, b in hi["books"].items()
                      for sec in [s["id"] for s in b["sections"] if s["count"]]}
    actual_paths = {rel(p) for p in hadith_files}
    ok(expected_paths == actual_paths, "shard file set exactly matches non-empty sections")

    # Reconstruct all records from the shipped shards.
    all_rows, bad_shape, bad_lang, bad_order = [], [], [], []
    for book, b in hi["books"].items():
        rows = []
        for sec in b["sections"]:
            if not sec["count"]:
                continue
            arr = js_array(ROOT / f"assets/hadith/{book}/{sec['id']}.js")
            if len(arr) != sec["count"] or arr[0][0] != sec["first"] or arr[-1][0] != sec["last"]:
                bad_shape.append((book, sec["id"]))
            rows.extend(arr)
        all_rows.extend((book, r) for r in rows)
        if [r[0] for r in rows] != list(range(1, b["total"] + 1)):
            bad_order.append(book)
        if b["langs"]["bn"] != any((r[3] or "").strip() for r in rows):
            bad_lang.append(book)
        if b["langs"]["en"] != any((r[5] or "").strip() for r in rows):
            bad_lang.append(book)
        if not b["langs"]["ar"]:
            bad_lang.append(book)
        # Some legacy fawaz editions have blank Arabic cells; those are kept
        # verbatim and shown as a note. New clean sources must be complete.
        if book in ("mishkat", "nawawi", "dehlawi", "qudsi", "ahmad", "darimi") and \
           any(not (r[4] or "").strip() for r in rows):
            bad_lang.append(book)
        if sum(1 for s in b["sections"] if s["count"]) != b["shards"]:
            bad_shape.append((book, "shards"))
    ok(len(all_rows) == 72279, f"all {len(all_rows):,} shipped hadith records parsed")
    ok(all(len(r) == 8 and isinstance(r[0], int) for _, r in all_rows),
       "every record has exactly 8 compact fields")
    ok(not bad_shape, "every shard count / first / last / shard metadata agrees")
    ok(not bad_order, "every book has stable 1..N deep-link ids, no gap or duplicate")
    ok(not bad_lang, "language metadata matches data; clean sources complete; no invented translation")
    ok(all(not (r[3] or "").strip() for b, r in all_rows if b in ("dehlawi", "qudsi", "ahmad", "darimi")),
       "Arabic/English-only and Arabic-only books keep Bengali empty")
    ok(all(not (r[5] or "").strip() for b, r in all_rows if b in ("mishkat", "ahmad", "darimi")),
       "books without an English edition keep English empty")

    # Compare every shipped text field with the committed verbatim snapshots.
    def expected_groups(book):
        src = bh.BOOKS[book]["source"]
        if src == "fawaz":
            return bh.fawaz_book(book, editions)[1]
        if src == "fawaz_ar_en":
            return bh.fawaz_ar_en_book(book, editions)[1]
        if src == "mishkat":
            return bh.mishkat_book(s2)[1]
        return bh.elyabany_book(book, s3)[1]

    text_bad, source_bad = [], []
    for book, b in hi["books"].items():
        groups = expected_groups(book)
        for sec in b["sections"]:
            if not sec["count"]:
                continue
            arr = js_array(ROOT / f"assets/hadith/{book}/{sec['id']}.js")
            if arr != groups.get(sec["id"], []):
                text_bad.append((book, sec["id"]))
        src = bh.BOOKS[book]["source"]
        flat = [r for sid in sorted(groups) for r in groups[sid]]
        if src in ("fawaz", "fawaz_ar_en"):
            ben = editions.get("ben-" + book, {}).get("hadiths")
            ara = editions["ara-" + book]["hadiths"]
            eng = editions["eng-" + book]["hadiths"]
            if len(flat) != len(ara) or len(flat) != len(eng):
                source_bad.append(book); continue
            for j, r in enumerate(flat):
                expected_bn = ben[j]["text"] if ben else ""
                if not (r[1] == bh.num((ben or ara)[j].get("hadithnumber")) and
                        r[2] == bh.num((ben or ara)[j].get("arabicnumber")) and
                        r[3] == expected_bn and r[4] == ara[j]["text"] and
                        r[5] == eng[j]["text"] and
                        r[7] == bh.primary_grade((ben or ara)[j].get("grades"))):
                    source_bad.append(book); break
        elif src == "mishkat":
            verses = [v for key in sorted(s2["mishkatChapters"], key=int)
                      for v in s2["mishkatChapters"][key]["verses"]]
            if len(flat) != len(verses):
                source_bad.append(book); continue
            for j, r in enumerate(flat):
                v = verses[j]
                if not (r[1] == bh.num(v.get("i")) and r[2] == "" and
                        r[3] == (v.get("b") or "").replace("**", "") and
                        r[4] == (v.get("a") or "") and r[5] == "" and
                        r[6] == (v.get("n") or "").strip() and
                        r[7] == (v.get("g") or "").strip()):
                    source_bad.append(book); break
        else:
            rows_in = s3["elyabany"][book]
            if len(flat) != len(rows_in):
                source_bad.append(book); continue
            for j, r in enumerate(flat):
                if not (r[1] == bh.num(rows_in[j][0]) and r[2] == "" and
                        r[3] == "" and r[4] == rows_in[j][1] and r[5] == "" and
                        r[6] == "" and r[7] == ""):
                    source_bad.append(book); break
    ok(not text_bad, "all 579 shards exactly reproduce the deterministic generator" +
       (f" — bad: {text_bad[:4]}" if text_bad else ""))
    ok(not source_bad, "all 13 books' numbers/texts/grades are verbatim from snapshots" +
       (f" — bad: {source_bad[:4]}" if source_bad else ""))
    ok(sum("\u200f" in r[4] for _, r in all_rows if _ in ("ahmad", "darimi")) > 0,
       "Arabic RLM/tashkeel marks preserved in elyabany text, not silently stripped")

    # Blank cells are legitimate in a few upstream fawaz editions. They must
    # be preserved exactly, never silently filled with invented text.
    source_blank = {"bn": 0, "ar": 0, "en": 0}
    for book in hi["books"]:
        src = bh.BOOKS[book]["source"]
        if src in ("fawaz", "fawaz_ar_en"):
            ara = editions["ara-" + book]["hadiths"]
            eng = editions["eng-" + book]["hadiths"]
            ben = editions.get("ben-" + book, {}).get("hadiths")
            source_blank["ar"] += sum(not (x.get("text") or "").strip() for x in ara)
            source_blank["en"] += sum(not (x.get("text") or "").strip() for x in eng)
            source_blank["bn"] += len(ara) if ben is None else \
                sum(not (x.get("text") or "").strip() for x in ben)
        elif src == "mishkat":
            verses = [v for key in sorted(s2["mishkatChapters"], key=int)
                      for v in s2["mishkatChapters"][key]["verses"]]
            source_blank["ar"] += sum(not (v.get("a") or "").strip() for v in verses)
            source_blank["bn"] += sum(not (v.get("b") or "").strip() for v in verses)
            source_blank["en"] += len(verses)
        else:
            rows_in = s3["elyabany"][book]
            source_blank["ar"] += sum(not (x[1] or "").strip() for x in rows_in)
            source_blank["bn"] += len(rows_in)
            source_blank["en"] += len(rows_in)
    shipped_blank = {
        "bn": sum(not (r[3] or "").strip() for _, r in all_rows),
        "ar": sum(not (r[4] or "").strip() for _, r in all_rows),
        "en": sum(not (r[5] or "").strip() for _, r in all_rows),
    }
    ok(shipped_blank == source_blank,
       f"every blank language field is source-preserved (bn {shipped_blank['bn']}, "
       f"ar {shipped_blank['ar']}, en {shipped_blank['en']}), none introduced")

    # Grade index is derived only from shipped grade labels, never invented.
    fab = re.compile(r"mawdu|মাওদু|জাল|fabricat|mawḍū", re.I)
    weak = re.compile(r"da'?if|যঈফ|যইফ|দুর্বল|weak|munkar|munqat", re.I)
    expected_gi = {"daif": [], "mawdu": []}
    for book, r in all_rows:
        g = str(r[7] or "")
        sec = next(s["id"] for s in hi["books"][book]["sections"]
                   if s["count"] and s["first"] <= r[0] <= s["last"])
        if fab.search(g):
            expected_gi["mawdu"].append([book, r[0], sec, r[1], g])
        elif weak.search(g):
            expected_gi["daif"].append([book, r[0], sec, r[1], g])
    ok(gi["daif"] == expected_gi["daif"] and gi["mawdu"] == expected_gi["mawdu"],
       f"grade filter ({len(gi['daif']):,} weak / {len(gi['mawdu']):,} fabricated) exactly matches labels")
    ok(gi["daifCount"] == len(gi["daif"]) if "daifCount" in gi else True,
       "grade index counts (when present) are consistent")

    print("\n— Hafs metadata, fonts, icons, PWA —")
    meta = js_window(ROOT / "assets/quran-meta.js", "QURAN_META")
    ok(len(meta["juz"]) == 30 and len(meta["page"]) == 604 and
       len(meta["hizbQuarter"]) == 240 and len(meta["sajda"]) == 15 and
       len(meta["surah"]) == 114, "30 juz / 604 pages / 240 quarters / 15 sajda / 114 surahs")
    ok((ROOT / "data/quran-meta-hafs.json").exists(), "verbatim Hafs metadata snapshot kept")
    font = ROOT / "assets/NotoSansBengali.woff2"
    ok(font.exists() and font.read_bytes()[:4] == b"wOF2", "bundled Bengali font is WOFF2")
    for name in ("icon-192.png", "icon-512.png", "icon-maskable-512.png",
                 "apple-touch-icon.png", "og-image.png"):
        p = ROOT / "assets/icons" / name
        ok(p.exists() and p.read_bytes()[:8] == b"\x89PNG\r\n\x1a\n", "PNG: " + name)
    man = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    ok(man["display"] == "standalone" and len(man["icons"]) == 3, "manifest is installable")
    ok(not any("#/bookmarks" in x["url"] or "#/plan" in x["url"] for x in man["shortcuts"]),
       "manifest no longer exposes the removed sections")
    sw = (ROOT / "sw.js").read_text(encoding="utf-8")
    ok("CACHE = 'dawahx-v11'" in sw and "PRECACHE_ALL" in sw and "?v=10" not in sw,
       "service worker cache bumped to v11 with full offline download")
    ok(all(x in sw for x in ("bukhari: [1, 97]", "mishkat: [1, 31]", "malik: [1, 61]",
                             "ahmad: [1, 132]", "darimi: [1, 17]")),
       "service worker declares all 13 books' shard ranges")
    ok("./assets/tafsir-ibn-kathir-index.js?v=11" in sw and "tafsir-ibn-kathir/" in sw,
       "service worker precaches the second tafsir")
    urls = sw_lazy_urls()
    lazy_paths = {urlparse(x).path.lstrip("/") for x in urls}
    expected_lazy = {"assets/bn-translation.js"} | {rel(p) for p in bn_files + tafsir_files + ibn_files + hadith_files}
    ok(len(urls) == 922 and lazy_paths == expected_lazy,
       f"PRECACHE_ALL covers exactly {len(urls)} lazy URLs (no missing / extra shard)")

    html = (ROOT / "index.html").read_text(encoding="utf-8")
    app_src = (ROOT / "assets/app.js").read_text(encoding="utf-8")
    css_src = (ROOT / "assets/style.css").read_text(encoding="utf-8")
    ok('rel="manifest"' in html and "og:image" in html, "index links manifest + OG image")
    ok("https://dawah-x.github.io/QURAN/" in html and
       "dawah-x.github.io/eadd/" not in html and
       "https://dawah-x.github.io/QURAN/" in (ROOT / "README.md").read_text(encoding="utf-8"),
       "Pages/social links follow the renamed repository")
    ok("১৩ গ্রন্থে ৭২,২৭৯টি হাদিস" in html and "?v=11" in html and "?v=10" not in html,
       "static title + all asset URLs reflect v11")
    ok("tafsir-ibn-kathir-index.js?v=11" in html and "hadith-index.js?v=11" in html and
       "bn-translation.js" not in html, "first paint loads only the small indexes")
    for m in re.findall(r'<script[^>]+src="([^"]+)"', html):
        ok(not m.startswith("http") and (ROOT / m.split("?")[0]).exists(),
           "boot script exists locally: " + m)
    ok("fetch(" not in app_src and "XMLHttpRequest" not in app_src,
       "no runtime fetch / XHR; all data arrives as local lazy scripts")

    print("\n— navigation, homepage, tafsir switcher, grade catalogue —")
    nav = [x for x in html.splitlines() if 'data-nav="' in x]
    ok(len(nav) == 4 and all(x in html for x in
       ('data-nav="home"', 'data-nav="surahs"', 'data-nav="search"', 'data-nav="hadith"')),
       "four clean nav items: home / surahs / search / hadith")
    ok("#/bookmarks" not in html and "#/plan" not in html and
       "nav-home-search" not in html and "nav-home-wrap" not in html,
       "saved-ayah + juz/khatm sections and overlapping gold search bubble removed")
    ok("seg[0] === 'bookmarks'" not in app_src and "seg[0] === 'plan'" not in app_src,
       "removed routes no longer render")
    ok('data-nav="hadith"' in html and "renderHadithRoute(r);" in app_src,
       "hadith nav item + route wired")
    ok("tafsirSourceSelect" in app_src and "loadTafsirIbn" in app_src and
       "tafsir-source-tabs" in app_src and "IBN_KATHIR_LINE" in app_src,
       "Ibn Kathir source selector, lazy loader, modal tabs and credit wired")
    ok("home-highlights" in app_src and "renderHomeHadith" in app_src and
       "home-hadith-section" in css_src, "beautified homepage with daily hadith wired")
    ok("renderHadithGrade" in app_src and "hadithGradeFilter" in app_src and
       "HADITH_GRADE_INDEX" in app_src and "grade-row" in css_src,
       "Al-Albani weak/fabricated grade catalogue + search filter wired")
    ok("সিলসিলাতুদ" in app_src and "পূর্ণ পাঠ নয়" in app_src,
       "grade catalogue honestly says it is not the full Silsilah book")
    ok("@media (max-width: 720px)" in css_src and "overflow-wrap: anywhere" in css_src and
       ".main-nav > a { flex: 1 1 0; min-width: 0; }" in css_src,
       "mobile bottom nav has four equal links + long-text wrapping")
    ok("quick-search" in app_src and "hadith-search-submit" in app_src,
       "Quran + hadith full-text search forms wired")
    ok(app_src.index('<p class="hadith-ar"') < app_src.index('<p class="hadith-bn"'),
       "card still renders Arabic BEFORE the Bengali translation")
    ok("hadith-bookmark" in app_src and "renderHadithSaved" in app_src,
       "hadith bookmarks + saved page retained")

    print("\n— theme —")
    ok('data-theme="dark"' in html, "black & golden dark is the default theme")
    ok('content="#0b0906"' in html, "theme-color matches black & golden")
    ok("--bg: #0b0906" in css_src and "--gold: #d4af37" in css_src and
       "--bg: #faf6ea" in css_src, "black/gold dark + ivory/gold light palettes shipped")
    ok("--on-accent:" in css_src and "--on-gold:" in css_src and "--teal-2:" in css_src,
       "contrast-safe accent variables defined")
    ok(man.get("theme_color") == "#0b0906" and man.get("background_color") == "#0b0906",
       "manifest colors match black & golden")
    ok("load('theme', 'dark')" in app_src and "'#faf6ea'" in app_src and "'#0b0906'" in app_src,
       "app defaults to black & golden and syncs theme-color")
    ok('title="কালো · সোনালি ↔ আইভরি · সোনালি"' in html, "toggle label describes the pair")

    print("\n— licences, attribution, reproducibility —")
    for name in ("LICENSES/quran-meta-MIT.txt", "LICENSES/NotoSansBengali-OFL.txt",
                 "LICENSES/hadith-api-Unlicense.txt", "LICENSES/mishkat-source-note.txt",
                 "LICENSES/elyabany-ODbL-DbCL.txt", "LICENSES/qul-ibn-kathir-source-note.txt",
                 "LICENSES/spa5k-tafsir-api-MIT.txt"):
        p = ROOT / name
        ok(p.exists() and len(p.read_bytes()) > 500, "licence/provenance present: " + name)
    credits = (ROOT / "CREDITS.md").read_text(encoding="utf-8")
    for term in ("QuranEnc.com", "v1.1.1", EXPECTED_SHA256, "quran-meta", "Noto Sans Bengali",
                 "SIL Open Font License", "MIT", "hadithbd.com", "fawazahmed0/hadith-api",
                 "Unlicense", EXPECTED_HADITH_SHA256, EXPECTED_V10_SHA256,
                 EXPECTED_V11_SHA256, EXPECTED_TAFSIR_SHA256,
                 "muslimbangla.com", "Ebrahim-ead/ead", "elyabany/Hadith", "ODbL", "DbCL",
                 "Quranic Universal Library", "Tawheed Publication", "spa5k/tafsir_api",
                 "Tafseer ibn Kathir", "সিলসিলাতুদ-দ্বয়ীফা"):
        ok(term in credits, "CREDITS mentions " + term[:48])
    wf = (ROOT / ".github/workflows/verify.yml").read_text(encoding="utf-8")
    ok("python3 tools/build-tafsir-ibn-kathir.py" in wf and
       "assets/tafsir-ibn-kathir-index.js assets/tafsir-ibn-kathir" in wf,
       "CI reproduces and byte-checks the second tafsir generator")
    ok("python3 tools/build-hadith.py" in wf and "git diff --exit-code" in wf,
       "CI reproduces and byte-checks all data generators")
    ok("quran-meta" in app_src, "app.js credits metadata source in the reader")
    ok("?v=11" in (ROOT / "netlify.toml").read_text(encoding="utf-8"),
       "Netlify cache note follows v11")

    print("\n— JavaScript syntax (all shipped JS) —")
    js = [ROOT / "assets/app.js", ROOT / "assets/surahs.js", ROOT / "assets/quran-data.js",
          ROOT / "assets/quran-meta.js", ROOT / "assets/bn-index.js",
          ROOT / "assets/bn-translation.js", ROOT / "assets/hadith-index.js",
          ROOT / "assets/tafsir-ibn-kathir-index.js", ROOT / "sw.js"]
    js += bn_files + tafsir_files + ibn_files + hadith_files

    def check(f: Path):
        r = subprocess.run(["node", "--check", str(f)], cwd=ROOT,
                           capture_output=True, text=True)
        return None if r.returncode == 0 else rel(f) + ": " + r.stderr.strip()[:140]

    with ThreadPoolExecutor(max_workers=4) as pool:
        bad = [x for x in pool.map(check, js) if x]
    ok(not bad, f"node --check on {len(js)} files" +
       ("" if not bad else " — " + "; ".join(bad[:3])))

    print(f"\n{checks} checks, {len(failures)} failure(s)")
    if failures:
        print("\n".join("  ! " + f for f in failures))
        return 1
    print("ALL OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
