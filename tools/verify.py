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
    ok("CACHE = 'dawahx-v5'" in sw and "PRECACHE_ALL" in sw, "service worker caches + full offline download")
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    ok('rel="manifest"' in html and "og:image" in html, "index links manifest + OG image")
    ok("bn-index.js?v=5" in html and "bn-translation.js" not in html,
       "first paint loads the small index, not the full bundle")

    print("\n— licenses & attribution —")
    for name in ("LICENSES/quran-meta-MIT.txt", "LICENSES/NotoSansBengali-OFL.txt"):
        p = ROOT / name
        ok(p.exists() and len(p.read_bytes()) > 500, "license present: " + name)
    credits = (ROOT / "CREDITS.md").read_text(encoding="utf-8")
    for term in ("QuranEnc.com", "v1.1.1", EXPECTED_SHA256, "quran-meta", "Noto Sans Bengali",
                 "SIL Open Font License", "MIT"):
        ok(term in credits, "CREDITS mentions " + term)
    ok("quran-meta" in (ROOT / "assets/app.js").read_text(encoding="utf-8"),
       "app.js credits metadata source in the reader")

    print("\n— JavaScript syntax (all shipped JS) —")
    js = [ROOT / "assets/app.js", ROOT / "assets/surahs.js", ROOT / "assets/quran-data.js",
          ROOT / "assets/quran-meta.js", ROOT / "assets/bn-index.js",
          ROOT / "assets/bn-translation.js", ROOT / "sw.js"]
    js += bn_files + tafsir_files
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
