#!/usr/bin/env python3
"""Generate the PWA icons, apple-touch icon and Open Graph card.

Deliberately uses only geometric shapes + Latin letters: PIL here has no
HarfBuzz/Raqm text shaping, so Bengali or Arabic glyphs would be rendered
incorrectly. The Bengali title lives in the HTML meta tags instead.

Build-time only dependency: pillow
  python3 -m pip install pillow
  python3 tools/build-icons.py
"""
from __future__ import annotations

from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    raise SystemExit("build needs: python3 -m pip install pillow")

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets/icons"
OUT.mkdir(parents=True, exist_ok=True)

BG = (7, 21, 26)          # --bg dark teal
BG2 = (10, 32, 38)
GOLD = (212, 175, 106)
GOLD_DIM = (110, 90, 55)
TEAL = (39, 138, 132)
WHITE = (238, 238, 232)


def font(size: int, bold: bool = True):
    for p in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold
        else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ):
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def star(draw: ImageDraw.ImageDraw, cx: float, cy: float, r: float,
         width: int, fill: tuple[int, int, int] | None = None,
         outline: tuple[int, int, int] | None = None) -> None:
    """Eight-point geometric mark (mirrors favicon.svg)."""
    pts = []
    for i in range(8):
        ang = 3.141592653589793 / 4 * i - 3.141592653589793 / 2
        pts.append((cx + r * __import__("math").cos(ang),
                    cy + r * __import__("math").sin(ang)))
    # alternate outer/inner radii -> 8-point star
    pts = []
    for i in range(16):
        ang = 3.141592653589793 / 8 * i - 3.141592653589793 / 2
        rr = r if i % 2 == 0 else r * 0.45
        pts.append((cx + rr * __import__("math").cos(ang),
                    cy + rr * __import__("math").sin(ang)))
    if fill:
        draw.polygon(pts, fill=fill)
    if outline:
        draw.line(pts + [pts[0]], fill=outline, width=width, joint="curve")


def icon(size: int, maskable: bool, path: Path) -> None:
    im = Image.new("RGB", (size, size), BG)
    d = ImageDraw.Draw(im)
    # subtle concentric rings
    for k in range(3):
        rr = size * (0.46 - k * 0.075)
        d.ellipse((size / 2 - rr, size / 2 - rr, size / 2 + rr, size / 2 + rr),
                  outline=(14, 45, 50), width=max(1, size // 220))
    r = size * (0.30 if maskable else 0.36)
    star(d, size / 2, size / 2, r, max(2, size // 90),
         fill=None, outline=GOLD)
    star(d, size / 2, size / 2, r * 0.55, max(1, size // 140),
         fill=None, outline=GOLD_DIM)
    cr = size * 0.038
    d.ellipse((size / 2 - cr, size / 2 - cr, size / 2 + cr, size / 2 + cr), fill=GOLD)
    im.save(path, "PNG", optimize=True)
    print("wrote", path.relative_to(ROOT), path.stat().st_size, "bytes")


def og_card(path: Path) -> None:
    W, H = 1200, 630
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    # two-tone panel
    d.rectangle((0, 0, W, 8), fill=TEAL)
    d.rectangle((0, H - 6, W, H), fill=GOLD_DIM)
    for k in range(6):
        rr = 250 - k * 34
        d.ellipse((910 - rr, 315 - rr, 910 + rr, 315 + rr),
                  outline=(14, 45, 50), width=2)
    star(d, 910, 315, 205, 5, outline=GOLD)
    star(d, 910, 315, 112, 3, outline=GOLD_DIM)
    d.ellipse((910 - 24, 315 - 24, 910 + 24, 315 + 24), fill=GOLD)

    d.text((78, 150), "DAWAH X", font=font(30), fill=TEAL)
    d.text((78, 215), "AL-QUR'AN", font=font(76), fill=WHITE)
    d.text((78, 320), "114 Surah  ·  6,236 Ayah", font=font(30, False), fill=GOLD)
    d.text((78, 375), "Bengali translation & tafsir", font=font(28, False), fill=(168, 184, 184))
    d.rectangle((78, 440, 360, 444), fill=GOLD)
    d.text((78, 470), "Offline first  ·  No ads  ·  No tracking", font=font(24, False), fill=(150, 168, 168))
    im.save(path, "PNG", optimize=True)
    print("wrote", path.relative_to(ROOT), path.stat().st_size, "bytes")


def main() -> None:
    icon(192, False, OUT / "icon-192.png")
    icon(512, False, OUT / "icon-512.png")
    icon(512, True, OUT / "icon-maskable-512.png")
    icon(180, False, OUT / "apple-touch-icon.png")
    og_card(OUT / "og-image.png")


if __name__ == "__main__":
    main()
