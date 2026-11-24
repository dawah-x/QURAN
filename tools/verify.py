#!/usr/bin/env python3
"""One-command integrity check for every shipped asset.

Run locally or in CI (see .github/workflows/ci.yml):
  python3 tools/verify.py

Checks the verbatim QuranEnc snapshot checksum, generated file counts,
Hafs metadata, licenses, PWA files, and JavaScript syntax. It never writes.
"""
from __future__ import annotations

import gzip
import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXPECTED_SHA256 = "dc09d6ed6fbcc943d25599b55685b3d536618accfff9f0ef731895a837d10936"
EXPECTED_HADITH_SHA256 = "bfcf583f42008c22007ec4d5a3fab7c31b76dfa59dc40f53fa422e27cdf55a1a"

failures: list[str] = []
checks = 0


def ok(cond: bool, msg: str) -> None:
    global checks
    checks += 1
    if not cond:
        failures.append(msg)
        print("  ✗ " + msg)
    else:
        print("  ✓ " + msg)


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


def main() -> int:
    print("— verbatim sources —")
    snap = ROOT / "data/quranenc_bengali_zakaria.json.gz"
    ok(snap.exists(), "snapshot exists: " + rel(snap))
    raw = gzip.decompress(snap.read_bytes())
    ok(hashlib.sha256(raw).hexdigest() == EXPECTED_SHA256, "snapshot SHA-256 matches sources.json")
    data = json.loads(raw.decode("utf-8"))
    ok(len(data) == 114, "114 surahs in snapshot")
    ok(sum(len(v) for v in data.values()) == 6236, "6,236 ayahs in snapshot")
    ok(sum(1 for c in data.values() for v in c if (v.get("footnotes") or "").strip()) == 3608,
       "3,608 non-empty tafsir/footnotes")
    ok(all((v.get("text") or "").strip() for c in data.values() for v in c),
       "no empty translations")

    print("\n— verbatim hadith sources —")
    hsnap = ROOT / "data/hadith_fawazahmed0_editions.json.gz"
    ok(hsnap.exists(), "hadith snapshot exists: " + rel(hsnap))
    hraw = gzip.decompress(hsnap.read_bytes())
    ok(hashlib.sha256(hraw).hexdigest() == EXPECTED_HADITH_SHA256,
       "hadith snapshot SHA-256 matches fawazahmed0/hadith-api@1")
    hed = json.loads(hraw.decode("utf-8"))["editions"]
    ok(len(hed) == 6, "six verbatim editions (bn/ar/en × 2 books)")
    ok(len(hed["ben-bukhari"]["hadiths"]) == 7589 and
       len(hed["ben-muslim"]["hadiths"]) == 7563, "7,589 + 7,563 hadiths")
    ok(all(len(hed["ben-" + b]["hadiths"]) == len(hed["ara-" + b]["hadiths"]) ==
           len(hed["eng-" + b]["hadiths"]) for b in ("bukhari", "muslim")),
       "Bengali / Arabic / English editions align")
    ok([x["hadithnumber"] for x in hed["ben-bukhari"]["hadiths"]] ==
       [x["hadithnumber"] for x in hed["ara-bukhari"]["hadiths"]] ==
       [x["hadithnumber"] for x in hed["eng-bukhari"]["hadiths"]],
       "Bukhari numbering identical in all three languages")

    print("\n— generated Bengali assets —")
    idx = ROOT / "assets/bn-index.js"
    bnt = js_window(idx, "BN_TRANSLATION")
    ok(bnt["meta"]["version"] == "1.1.1", "bn-index declares v1.1.1")
    ok(len(bnt["hasNotes"]) == 114, "114 hasNotes rows")
    ok(sum(bool(x) for row in bnt["hasNotes"] for x in row) == 3608, "3,608 notes flagged")
    ok(len(bnt["counts"]) == 114 and sum(bnt["counts"]) == 6236, "counts total 6,236")
    bn_files = sorted((ROOT / "assets/bn").glob("*.js"))
    tafsir_files = sorted((ROOT / "assets/tafsir").glob("*.js"))
    ok(len(bn_files) == 114, "114 lazy translation files")
    ok(len(tafsir_files) == 114, "114 lazy tafsir files")
    ok((ROOT / "assets/bn-translation.js").exists(), "full search bundle exists")
    # compare a few split files against the snapshot
    import re
    for s in (1, 2, 55, 114):
        txt = (ROOT / f"assets/bn/{s}.js").read_text(encoding="utf-8")
        arr = json.loads(re.search(r"=\s*(\[.*\]);", txt, re.S).group(1))
        expected = [r["text"] for r in data[str(s)]]
        ok(arr == expected, f"bn/{s}.js is verbatim")
    ok("window.BN_SURAHS" in idx.read_text(encoding="utf-8"), "bn-index initialises BN_SURAHS")

    print("\n— generated Hadith assets —")
    hi = js_window(ROOT / "assets/hadith-index.js", "HADITH_INDEX")
    ok(hi["version"] == "9", "hadith-index declares v9")
    ok(hi["source"]["license"].startswith("Unlicense") and
       hi["source"]["banglaOrigin"] == "hadithbd.com", "hadith provenance declared")
    ok(len(hi["fields"]) == 8 and hi["fields"][3] == "bn", "8-field compact records")
    ok(set(hi["books"]) == {"bukhari", "muslim"}, "Bukhari + Muslim shipped")
    ok(hi["books"]["bukhari"]["total"] == 7589 and
       hi["books"]["muslim"]["total"] == 7563, "book totals match snapshot")
    hadith_files = sorted((ROOT / "assets/hadith").glob("*/*.js"))
    ok(len(hadith_files) == 154, "154 lazy hadith shards (97 + 57)")
    ok(sum(s["count"] for b in hi["books"].values() for s in b["sections"]) == 15152,
       "section counts total 15,152")
    import re as _re
    for book, sec, pos in (("bukhari", 1, 0), ("muslim", 0, 0), ("muslim", 1, 92)):
        txt = (ROOT / f"assets/hadith/{book}/{sec}.js").read_text(encoding="utf-8")
        arr = json.loads(_re.search(r"=\s*(\[.*\]);", txt, _re.S).group(1))
        ok(arr[0][3] == hed["ben-" + book]["hadiths"][pos]["text"] and
           arr[0][4] == hed["ara-" + book]["hadiths"][pos]["text"] and
           arr[0][5] == hed["eng-" + book]["hadiths"][pos]["text"],
           f"{book}/{sec}.js first record is verbatim in 3 languages")
    html_text = (ROOT / "index.html").read_text(encoding="utf-8")
    ok("hadith-index.js?v=9" in html_text and "window.HADITH_DATA" in
       (ROOT / "assets/hadith-index.js").read_text(encoding="utf-8"),
       "small hadith index loads at boot, data stays lazy")

    print("\n— Hafs metadata —")
    meta = js_window(ROOT / "assets/quran-meta.js", "QURAN_META")
    ok(len(meta["juz"]) == 30 and meta["juz"][0] == 1, "30 juz boundaries, starting at 1")
    ok(len(meta["page"]) == 604 and meta["page"][0] == 1, "604 Mushaf pages, starting at 1")
    ok(len(meta["hizbQuarter"]) == 240, "240 hizb quarters")
    ok(len(meta["sajda"]) == 15, "15 sajda ayahs")
    ok(len(meta["surah"]) == 114, "114 surah metadata rows")
    ok(sum(1 for x in meta["surah"] if x["makki"]) == 86, "86 Makki surahs")
    ok((ROOT / "data/quran-meta-hafs.json").exists(), "verbatim metadata snapshot kept")

    print("\n— fonts, icons, PWA —")
    font = ROOT / "assets/NotoSansBengali.woff2"
    ok(font.exists() and font.read_bytes()[:4] == b"wOF2", "bundled Bengali font is WOFF2")
    for name in ("icon-192.png", "icon-512.png", "icon-maskable-512.png",
                 "apple-touch-icon.png", "og-image.png"):
        p = ROOT / "assets/icons" / name
        ok(p.exists() and p.read_bytes()[:8] == b"\x89PNG\r\n\x1a\n", "PNG: " + name)
    man = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    ok(man["display"] == "standalone" and len(man["icons"]) == 3, "manifest is installable")
    sw = (ROOT / "sw.js").read_text(encoding="utf-8")
    ok("CACHE = 'dawahx-v9'" in sw and "PRECACHE_ALL" in sw, "service worker caches + full offline download")
    ok("assets/hadith/bukhari/1.js?v=9" in sw, "service worker precaches hadith shards")
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    ok('rel="manifest"' in html and "og:image" in html, "index links manifest + OG image")
    ok("bn-index.js?v=9" in html and "hadith-index.js?v=9" in html and
       "bn-translation.js" not in html,
       "first paint loads only the small indexes, not the full bundles")

    print("\n— navigation —")
    ok('data-nav="search"' not in html, "standalone search nav item removed")
    ok('class="nav-home-wrap"' in html and 'data-action="open-search"' in html,
       "tiny search button attached to Home nav button")
    ok("quick-search" in (ROOT / "assets/app.js").read_text(encoding="utf-8"),
       "home quick-search form kept")
    ok('data-nav="hadith"' in html and "renderHadithRoute(r);" in
       (ROOT / "assets/app.js").read_text(encoding="utf-8"),
       "hadith nav item + route wired")
    ok("hadith-search-submit" in (ROOT / "assets/app.js").read_text(encoding="utf-8"),
       "hadith full-text search form wired")

    print("\n— theme —")
    ok('data-theme="dark"' in html, "black & golden dark is the default theme")
    ok('content="#0b0906"' in html, "theme-color matches black & golden")
    css = (ROOT / "assets/style.css").read_text(encoding="utf-8")
    ok("--bg: #0b0906" in css and "--gold: #d4af37" in css and
       "--bg: #faf6ea" in css, "black/gold dark + ivory/gold light palettes shipped")
    ok("--on-accent:" in css and "--on-gold:" in css and "--teal-2:" in css,
       "contrast-safe accent variables defined")
    ok(man.get("theme_color") == "#0b0906" and man.get("background_color") == "#0b0906",
       "manifest colors match black & golden")
    appjs = (ROOT / "assets/app.js").read_text(encoding="utf-8")
    ok("load('theme', 'dark')" in appjs and "'#faf6ea'" in appjs and "'#0b0906'" in appjs,
       "app defaults to black & golden and syncs theme-color")
    ok("title=\"কালো · সোনালি ↔ আইভরি · সোনালি\"" in html, "toggle label describes the pair")

    print("\n— licenses & attribution —")
    for name in ("LICENSES/quran-meta-MIT.txt", "LICENSES/NotoSansBengali-OFL.txt",
                 "LICENSES/hadith-api-Unlicense.txt"):
        p = ROOT / name
        ok(p.exists() and len(p.read_bytes()) > 500, "license present: " + name)
    credits = (ROOT / "CREDITS.md").read_text(encoding="utf-8")
    for term in ("QuranEnc.com", "v1.1.1", EXPECTED_SHA256, "quran-meta", "Noto Sans Bengali",
                 "SIL Open Font License", "MIT", "hadithbd.com", "fawazahmed0/hadith-api",
                 "Unlicense", EXPECTED_HADITH_SHA256):
        ok(term in credits, "CREDITS mentions " + term)
    ok("quran-meta" in (ROOT / "assets/app.js").read_text(encoding="utf-8"),
       "app.js credits metadata source in the reader")

    print("\n— JavaScript syntax (all shipped JS) —")
    js = [ROOT / "assets/app.js", ROOT / "assets/surahs.js", ROOT / "assets/quran-data.js",
          ROOT / "assets/quran-meta.js", ROOT / "assets/bn-index.js",
          ROOT / "assets/bn-translation.js", ROOT / "sw.js"]
    js += bn_files + tafsir_files + [ROOT / "assets/hadith-index.js"] + hadith_files
    bad = []
    for f in js:
        r = subprocess.run(["node", "--check", str(f)], cwd=ROOT,
                           capture_output=True, text=True)
        if r.returncode: bad.append(rel(f) + ": " + r.stderr.strip()[:120])
    ok(not bad, f"node --check on {len(js)} files" + ("" if not bad else " — " + "; ".join(bad[:3])))

    print(f"\n{checks} checks, {len(failures)} failure(s)")
    if failures:
        print("\n".join("  ! " + f for f in failures))
        return 1
    print("ALL OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
