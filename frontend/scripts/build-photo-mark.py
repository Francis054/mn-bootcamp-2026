#!/usr/bin/env python3
"""Build the photographic community mark from the Pexels source still.

Source: frontend/scripts/brand/white-hat-source.jpg
Page: https://www.pexels.com/photo/man-in-white-crew-neck-shirt-wearing-white-cap-9558722/
License: https://www.pexels.com/license/ (attribution not required)

The crop keeps the white cap, the person, and the green laptop screen, then
grades the still toward forest and lime and sets it in a round badge.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "scripts" / "brand"
OUT = ROOT / "public" / "assets" / "logo"
SOURCE = BRAND / "white-hat-source.jpg"
POPPINS = BRAND / "Poppins-Black.ttf"
SIZE = 1024
LIME = (136, 204, 0, 255)
FOREST = (14, 42, 30, 255)
FOREST_RGB = (10, 31, 22)


def graded_square() -> Image.Image:
    src = Image.open(SOURCE).convert("RGB")
    im = src.crop((180, 280, 1820, 1920)).resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    arr = np.asarray(im).astype(np.float32)
    red, green, blue = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    lum = 0.2126 * red + 0.7152 * green + 0.0722 * blue
    peak = np.maximum(np.maximum(red, green), blue)
    floor = np.minimum(np.minimum(red, green), blue)
    sat = peak - floor
    screen = (green > red + 18) & (green > blue + 8) & (green > 60)

    def curve(channel: np.ndarray) -> np.ndarray:
        x = np.clip((channel / 255.0 - 0.5) * 1.28 + 0.46, 0, 1)
        return x * 255

    rgb = np.stack([curve(red), curve(green), curve(blue)], axis=-1)
    lime = np.array([136, 204, 0], dtype=np.float32)
    weight = screen.astype(np.float32)[..., None]
    rgb = rgb * (1 - 0.72 * weight) + lime * (0.72 * weight)

    neutral = ((sat < 36) & ~screen).astype(np.float32)
    yy, xx = np.mgrid[0:SIZE, 0:SIZE]
    dist = np.sqrt((xx - (SIZE / 2)) ** 2 + (yy - (SIZE / 2)) ** 2) / (SIZE / 2)
    edge = np.clip((dist - 0.35) / 0.55, 0, 1).astype(np.float32)
    forest = np.array([14, 42, 30], dtype=np.float32)
    shade = (0.55 * edge * neutral)[..., None]
    rgb = np.clip(rgb * (1 - shade) + forest * shade, 0, 255).astype(np.uint8)
    # lum is kept so a future tweak can key off the original brightness
    del lum
    return Image.fromarray(rgb, "RGB")


def round_badge(photo: Image.Image) -> Image.Image:
    mask = Image.new("L", (SIZE, SIZE), 0)
    draw = ImageDraw.Draw(mask)
    inset = 36
    draw.ellipse((inset, inset, SIZE - 1 - inset, SIZE - 1 - inset), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(0.6))
    badge = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    badge.paste(photo, (0, 0))
    badge.putalpha(mask)

    ring = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    ring_draw = ImageDraw.Draw(ring)
    ring_draw.ellipse((18, 18, SIZE - 19, SIZE - 19), outline=LIME, width=28)
    ring_draw.ellipse((46, 46, SIZE - 47, SIZE - 47), outline=FOREST, width=8)
    badge = Image.alpha_composite(badge, ring)

    font = ImageFont.truetype(str(POPPINS), 92)
    chip = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    chip_draw = ImageDraw.Draw(chip)
    text = "MN"
    box = chip_draw.textbbox((0, 0), text, font=font)
    text_w, text_h = box[2] - box[0], box[3] - box[1]
    pill_w, pill_h = text_w + 54, text_h + 28
    left = (SIZE - pill_w) // 2
    top = SIZE - inset - pill_h - 36
    chip_draw.rounded_rectangle(
        (left, top, left + pill_w, top + pill_h),
        radius=pill_h // 2,
        fill=(10, 31, 22, 230),
        outline=LIME,
        width=4,
    )
    chip_draw.text((left + 27 - box[0], top + 12 - box[1]), text, font=font, fill=LIME)
    return Image.alpha_composite(badge, chip)


def on_forest(badge: Image.Image, size: int) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (*FOREST_RGB, 255))
    mark = badge.resize((size, size), Image.Resampling.LANCZOS)
    canvas.alpha_composite(mark)
    return canvas.convert("RGB")


def social_card(badge: Image.Image) -> Image.Image:
    width, height = 1200, 630
    card = Image.new("RGBA", (width, height), (*FOREST_RGB, 255))
    wash = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    wash_draw = ImageDraw.Draw(wash)
    wash_draw.ellipse((-180, -240, 560, 420), fill=(136, 204, 0, 46))
    card = Image.alpha_composite(card, wash)
    mark = badge.resize((420, 420), Image.Resampling.LANCZOS)
    card.alpha_composite(mark, ((width - 420) // 2, 36))
    font = ImageFont.truetype(str(POPPINS), 40)
    draw = ImageDraw.Draw(card)
    text = "2026 CYBERSECURITY BOOTCAMP"
    draw.text(((width - draw.textlength(text, font=font)) / 2, 500), text, font=font, fill=LIME)
    return card.convert("RGB")


def save_rgba(image: Image.Image, stem: str) -> None:
    # A 256-colour PNG stays under the logo budget. The WebP keeps the photo.
    image.quantize(colors=256, method=Image.Quantize.FASTOCTREE).save(OUT / f"{stem}.png", "PNG", optimize=True)
    image.save(OUT / f"{stem}.webp", "WEBP", quality=82, method=6)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    badge = round_badge(graded_square())
    save_rgba(badge, "community-badge")
    save_rgba(badge, "community-badge-bare")
    for size, name in (
        (16, "favicon-16.png"),
        (32, "favicon-32.png"),
        (180, "apple-touch-icon.png"),
        (192, "community-badge-mark.png"),
    ):
        on_forest(badge, size).save(OUT / name, "PNG", optimize=True)
        print(f"wrote {name}")
    social_card(badge).save(OUT / "og-image.png", "PNG", optimize=True)
    webp = (OUT / "community-badge.webp").stat().st_size
    png = (OUT / "community-badge.png").stat().st_size
    print(f"community-badge.webp {webp} bytes")
    print(f"community-badge.png {png} bytes")
    print(f"og-image.png {(OUT / 'og-image.png').stat().st_size} bytes")
    if webp > 150_000:
        raise SystemExit(f"community-badge.webp is {webp} bytes, over the 150KB cap")


if __name__ == "__main__":
    main()
