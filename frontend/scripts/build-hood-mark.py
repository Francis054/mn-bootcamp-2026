#!/usr/bin/env python3
"""Rasterise the original hood mark for favicons and the social card.

The drawing is frontend/src/components/hood-mark.svg. Strokes follow the page
colour. These files bake the on-dark version: paper lines on forest, lime screen.
"""
from __future__ import annotations

from io import BytesIO
from pathlib import Path

import cairosvg
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SVG = ROOT / "src" / "components" / "hood-mark.svg"
OUT = ROOT / "public" / "assets" / "logo"
FONT = ROOT / "scripts" / "brand" / "Poppins-Black.ttf"
FOREST = (14, 42, 30)
PAPER = "#F6F7F2"
INK = "#0F1A14"


def png_of(color: str, size: int) -> Image.Image:
    svg = SVG.read_text(encoding="utf-8").replace("currentColor", color)
    raw = cairosvg.svg2png(bytestring=svg.encode(), output_width=size, output_height=size)
    return Image.open(BytesIO(raw)).convert("RGBA")


def on_forest(mark: Image.Image, size: int, pad: int) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (*FOREST, 255))
    art = mark.resize((size - pad * 2, size - pad * 2), Image.Resampling.LANCZOS)
    canvas.alpha_composite(art, (pad, pad))
    return canvas


def social(mark: Image.Image) -> Image.Image:
    width, height = 1200, 630
    card = Image.new("RGBA", (width, height), (*FOREST, 255))
    wash = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(wash)
    draw.ellipse((-180, -240, 560, 420), fill=(136, 204, 0, 46))
    card = Image.alpha_composite(card, wash)
    art = mark.resize((460, 460), Image.Resampling.LANCZOS)
    plate = Image.new("RGBA", (460, 460), (0, 0, 0, 0))
    plate.alpha_composite(art, (0, 0))
    card.alpha_composite(plate, ((width - 460) // 2, 24))
    font = ImageFont.truetype(str(FONT), 40)
    pen = ImageDraw.Draw(card)
    text = "2026 CYBERSECURITY BOOTCAMP"
    pen.text(((width - pen.textlength(text, font=font)) / 2, 520), text, font=font, fill=(136, 204, 0, 255))
    return card.convert("RGB")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    light = png_of(PAPER, 1024)
    badge = on_forest(light, 1024, 96)
    badge.save(OUT / "community-badge.png", "PNG", optimize=True)
    badge.save(OUT / "community-badge.webp", "WEBP", quality=82, method=6)
    badge.save(OUT / "community-badge-bare.png", "PNG", optimize=True)
    badge.save(OUT / "community-badge-bare.webp", "WEBP", quality=82, method=6)
    for size, name, pad in (
        (16, "favicon-16.png", 1),
        (32, "favicon-32.png", 2),
        (180, "apple-touch-icon.png", 18),
        (192, "community-badge-mark.png", 18),
    ):
        on_forest(light, size, pad).convert("RGB").save(OUT / name, "PNG", optimize=True)
        print(f"wrote {name}")
    social(light).save(OUT / "og-image.png", "PNG", optimize=True)
    print(f"community-badge.webp {(OUT / 'community-badge.webp').stat().st_size} bytes")
    print(f"og-image.png {(OUT / 'og-image.png').stat().st_size} bytes")


if __name__ == "__main__":
    main()
