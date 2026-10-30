#!/usr/bin/env python3
"""Build the site logo from the designed cohort fedora.

The gear section keeps its own files. This script only writes the logo slot,
the favicon tiles, and the social card. The edge is pulled back so the dark
cut-out fringe does not show on a light header or a dark one.
"""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "assets" / "gear" / "bootcamp-hat.png"
OUT = ROOT / "public" / "assets" / "logo"
FOREST = (14, 42, 30, 255)
FONT = ROOT / "scripts" / "brand" / "Poppins-Black.ttf"


def defringe(image: Image.Image) -> Image.Image:
    pixels = np.array(image.convert("RGBA"))
    rgb = pixels[..., :3].astype(np.float32)
    alpha = pixels[..., 3].astype(np.float32)
    weight = (alpha > 235).astype(np.float32)
    colour = rgb * weight[..., None]
    for _ in range(12):
        colour = cv2.blur(colour, (5, 5))
        weight = cv2.blur(weight, (5, 5))
    filled = colour / np.maximum(weight[..., None], 1e-3)
    soft = alpha < 245
    rgb[soft] = filled[soft]
    # Drop the outer ring. It is mostly the old background, not felt.
    kernel = np.ones((3, 3), np.uint8)
    core = cv2.erode((alpha > 40).astype(np.uint8), kernel, iterations=1)
    alpha = np.where(core > 0, alpha, 0).astype(np.float32)
    alpha = cv2.GaussianBlur(alpha, (3, 3), 0)
    alpha[alpha < 8] = 0
    pixels[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    pixels[..., 3] = np.clip(alpha, 0, 255).astype(np.uint8)
    return Image.fromarray(pixels, "RGBA")


def trim(image: Image.Image, pad: int = 8) -> Image.Image:
    alpha = np.array(image.split()[-1])
    ys, xs = np.where(alpha > 12)
    x0 = max(0, int(xs.min()) - pad)
    y0 = max(0, int(ys.min()) - pad)
    x1 = min(image.width, int(xs.max()) + pad + 1)
    y1 = min(image.height, int(ys.max()) + pad + 1)
    return image.crop((x0, y0, x1, y1))


def fit(image: Image.Image, width: int) -> Image.Image:
    if image.width <= width:
        return image
    height = max(1, round(image.height * width / image.width))
    return image.resize((width, height), Image.Resampling.LANCZOS)


def on_forest(hat: Image.Image, size: int, coverage: float) -> Image.Image:
    tile = Image.new("RGBA", (size, size), FOREST)
    target = max(1, round(size * coverage))
    scale = target / hat.width
    resized = hat.resize((target, max(1, round(hat.height * scale))), Image.Resampling.LANCZOS)
    if resized.height > size - 2:
        scale = (size - 2) / hat.height
        resized = hat.resize((max(1, round(hat.width * scale)), size - 2), Image.Resampling.LANCZOS)
    x = (size - resized.width) // 2
    y = (size - resized.height) // 2
    tile.alpha_composite(resized, (x, y))
    return tile


def social(hat: Image.Image) -> Image.Image:
    card = Image.new("RGB", (1200, 630), FOREST[:3])
    placed = fit(hat, 760)
    card_rgba = card.convert("RGBA")
    card_rgba.alpha_composite(placed, ((1200 - placed.width) // 2, (630 - placed.height) // 2 - 24))
    draw = ImageDraw.Draw(card_rgba)
    font = ImageFont.truetype(str(FONT), 28)
    text = "2026 CYBERSECURITY BOOTCAMP"
    draw.text(((1200 - draw.textlength(text, font=font)) / 2, 548), text, font=font, fill=(198, 242, 109, 255))
    return card_rgba.convert("RGB")


def main() -> None:
    hat = trim(defringe(Image.open(SOURCE)))
    hat = fit(hat, 840)
    OUT.mkdir(parents=True, exist_ok=True)
    hat.save(OUT / "community-badge.png", "PNG", optimize=True)
    hat.save(OUT / "community-badge.webp", "WEBP", quality=80, method=6)
    hat.save(OUT / "community-badge-bare.png", "PNG", optimize=True)
    hat.save(OUT / "community-badge-bare.webp", "WEBP", quality=80, method=6)
    on_forest(hat, 16, 0.92).convert("RGB").save(OUT / "favicon-16.png", "PNG", optimize=True)
    on_forest(hat, 32, 0.92).convert("RGB").save(OUT / "favicon-32.png", "PNG", optimize=True)
    on_forest(hat, 180, 0.88).convert("RGB").save(OUT / "apple-touch-icon.png", "PNG", optimize=True)
    on_forest(hat, 192, 0.88).convert("RGB").save(OUT / "community-badge-mark.png", "PNG", optimize=True)
    social(hat).save(OUT / "og-image.png", "PNG", optimize=True)
    # Edge check composites. Not shipped.
    for name, colour in (("paper", (246, 247, 242)), ("forest", FOREST[:3]), ("white", (255, 255, 255))):
        board = Image.new("RGB", hat.size, colour)
        board.paste(hat, mask=hat.split()[-1])
        board.save(f"/tmp/hat-logo-{name}.png")
    print(f"logo {hat.size} png { (OUT / 'community-badge.png').stat().st_size } webp { (OUT / 'community-badge.webp').stat().st_size }")


if __name__ == "__main__":
    main()
