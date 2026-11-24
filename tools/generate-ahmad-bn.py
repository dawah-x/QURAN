#!/usr/bin/env python3
"""Generate one part of the offline Bengali machine-translation snapshot for Musnad Ahmad.

This is a BUILD-TIME tool only. It is run by the manual
`.github/workflows/generate-ahmad-bn.yml` workflow; the shipped web app never
calls a translation service, never uses fetch/XHR, and never downloads a model.
It reads the committed verbatim Arabic snapshot and two locally supplied Argos
Translate / OPUS-MT model packages, then writes deterministic gzip JSON.

    python3 tools/generate-ahmad-bn.py --part 0 --parts 20 \
        --models-dir /tmp/models --out /tmp/part-0.json.gz

The two-hop pipeline is Arabic -> English -> Bengali because the Argos index
has `ar_en` and `en_bn`, but no direct `ar_bn` package. Translation is done
directly with CTranslate2 + SentencePiece (no Stanza/MiniSBD network calls).
Output is explicitly labelled machine translation; the Arabic is authoritative.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import shutil
import sys
import zipfile
from pathlib import Path

import ctranslate2
import sentencepiece as spm

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "data/hadith_v11_sources.json.gz"
EXPECTED_SOURCE_SHA256 = "ae5e788a9bb8b9ade176b1545736735b682460a22bbf6dc8f759db899e59afa7"
EXPECTED_COUNT = 26363
FALLBACK_BN = "এই হাদিসের স্বয়ংক্রিয় বাংলা অনুবাদ তৈরি করা যায়নি; অনুগ্রহ করে আরবি মূল পাঠ দেখুন।"
BN_RANGE = range(0x0980, 0x0A00)


def has_bengali(text: str) -> bool:
    return any(ord(c) in BN_RANGE for c in text)


def find_package(extracted: Path) -> tuple[Path, dict]:
    """Return the directory that has metadata.json + sentencepiece.model."""
    for p in extracted.rglob("metadata.json"):
        pkg = p.parent
        if (pkg / "sentencepiece.model").exists() and (pkg / "model").is_dir():
            meta = json.loads(p.read_text(encoding="utf-8"))
            return pkg, meta
    raise RuntimeError("No Argos package with metadata.json + sentencepiece.model + model/ found")


class DirectTranslator:
    """Minimal offline CTranslate2 translator for one Argos package."""

    def __init__(self, model_zip: Path, workdir: Path):
        if workdir.exists():
            shutil.rmtree(workdir)
        workdir.mkdir(parents=True)
        with zipfile.ZipFile(model_zip) as zf:
            zf.extractall(workdir)
        self.pkg, self.meta = find_package(workdir)
        self.sp = spm.SentencePieceProcessor(model_file=str(self.pkg / "sentencepiece.model"))
        self.translator = ctranslate2.Translator(
            str(self.pkg / "model"),
            device="cpu",
            inter_threads=1,
            intra_threads=0,
            compute_type="auto",
        )
        self.target_prefix = self.meta.get("target_prefix", "") or ""

    def translate(self, text: str, max_chars: int = 180) -> str:
        clean = text.replace("\r", " ").replace("\n", " ").replace("\t", " ")
        chunks = chunk_text(clean, max_chars)
        tokenized = [self.sp.encode(c, out_type=str) for c in chunks]
        prefix = [[self.target_prefix]] * len(tokenized) if self.target_prefix else None
        results = self.translator.translate_batch(
            tokenized,
            target_prefix=prefix,
            replace_unknowns=True,
            max_batch_size=32,
            batch_type="tokens",
            beam_size=1,
            length_penalty=0.2,
            return_scores=False,
        )
        parts: list[str] = []
        for r in results:
            tokens = list(r.hypotheses[0])
            s = self.sp.decode_pieces(tokens).replace("▁", " ").replace("_", " ").strip()
            if s:
                parts.append(s)
        return " ".join(parts)


def chunk_text(text: str, max_chars: int) -> list[str]:
    """Split on word boundaries so a long hadith never exceeds model limits."""
    out: list[str] = []
    cur = ""
    for word in text.split():
        if not word:
            continue
        if len(word) > max_chars:
            if cur:
                out.append(cur)
                cur = ""
            for j in range(0, len(word), max_chars):
                out.append(word[j:j + max_chars])
            continue
        if cur and len(cur) + 1 + len(word) > max_chars:
            out.append(cur)
            cur = word
        else:
            cur = (cur + " " + word).strip()
    if cur:
        out.append(cur)
    return out or [""]


def translate_row(arabic: str, ar_en: DirectTranslator, en_bn: DirectTranslator) -> tuple[str, bool]:
    english = ar_en.translate(arabic)
    bn = en_bn.translate(english)
    if has_bengali(bn) and bn.strip():
        return bn.strip(), False
    # Retry with shorter chunks before giving up.
    english = ar_en.translate(arabic, 90)
    bn = en_bn.translate(english, 90)
    if has_bengali(bn) and bn.strip():
        return bn.strip(), False
    return FALLBACK_BN, True


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--part", type=int, required=True)
    ap.add_argument("--parts", type=int, default=10)
    ap.add_argument("--models-dir", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    if not (0 <= args.part < args.parts):
        print("--part must be in [0, --parts)", file=sys.stderr)
        return 2

    raw = gzip.decompress(SOURCE.read_bytes())
    if hashlib.sha256(raw).hexdigest() != EXPECTED_SOURCE_SHA256:
        print("Arabic source snapshot SHA-256 mismatch", file=sys.stderr)
        return 2
    snap = json.loads(raw.decode("utf-8"))
    rows = snap["elyabany"]["ahmad"]
    if len(rows) != EXPECTED_COUNT:
        print(f"Expected {EXPECTED_COUNT} Ahmad rows, got {len(rows)}", file=sys.stderr)
        return 2

    ar_en = DirectTranslator(args.models_dir / "ar_en.argosmodel", Path("/tmp/argos_ar_en"))
    en_bn = DirectTranslator(args.models_dir / "en_bn.argosmodel", Path("/tmp/argos_en_bn"))

    out_rows: list[list] = []
    fallback = 0
    total = 0
    for i, row in enumerate(rows):
        if i % args.parts != args.part:
            continue
        arabic = row[1] or ""
        bn, failed = translate_row(arabic, ar_en, en_bn)
        fallback += int(failed)
        total += 1
        out_rows.append([i, bn])
        if total % 250 == 0:
            print(f"part {args.part}: {total} rows translated", flush=True)

    payload = json.dumps(out_rows, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_bytes(gzip.compress(payload, compresslevel=9, mtime=0))
    print(f"part {args.part}: wrote {total} rows, {fallback} fallback(s) -> {args.out}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
