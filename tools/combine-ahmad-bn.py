#!/usr/bin/env python3
"""Combine the parallel Ahmad Bengali parts into one committed snapshot.

    python3 tools/combine-ahmad-bn.py --parts-dir /tmp/parts \
        --out data/ahmad_bn_argos.json.gz --meta data/ahmad_bn_argos.meta.json

The snapshot is deterministic: JSON is written with fixed separators and is
gzipped with mtime=0. It is a machine-translation artefact, NOT a published or
scholarly Bengali edition. See LICENSES/argos-ahmad-bn-note.txt and CREDITS.md.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXPECTED_COUNT = 26363
EXPECTED_SOURCE_SHA256 = "ae5e788a9bb8b9ade176b1545736735b682460a22bbf6dc8f759db899e59afa7"
FALLBACK_BN = "এই হাদিসের স্বয়ংক্রিয় বাংলা অনুবাদ তৈরি করা যায়নি; অনুগ্রহ করে আরবি মূল পাঠ দেখুন।"
BN_RANGE = range(0x0980, 0x0A00)

MODELS = {
    "ar_en": {
        "package": "translate-ar_en-1_0.argosmodel",
        "package_version": "1.0",
        "argos_version": "1.0",
        "url": "https://data.argosopentech.com/argospm/v1/translate-ar_en-1_0.argosmodel",
        "sha256": "bc98cd4e27ca1cebfae9b7086b2ebc635e4dbed45e7cb5f0891cb7d22feacfad",
        "bytes": 81869670,
        "licence": "Argos model binaries MIT/CC0 (argos-translate issue #533); OPUS OpenSubtitles + UNPC training data; bundled Stanza tokenizer Apache-2.0",
    },
    "en_bn": {
        "package": "translate-en_bn-1_9.argosmodel",
        "package_version": "1.9",
        "argos_version": "1.9.0",
        "url": "https://data.argosopentech.com/argospm/v1/translate-en_bn-1_9.argosmodel",
        "sha256": "2b70f590df0170315323442816391552519b6f0d3aa6c2d1184b562a682465a7",
        "bytes": 70958134,
        "licence": "OPUS-MT / Argos model binaries MIT/CC0; packaged README credits Jörg Tiedemann & Santhosh Thottingal, OPUS-MT (2020), CC BY 4.0",
    },
}


def has_bengali(text: str) -> bool:
    return any(ord(c) in BN_RANGE for c in text)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--parts-dir", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--meta", type=Path, required=True)
    args = ap.parse_args()

    translations: list[str | None] = [None] * EXPECTED_COUNT
    seen: set[int] = set()
    files = sorted(args.parts_dir.glob("part-*.json.gz"))
    if not files:
        print("No part-*.json.gz files found", flush=True)
        return 2
    for p in files:
        part = json.loads(gzip.decompress(p.read_bytes()).decode("utf-8"))
        for i, bn in part:
            if not isinstance(i, int) or not 0 <= i < EXPECTED_COUNT:
                print(f"Bad index {i} in {p}", flush=True)
                return 2
            if i in seen:
                print(f"Duplicate index {i} in {p}", flush=True)
                return 2
            seen.add(i)
            translations[i] = bn

    if len(seen) != EXPECTED_COUNT or any(x is None for x in translations):
        print(f"Missing translations: {EXPECTED_COUNT - len(seen)}", flush=True)
        return 2
    final = [str(x) for x in translations]  # type: ignore[misc]
    bad = [i for i, x in enumerate(final) if not x.strip() or not has_bengali(x)]
    if bad:
        print(f"{len(bad)} rows are empty or have no Bengali script; first: {bad[:5]}", flush=True)
        return 2
    fallback = sum(x == FALLBACK_BN for x in final)

    meta = {
        "generator": "tools/generate-ahmad-bn.py + tools/combine-ahmad-bn.py",
        "workflow": ".github/workflows/generate-ahmad-bn.yml",
        "method": "Argos Translate / OPUS-MT Arabic->English->Bengali, offline CTranslate2 + SentencePiece, beam_size=1, 180-char chunks",
        "source": "elyabany/Hadith Arabic Musnad Ahmad, verbatim in data/hadith_v11_sources.json.gz",
        "source_sha256": EXPECTED_SOURCE_SHA256,
        "count": EXPECTED_COUNT,
        "fallbackCount": fallback,
        "label_bn": "স্বয়ংক্রিয় যান্ত্রিক অনুবাদ",
        "notice_bn": "এটি কোনো প্রকাশিত বা আলেম-তাহকীককৃত বাংলা অনুবাদ নয়; অর্থের জন্য আরবি মূল পাঠ দেখুন।",
        "runtime": "none — snapshot is committed; the app only loads local lazy JS shards",
        "models": MODELS,
    }
    snapshot = {"metadata": meta, "translations": final}
    raw = json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    gz = gzip.compress(raw, compresslevel=9, mtime=0)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_bytes(gz)
    meta_out = {
        "raw_sha256": hashlib.sha256(raw).hexdigest(),
        "gzip_sha256": hashlib.sha256(gz).hexdigest(),
        "gzip_bytes": len(gz),
        "count": EXPECTED_COUNT,
        "fallbackCount": fallback,
        "models": MODELS,
    }
    args.meta.write_text(json.dumps(meta_out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Combined {len(files)} parts -> {EXPECTED_COUNT} Bengali rows, "
          f"{fallback} fallback(s), raw SHA {meta_out['raw_sha256']}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
