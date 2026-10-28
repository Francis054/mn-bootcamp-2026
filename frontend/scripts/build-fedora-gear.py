#!/usr/bin/env python3
"""Isolate the cohort fedora and stitch the 2026 mark into the photograph.

The source file is the phone screenshot, kept unchanged. U2Net removes the
pedestal, plaque, vignette and interface. The wording is then warped onto the
crown and the band so it follows the felt, with a thread texture and a soft
shadow. Run from frontend/: python3 scripts/build-fedora-gear.py
"""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from rembg import new_session, remove

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'scripts' / 'brand' / 'white-fedora-source.jpg'
FONT_WOFF = ROOT / 'public' / 'assets' / 'fonts' / 'SpaceGrotesk-latin-ecea81.woff2'
OUT = ROOT / 'public' / 'assets' / 'gear'
FONT_CACHE = Path('/tmp/hat/SpaceGrotesk-600.ttf')

FOREST = (16, 40, 28, 255)
PAPER = (246, 247, 242, 255)
CROP = (90, 600, 700, 980)  # hat only; drops the status bar and the side control
SCALE = 3

# Placement inside the opaque hat, as fractions of its bounding box.
# Tuned against the fedora's front panel and the ribbon left of the metal badge.
CROWN = (0.40, 0.46, 0.78, 0.62)
BAND = (0.22, 0.655, 0.68, 0.755)


def font_path() -> Path:
    if FONT_CACHE.exists():
        return FONT_CACHE
    FONT_CACHE.parent.mkdir(parents=True, exist_ok=True)
    font = TTFont(FONT_WOFF)
    if 'fvar' in font:
        font = instantiateVariableFont(font, {'wght': 600}, inplace=False)
    font.flavor = None
    font.save(FONT_CACHE)
    return FONT_CACHE


def defringe(image: Image.Image) -> Image.Image:
    """Replace semi-transparent edge colours with the nearby felt, not the backdrop."""
    import cv2

    pixels = np.array(image.convert('RGBA'))
    rgb = pixels[..., :3].astype(np.float32)
    alpha = pixels[..., 3]
    weight = (alpha > 240).astype(np.float32)
    colour = rgb * weight[..., None]
    for _ in range(8):
        colour = cv2.blur(colour, (5, 5))
        weight = cv2.blur(weight, (5, 5))
    filled = colour / np.maximum(weight[..., None], 1e-3)
    edge = (alpha > 0) & (alpha < 230)
    rgb[edge] = filled[edge]
    pixels[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    return Image.fromarray(pixels, 'RGBA')


def trim(image: Image.Image, pad: int = 12) -> Image.Image:
    alpha = np.array(image.split()[-1])
    ys, xs = np.where(alpha > 12)
    if len(xs) == 0:
        return image
    x0, x1 = max(0, int(xs.min()) - pad), min(image.width, int(xs.max()) + pad + 1)
    y0, y1 = max(0, int(ys.min()) - pad), min(image.height, int(ys.max()) + pad + 1)
    return image.crop((x0, y0, x1, y1))


def extract_hat(source: Image.Image) -> Image.Image:
    session = new_session('u2net')
    cut = remove(source.crop(CROP).convert('RGB'), session=session).convert('RGBA')
    return trim(defringe(cut), pad=8)


def tracked_text(text: str, size: int, fill: tuple[int, int, int, int], tracking: float) -> Image.Image:
    face = ImageFont.truetype(font_path(), size)
    widths = []
    for char in text:
        box = face.getbbox(char)
        widths.append(box[2] - box[0])
    gap = int(size * tracking)
    height = size + int(size * 0.35)
    width = sum(widths) + gap * (len(text) - 1) + 4
    image = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    x = 2
    for char, char_width in zip(text, widths):
        box = face.getbbox(char)
        draw.text((x - box[0], int(size * 0.05) - box[1]), char, font=face, fill=fill)
        x += char_width + gap
    return image


def shield(size: int, colour: tuple[int, int, int, int]) -> Image.Image:
    """A broad heater shield with a padlock, stroked so it reads as thread."""
    image = Image.new('RGBA', (size, int(size * 1.05)), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    stroke = max(3, size // 11)
    width, height = image.size
    path = [
        (width * 0.12, height * 0.10),
        (width * 0.88, height * 0.10),
        (width * 0.88, height * 0.52),
        (width * 0.50, height * 0.94),
        (width * 0.12, height * 0.52),
    ]
    draw.line(path + [path[0]], fill=colour, width=stroke, joint='curve')
    lock_stroke = max(2, stroke - 1)
    draw.rounded_rectangle(
        (width * 0.34, height * 0.46, width * 0.66, height * 0.70),
        radius=max(2, size // 16),
        outline=colour,
        width=lock_stroke,
    )
    draw.arc(
        (width * 0.38, height * 0.30, width * 0.62, height * 0.54),
        start=200,
        end=340,
        fill=colour,
        width=lock_stroke,
    )
    return image


def crown_patch() -> Image.Image:
    name = tracked_text('MAXIM NYANSA', 86, FOREST, 0.06)
    mark = shield(int(name.height * 0.92), FOREST)
    gap = int(name.height * 0.28)
    canvas = Image.new('RGBA', (mark.width + gap + name.width, name.height), (0, 0, 0, 0))
    canvas.alpha_composite(mark, (0, (name.height - mark.height) // 2))
    canvas.alpha_composite(name, (mark.width + gap, 0))
    return canvas


def band_patch() -> Image.Image:
    return tracked_text('CYBERSECURITY 2026', 64, PAPER, 0.08)


def thread(image: Image.Image, seed: int) -> Image.Image:
    """Break a flat fill into short stitches and a catch-light along the top edge."""
    pixels = np.array(image.convert('RGBA')).astype(np.float32)
    alpha = pixels[..., 3]
    if alpha.max() == 0:
        return image
    height, width = alpha.shape
    rng = np.random.default_rng(seed)
    grain = rng.random((height, width))
    rows = np.arange(height, dtype=np.float32)[:, None]
    satin = 0.78 + 0.22 * (0.5 + 0.5 * np.sin(rows * 1.35 + grain * 1.4))
    speck = 0.86 + 0.14 * grain
    pixels[..., :3] *= (satin * speck)[..., None]
    pixels[..., 3] *= np.clip(0.9 + 0.1 * grain, 0, 1)
    stitched = Image.fromarray(np.clip(pixels, 0, 255).astype(np.uint8), 'RGBA')
    # A one-pixel thread highlight on the lit edge. Light in the photo falls from the upper left.
    highlight = Image.new('RGBA', image.size, (0, 0, 0, 0))
    shifted = image.transform(image.size, Image.Transform.AFFINE, (1, 0, 1.2, 0, 1, 1.2), Image.Resampling.BICUBIC)
    mask = shifted.split()[-1].point(lambda value: int(value * 0.45))
    tint = Image.new('RGBA', image.size, (255, 255, 255, 255))
    highlight.paste(tint, mask=mask)
    stitched.alpha_composite(highlight)
    return stitched


def warp_onto(canvas: Image.Image, patch: Image.Image, box: tuple[float, float, float, float], arc: float, bow: float, perspective: float) -> Image.Image:
    """Inverse-map a flat patch onto a shallow cylinder inside the hat bounding box."""
    alpha = np.array(canvas.split()[-1])
    ys, xs = np.where(alpha > 20)
    hat_x0, hat_y0 = float(xs.min()), float(ys.min())
    hat_w, hat_h = float(xs.max() - xs.min()), float(ys.max() - ys.min())
    x0 = hat_x0 + box[0] * hat_w
    y0 = hat_y0 + box[1] * hat_h
    x1 = hat_x0 + box[2] * hat_w
    y1 = hat_y0 + box[3] * hat_h
    width, height = x1 - x0, y1 - y0
    centre = (x0 + x1) / 2

    source = np.array(patch.convert('RGBA'))
    src_h, src_w = source.shape[:2]
    pad = int(abs(bow) * height + height * 0.35)
    left = max(0, int(math.floor(x0 - width * 0.08)))
    right = min(canvas.width, int(math.ceil(x1 + width * 0.08)))
    top = max(0, int(math.floor(y0 - pad)))
    bottom = min(canvas.height, int(math.ceil(y1 + pad)))
    grid_y, grid_x = np.mgrid[top:bottom, left:right]
    grid_x = grid_x.astype(np.float32)
    grid_y = grid_y.astype(np.float32)
    u_linear = np.clip((grid_x - x0) / width, -0.15, 1.15)
    drop = bow * height * np.sin(np.clip(u_linear, 0, 1) * math.pi)
    y_adj = grid_y - drop
    v = (y_adj - y0) / height
    scale = 1 - perspective * (1 - np.clip(v, 0, 1))
    scale = np.maximum(scale, 0.4)
    u = 0.5 + (grid_x - centre) / (width * scale)
    radius = (width / 2) / math.sin(arc / 2)
    sine = np.clip((grid_x - centre) / radius, -1, 1)
    theta = np.arcsin(sine)
    u_src = 0.5 + theta / arc
    # Blend the cylindrical squeeze with the perspective u so the edges tighten
    # without collapsing the letters.
    u_src = np.clip(u * 0.35 + u_src * 0.65, 0, 1)
    valid = (u_src >= 0) & (u_src <= 1) & (v >= 0) & (v <= 1)
    map_x = (u_src * (src_w - 1)).astype(np.float32)
    map_y = (np.clip(v, 0, 1) * (src_h - 1)).astype(np.float32)

    import cv2

    warped = cv2.remap(source, map_x, map_y, cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
    warped[~valid] = 0
    # A one-pixel weave displacement, so the stitches are not a flat decal.
    felt = np.array(canvas.crop((left, top, right, bottom)).convert('L'), dtype=np.float32)
    detail = felt - cv2.GaussianBlur(felt, (0, 0), 2.2)
    shift = np.clip(detail / 80, -1.2, 1.2).astype(np.float32)
    displaced = cv2.remap(
        warped,
        (map_x * 0 + np.arange(warped.shape[1], dtype=np.float32)[None, :]) + shift,
        (map_y * 0 + np.arange(warped.shape[0], dtype=np.float32)[:, None]) + shift * 0.35,
        cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(0, 0, 0, 0),
    )
    layer = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    layer.paste(Image.fromarray(displaced, 'RGBA'), (left, top))
    return layer


def shade(layer: Image.Image, hat: Image.Image) -> Image.Image:
    """Let the photograph's light fall across the stitches."""
    pixels = np.array(layer).astype(np.float32)
    alpha = pixels[..., 3]
    if alpha.max() == 0:
        return layer
    felt = np.array(hat.convert('RGB')).astype(np.float32)
    luma = felt.mean(axis=2)
    covered = alpha > 8
    mean = float(luma[covered].mean()) if covered.any() else 1
    light = np.clip(luma / max(mean, 1), 0.62, 1.18)
    pixels[..., :3] *= light[..., None]
    pixels[..., :3] = np.clip(pixels[..., :3], 0, 255)
    return Image.fromarray(pixels.astype(np.uint8), 'RGBA')


def shadow_of(layer: Image.Image) -> Image.Image:
    alpha = layer.split()[-1].filter(ImageFilter.GaussianBlur(2.2))
    shifted = Image.new('L', layer.size, 0)
    shifted.paste(alpha, (3, 4))
    darkness = Image.new('RGBA', layer.size, (6, 16, 12, 255))
    darkness.putalpha(shifted.point(lambda value: int(value * 0.55)))
    return darkness


def multiply(base: Image.Image, ink: Image.Image) -> Image.Image:
    """Dark stitches darken the felt instead of sitting on top of it."""
    hat = np.array(base.convert('RGBA')).astype(np.float32)
    stitch = np.array(ink.convert('RGBA')).astype(np.float32)
    alpha = stitch[..., 3:4] / 255
    felt = hat[..., :3] / 255
    colour = stitch[..., :3] / 255
    blended = felt * (1 - alpha) + (felt * colour) * alpha
    hat[..., :3] = np.clip(blended * 255, 0, 255)
    return Image.fromarray(hat.astype(np.uint8), 'RGBA')


def composite(hat: Image.Image) -> Image.Image:
    crown = shade(warp_onto(hat, thread(crown_patch(), 11), CROWN, arc=0.72, bow=0.10, perspective=0.10), hat)
    band = shade(warp_onto(hat, thread(band_patch(), 19), BAND, arc=0.42, bow=0.16, perspective=0.04), hat)
    image = hat.copy()
    image.alpha_composite(shadow_of(crown))
    image = multiply(image, crown)
    image.alpha_composite(shadow_of(band))
    image.alpha_composite(band)
    return image


def save_pair(image: Image.Image, stem: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    image.save(OUT / f'{stem}.png', optimize=True)
    image.save(OUT / f'{stem}.webp', 'WEBP', quality=82, method=6)


def main() -> None:
    source = Image.open(SOURCE)
    hat = extract_hat(source)
    hat = hat.resize((hat.width * SCALE, hat.height * SCALE), Image.Resampling.LANCZOS)
    save_pair(hat, 'white-hat-cutout')
    designed = composite(hat)
    save_pair(designed, 'bootcamp-hat')
    display = designed.copy()
    display.thumbnail((800, 800), Image.Resampling.LANCZOS)
    display.save(OUT / 'bootcamp-hat-800.webp', 'WEBP', quality=80, method=6)
    # Close crop of the stitched wording, for review. Not used by the site.
    alpha = np.array(designed.split()[-1])
    ys, xs = np.where(alpha > 20)
    x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())
    width, height = x1 - x0, y1 - y0
    crop = designed.crop((
        x0 + int(width * 0.18),
        y0 + int(height * 0.34),
        x0 + int(width * 0.82),
        y0 + int(height * 0.78),
    ))
    crop.save('/tmp/hat/design-closeup.png')
    preview = Image.new('RGB', designed.size, (14, 42, 30))
    preview.paste(designed, mask=designed.split()[-1])
    preview.thumbnail((1100, 1100), Image.Resampling.LANCZOS)
    preview.save('/tmp/hat/designed-preview.png')
    print(f'cutout {hat.size} designed {designed.size}')


if __name__ == '__main__':
    main()
