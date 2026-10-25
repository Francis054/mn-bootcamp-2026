#!/usr/bin/env python3
"""Render the 20-second mathematics showreel.

1920×1080, 30 fps, exactly 600 frames (20.0s), with a synthesised soundtrack.
No copyrighted audio. Re-run from this folder: python3 render.py
"""
from __future__ import annotations

import math
import struct
import subprocess
import wave
from pathlib import Path

import cairosvg
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
W, H = 1920, 1080
FPS = 30
FRAMES = 600  # 20.0 seconds
SR = 44100

# Site palette (frontend/src/styles/tokens.css)
FOREST = np.array([14, 42, 30], dtype=np.float32)
FOREST_DEEP = np.array([10, 31, 22], dtype=np.float32)
LIME = (136, 204, 0)
LIME_SITE = (169, 207, 62)
GOLD = (217, 164, 65)
TERR = (200, 85, 61)
PAPER = (246, 247, 242)
WHITE = (255, 255, 255)
INK = (15, 26, 20)
MUTED = (168, 184, 172)

BPM = 120
BEAT = 60 / BPM  # seconds


def smooth(t: float) -> float:
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def clamp(t: float, a=0.0, b=1.0) -> float:
    return a if t < a else b if t > b else t


def font_paths() -> tuple[Path, Path]:
    cache = Path("/tmp/showreel-cache")
    cache.mkdir(exist_ok=True)
    display = cache / "SpaceGrotesk-700.ttf"
    if not display.exists():
        src = REPO / "frontend/public/assets/fonts/SpaceGrotesk-latin-ecea81.woff2"
        instancer.instantiateVariableFont(TTFont(src), {"wght": 700}).save(display)
    mono = Path("/usr/share/fonts/truetype/jetbrains-mono/JetBrainsMono-Medium.ttf")
    return display, mono


DISPLAY_PATH, MONO_PATH = font_paths()


def font(size: int, mono=False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(MONO_PATH if mono else DISPLAY_PATH), size)


def load_hat() -> Image.Image:
    png = Path("/tmp/showreel-cache") / "hat-black.png"
    svg = REPO / "frontend/public/assets/logo/hat-black.svg"
    cairosvg.svg2png(url=str(svg), write_to=str(png), output_width=640)
    return Image.open(png).convert("RGBA")


def load_mark() -> Image.Image:
    png = Path("/tmp/showreel-cache") / "logo-mark.png"
    svg = REPO / "frontend/public/assets/logo/logo-mark.svg"
    cairosvg.svg2png(url=str(svg), write_to=str(png), output_width=760)
    return Image.open(png).convert("RGBA")


HAT = load_hat()
MARK = load_mark()


def base_plate() -> Image.Image:
    """Static forest field with the same lime, gold and terracotta washes as the loader."""
    img = Image.new("RGB", (W, H), (14, 42, 30))
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(glow)
    d.ellipse((-280, -360, 980, 620), fill=(169, 207, 62, 48))
    d.ellipse((1100, -300, 2100, 520), fill=(217, 164, 65, 40))
    d.ellipse((520, 620, 1600, 1400), fill=(200, 85, 61, 36))
    return Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB")


PLATE = base_plate()
SCAN = np.ones((H, W, 1), dtype=np.float32)
SCAN[::3, :, 0] = 0.86
SCAN[1::3, :, 0] = 0.94


def paste(base: Image.Image, sprite: Image.Image, xy, alpha=1.0) -> None:
    if alpha <= 0:
        return
    sprite = sprite if alpha >= 0.999 else sprite.copy()
    if alpha < 0.999:
        band = sprite.split()[-1].point(lambda p: int(p * alpha))
        sprite.putalpha(band)
    base.alpha_composite(sprite, (int(xy[0]), int(xy[1])))


def center_text(draw, text, y, fill, size, mono=False, tracking=0):
    f = font(size, mono)
    if tracking == 0:
        box = draw.textbbox((0, 0), text, font=f)
        x = (W - (box[2] - box[0])) / 2
        draw.text((x, y), text, font=f, fill=fill)
        return
    widths = [draw.textlength(ch, font=f) + tracking for ch in text]
    x = (W - (sum(widths) - tracking)) / 2
    for ch, wch in zip(text, widths):
        draw.text((x, y), ch, font=f, fill=fill)
        x += wch


def label(draw, text, y, fill=LIME):
    center_text(draw, text, y, fill, 22, mono=True, tracking=6)


# --- mathematics -----------------------------------------------------------

def lissajous_points(n, a, b, delta, scale=280):
    ts = np.linspace(0, 2 * math.pi, n, endpoint=False)
    x = np.sin(a * ts + delta) * scale
    y = np.sin(b * ts) * scale
    return x, y


def rose_points(n, k, scale=250):
    ts = np.linspace(0, 2 * math.pi * (2 if k % 1 else 1), n)
    r = np.cos(k * ts) * scale
    return r * np.cos(ts), r * np.sin(ts)


def star_path(samples_per_edge=12):
    tips = []
    for i in range(10):
        ang = -math.pi / 2 + i * math.pi / 5
        radius = 1.0 if i % 2 == 0 else 0.40
        tips.append(complex(math.cos(ang) * radius, math.sin(ang) * radius))
    pts = []
    for i, a in enumerate(tips):
        b = tips[(i + 1) % len(tips)]
        for s in range(samples_per_edge):
            t = s / samples_per_edge
            pts.append(a * (1 - t) + b * t)
    return np.array(pts, dtype=np.complex128)


def dft_coeffs(zs, keep=14):
    n = len(zs)
    freqs = []
    idx = np.arange(n)
    for k in range(-n // 2, n // 2):
        coeff = np.sum(zs * np.exp(-2j * np.pi * k * idx / n)) / n
        freqs.append((k, coeff))
    freqs.sort(key=lambda item: abs(item[1]), reverse=True)
    return freqs[:keep]


STAR = star_path()
FOURIER = dft_coeffs(STAR, 12)


def epicycle_state(progress):
    """Return circle centres, radii, and the pen point for a partial trace."""
    t = progress
    pos = 0j
    circles = []
    for k, coeff in FOURIER:
        radius = abs(coeff)
        phase = math.atan2(coeff.imag, coeff.real) + 2 * math.pi * k * t
        circles.append((pos, radius, phase))
        pos += coeff * np.exp(2j * np.pi * k * t)
    return circles, pos


def fourier_trail(steps=420):
    trail = []
    for i in range(steps):
        _, pos = epicycle_state(i / steps)
        trail.append(pos)
    return trail


TRAIL = fourier_trail()


def mandelbrot(width, height, center, scale, iters=70):
    ys = np.linspace(center.imag - scale, center.imag + scale * height / width, height)
    xs = np.linspace(center.real - scale, center.real + scale, width)
    x = xs[None, :].astype(np.float64)
    y = ys[:, None].astype(np.float64)
    c = x + 1j * y
    z = np.zeros_like(c)
    div = np.zeros(c.shape, dtype=np.int32)
    alive = np.ones(c.shape, dtype=bool)
    for i in range(iters):
        z[alive] = z[alive] * z[alive] + c[alive]
        escaped = alive & (z.real * z.real + z.imag * z.imag > 4)
        div[escaped] = i
        alive[escaped] = False
    div[alive] = iters
    return div


def colorize_fractal(div, iters):
    t = div / iters
    img = np.zeros(div.shape + (3,), dtype=np.uint8)
    inside = div >= iters - 1
    # Outside: forest → lime → gold → paper
    img[..., 0] = np.clip(10 + t * 220, 0, 255)
    img[..., 1] = np.clip(31 + t * 190, 0, 255)
    img[..., 2] = np.clip(22 + t * 40, 0, 80)
    # Push the bright edge toward lime
    edge = (t > 0.15) & (t < 0.55)
    img[edge, 0] = 136
    img[edge, 1] = 204
    img[edge, 2] = 0
    img[inside] = (8, 16, 12)
    return img


MB_CENTER = complex(-0.7435, 0.1314)
JULIA_C = complex(-0.7269, 0.1889)


def julia(width, height, c, scale, iters=60):
    ys = np.linspace(-scale, scale, height)
    xs = np.linspace(-scale * width / height, scale * width / height, width)
    z = xs[None, :] + 1j * ys[:, None]
    div = np.zeros(z.shape, dtype=np.int32)
    alive = np.ones(z.shape, dtype=bool)
    for i in range(iters):
        z[alive] = z[alive] * z[alive] + c
        escaped = alive & (z.real * z.real + z.imag * z.imag > 4)
        div[escaped] = i
        alive[escaped] = False
    div[alive] = iters
    return div


def ulam_points(limit=420):
    x = y = 0
    dx, dy = 0, -1
    pts = []
    for n in range(1, limit + 1):
        pts.append((n, x, y, is_prime(n)))
        if x == y or (x < 0 and x == -y) or (x > 0 and x == 1 - y):
            dx, dy = -dy, dx
        x, y = x + dx, y + dy
    return pts


def is_prime(n: int) -> bool:
    if n < 2:
        return False
    if n % 2 == 0:
        return n == 2
    i = 3
    while i * i <= n:
        if n % i == 0:
            return False
        i += 2
    return True


ULAM = ulam_points()


def golden_squares():
    phi_boxes = []
    fib = [1, 1, 2, 3, 5, 8, 13]
    x = y = 0
    # Grow left, up, right, down
    dirs = [(0, -1), (-1, 0), (0, 1), (1, 0)]
    for i, size in enumerate(fib):
        dx, dy = dirs[i % 4]
        if dx == 0 and dy == -1:
            y -= size
        elif dx == -1 and dy == 0:
            x -= size
        phi_boxes.append((x, y, size, i % 4))
        if dx == 1:
            x += size
        if dy == 1:
            y += size
    return phi_boxes


SQUARES = golden_squares()


def project(points, rot_y, rot_x, dist=3.4, scale=220):
    cy, sy = math.cos(rot_y), math.sin(rot_y)
    cx, sx = math.cos(rot_x), math.sin(rot_x)
    out = []
    for x, y, z in points:
        x2 = x * cy + z * sy
        z2 = -x * sy + z * cy
        y2 = y * cx - z2 * sx
        z3 = y * sx + z2 * cx
        f = dist / (dist + z3)
        out.append((x2 * f * scale, y2 * f * scale, f))
    return out


def torus_edges(nu=28, nv=16, R=1.35, r=0.48):
    verts = []
    for i in range(nu):
        u = 2 * math.pi * i / nu
        for j in range(nv):
            v = 2 * math.pi * j / nv
            verts.append(((R + r * math.cos(v)) * math.cos(u), r * math.sin(v), (R + r * math.cos(v)) * math.sin(u)))
    edges = []
    for i in range(nu):
        for j in range(nv):
            a = i * nv + j
            edges.append((a, i * nv + (j + 1) % nv))
            edges.append((a, ((i + 1) % nu) * nv + j))
    return verts, edges


TORUS_V, TORUS_E = torus_edges()


def icosahedron():
    phi = (1 + math.sqrt(5)) / 2
    raw = []
    for i in (-1, 1):
        for j in (-1, 1):
            raw.append((0, i, j * phi))
            raw.append((i, j * phi, 0))
            raw.append((j * phi, 0, i))
    # Normalise
    verts = []
    for x, y, z in raw:
        m = math.sqrt(x * x + y * y + z * z)
        verts.append((x / m, y / m, z / m))
    edges = set()
    for i, a in enumerate(verts):
        dists = []
        for j, b in enumerate(verts):
            if i == j:
                continue
            d = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
            dists.append((d, j))
        dists.sort()
        for _, j in dists[:5]:
            edges.add(tuple(sorted((i, j))))
    return verts, list(edges)


ICO_V, ICO_E = icosahedron()


# --- scenes ----------------------------------------------------------------

def scene_intro(frame, canvas: Image.Image):
    t = frame / FPS
    draw = ImageDraw.Draw(canvas)
    # A lime rule draws on, then the title lands.
    rule = smooth(t / 0.6)
    draw.rectangle((W * 0.18, 470, W * 0.18 + (W * 0.64) * rule, 474), fill=LIME)
    if t > 0.25:
        a = smooth((t - 0.25) / 0.45)
        label(draw, "FRANCIS DEY", 400 - int(12 * (1 - a)), (*LIME, ))
        # label() doesn't take alpha. Redraw with solid once in.
    if t > 0.45:
        a = smooth((t - 0.45) / 0.4)
        y = 490 + int(18 * (1 - a))
        center_text(draw, "MATHEMATICS", y, PAPER, 132)
    if t > 1.15:
        label(draw, "A MOTION STUDY", 660, MUTED)


def scene_matrix(frame, canvas: Image.Image, rng):
    t = (frame - 2 * FPS) / (2.5 * FPS)
    draw = ImageDraw.Draw(canvas, "RGBA")
    cols = 42
    fnt = font(20, mono=True)
    charset = "01Σπ∫√φ∞∂λ{}=+-*/<>"
    for c in range(cols):
        x = 36 + c * 46
        speed = 0.35 + (c * 17 % 10) / 18
        head = int(((frame * speed) + c * 37) % (H + 240)) - 120
        for k in range(16):
            y = head - k * 24
            if y < -20 or y > H:
                continue
            ch = charset[(c * 13 + k * 7 + frame // 2) % len(charset)]
            shade = max(0, 255 - k * 16)
            color = (136, min(255, 160 + shade // 6), 40, shade)
            if k == 0:
                color = (246, 247, 242, 230)
            draw.text((x, y), ch, font=fnt, fill=color)
    # Glitch slices
    if frame % 11 == 0:
        band = 180 + (frame * 47) % 700
        slice_ = canvas.crop((0, band, W, band + 18))
        canvas.paste(slice_, (12 if frame % 22 else -16, band))
    # Black hat enters from the left and holds.
    progress = smooth(min(1, (frame - 2 * FPS) / 22))
    sprite = HAT.resize((int(HAT.width * 1.05), int(HAT.height * 1.05)), Image.Resampling.LANCZOS)
    x = -sprite.width + int((W * 0.58) * progress)
    y = H // 2 - sprite.height // 2 + 30
    paste(canvas.convert("RGBA") if False else canvas, sprite, (x, y))
    draw = ImageDraw.Draw(canvas)
    if t > 0.35:
        label(draw, "BLACK HAT  ·  TRACE", 86)
        center_text(draw, "while (curious)  learn();", 900, PAPER, 36, mono=True)


def scene_curves(frame, canvas: Image.Image):
    local = frame - int(4.5 * FPS)
    t = local / (2 * FPS)
    draw = ImageDraw.Draw(canvas, "RGBA")
    reveal = smooth(min(1, local / 20))
    n = int(40 + reveal * 700)
    x, y = lissajous_points(max(n, 2), 3, 2, local * 0.04, 300)
    pts = [(W * 0.36 + x[i], H * 0.52 + y[i]) for i in range(len(x))]
    if len(pts) > 1:
        draw.line(pts, fill=LIME + (230,), width=3)
    xr, yr = rose_points(int(200 + reveal * 500), 7 / 2 if False else 3, 210)
    # A second figure, offset, in gold — a rhodonea.
    rose = [(W * 0.72 + xr[i], H * 0.52 + yr[i]) for i in range(int(len(xr) * reveal))]
    if len(rose) > 1:
        draw.line(rose, fill=GOLD + (210,), width=2)
    label(draw, "LISSAJOUS   ·   RHODONEA", 86)
    center_text(draw, "x = sin 3t      y = sin 2t", 930, PAPER, 32, mono=True)


def scene_fourier(frame, canvas: Image.Image):
    local = frame - int(6.5 * FPS)
    span = int(2.5 * FPS)
    progress = clamp(local / span)
    draw = ImageDraw.Draw(canvas, "RGBA")
    origin = complex(W * 0.5, H * 0.52)
    scale = 250
    circles, _ = epicycle_state(progress)
    pen = origin
    for centre, radius, phase in circles:
        c = origin + centre * scale
        r = radius * scale
        if r > 1.5:
            box = (c.real - r, c.imag - r, c.real + r, c.imag + r)
            draw.ellipse(box, outline=(169, 207, 62, 90))
            tip = c + complex(math.cos(phase), math.sin(phase)) * r
            draw.line((c.real, c.imag, tip.real, tip.imag), fill=GOLD + (180,), width=2)
            pen = tip
    count = max(2, int(progress * (len(TRAIL) - 1)))
    trail = []
    for pos in TRAIL[:count]:
        p = origin + pos * scale
        trail.append((p.real, p.imag))
    if len(trail) > 1:
        draw.line(trail, fill=LIME + (240,), width=4)
    # Pen dot
    draw.ellipse((pen.real - 5, pen.imag - 5, pen.real + 5, pen.imag + 5), fill=PAPER)
    label(draw, "FOURIER  ·  EPICYCLES", 86)
    center_text(draw, "a closed shape, summed from circles", 940, MUTED, 28, mono=True)


def scene_waves(frame, canvas: Image.Image):
    local = frame - int(9 * FPS)
    draw = ImageDraw.Draw(canvas, "RGBA")
    # Two travelling sines and their sum.
    xs = np.linspace(160, W - 160, 900)
    phase = local * 0.18
    for amp, freq, color, y0 in (
        (70, 0.010, LIME, 340),
        (70, 0.016, GOLD, 520),
    ):
        pts = [(float(x), y0 + math.sin(x * freq + phase) * amp) for x in xs[::4]]
        draw.line(pts, fill=color + (200,), width=3)
    pts = []
    for x in xs[::3]:
        y = 760 + (math.sin(x * 0.010 + phase) + math.sin(x * 0.016 + phase + 0.6)) * 70
        pts.append((float(x), y))
    draw.line(pts, fill=PAPER + (230,), width=4)
    label(draw, "SUPERPOSITION", 86)
    center_text(draw, "sin a  +  sin b", 900, PAPER, 36, mono=True)


def scene_spirals(frame, canvas: Image.Image):
    local = frame - int(11 * FPS)
    reveal = smooth(min(1, local / 24))
    draw = ImageDraw.Draw(canvas, "RGBA")
    # Fibonacci squares, then a quarter-circle in each.
    unit = 16
    # Centre the figure
    boxes = []
    max_x = max(x + s for x, y, s, _ in SQUARES)
    max_y = max(y + s for x, y, s, _ in SQUARES)
    min_x = min(x for x, y, s, _ in SQUARES)
    min_y = min(y for x, y, s, _ in SQUARES)
    ox = W * 0.33 - (min_x + max_x) * unit / 2
    oy = H * 0.55 - (min_y + max_y) * unit / 2
    shown = max(1, int(len(SQUARES) * reveal))
    for x, y, s, quad in SQUARES[:shown]:
        box = (ox + x * unit, oy + y * unit, ox + (x + s) * unit, oy + (y + s) * unit)
        draw.rectangle(box, outline=LIME_SITE + (180,), width=2)
        # Quarter circle
        if quad == 0:
            arc = (box[0], box[1], box[2] + (box[2] - box[0]), box[3] + (box[3] - box[1]))
            start = 180
        elif quad == 1:
            arc = (box[0], box[1], box[2] + (box[2] - box[0]), box[3] + (box[3] - box[1]))
            start = 270
        elif quad == 2:
            arc = (box[0] - (box[2] - box[0]), box[1] - (box[3] - box[1]), box[2], box[3])
            start = 0
        else:
            arc = (box[0] - (box[2] - box[0]), box[1] - (box[3] - box[1]), box[2], box[3])
            start = 90
        draw.arc(arc, start, start + 90, fill=GOLD + (230,), width=4)
    # Ulam prime spiral on the right
    cell = 11
    cx, cy = W * 0.74, H * 0.54
    limit = int(80 + reveal * (len(ULAM) - 80))
    for n, x, y, prime in ULAM[:limit]:
        if not prime:
            continue
        px, py = cx + x * cell, cy + y * cell
        draw.rectangle((px, py, px + 7, py + 7), fill=LIME if n > 2 else GOLD)
    label(draw, "φ   ·   PRIME SPIRAL", 86)
    center_text(draw, "1.6180339887…", 940, PAPER, 32, mono=True)


def scene_fractal(frame, canvas: Image.Image, cache: dict):
    local = frame - int(13 * FPS)
    span = int(2.5 * FPS)
    z = local / max(1, span - 1)
    # Ease the zoom so the dive accelerates.
    zoom = 1.4 * (0.045 ** (z * z))
    key = int(z * 36)
    if key not in cache:
        div = mandelbrot(480, 270, MB_CENTER, zoom, iters=64)
        cache[key] = Image.fromarray(colorize_fractal(div, 64), "RGB").resize((W, H), Image.Resampling.BILINEAR)
    plate = cache[key].convert("RGBA")
    canvas.paste(plate, (0, 0))
    if "julia" not in cache:
        j = julia(280, 280, JULIA_C, 1.6, iters=50)
        cache["julia"] = Image.fromarray(colorize_fractal(j, 50), "RGB").resize((300, 300), Image.Resampling.NEAREST)
    # Inset
    inset = cache["julia"].convert("RGBA")
    frame_box = Image.new("RGBA", (316, 316), (0, 0, 0, 0))
    ImageDraw.Draw(frame_box).rectangle((0, 0, 315, 315), outline=LIME + (255,), width=3)
    canvas.alpha_composite(frame_box, (W - 380, 140))
    canvas.alpha_composite(inset, (W - 372, 148))
    draw = ImageDraw.Draw(canvas)
    label(draw, "MANDELBROT   ·   JULIA", 78)
    center_text(draw, "z → z² + c", 960, PAPER, 36, mono=True)


def scene_polytope(frame, canvas: Image.Image):
    local = frame - int(15.5 * FPS)
    draw = ImageDraw.Draw(canvas, "RGBA")
    rot = local * 0.05
    projected = project(TORUS_V, rot, 0.55, dist=4.2, scale=250)
    for a, b in TORUS_E:
        pa, pb = projected[a], projected[b]
        depth = (pa[2] + pb[2]) / 2
        shade = int(140 + 90 * depth)
        color = (136, min(255, shade), 40, 210)
        draw.line((W * 0.38 + pa[0], H * 0.52 + pa[1], W * 0.38 + pb[0], H * 0.52 + pb[1]), fill=color, width=2)
    ip = project(ICO_V, -rot * 1.3, rot * 0.4, dist=3.2, scale=150)
    for a, b in ICO_E:
        pa, pb = ip[a], ip[b]
        draw.line((W * 0.74 + pa[0], H * 0.50 + pa[1], W * 0.74 + pb[0], H * 0.50 + pb[1]), fill=GOLD + (230,), width=2)
    label(draw, "TORUS   ·   ICOSAHEDRON", 86)
    center_text(draw, "a surface, and a platonic solid", 940, MUTED, 28, mono=True)


def scene_euler(frame, canvas: Image.Image):
    local = frame - int(17.5 * FPS)
    draw = ImageDraw.Draw(canvas)
    # Symbols arrive on eighth-notes.
    parts = [
        (0, "e", 150, 0),
        (3, "iπ", 64, -70),
        (6, "+", 120, 0),
        (9, "1", 150, 0),
        (12, "=", 120, 0),
        (15, "0", 150, 0),
    ]
    # Lay them out centred as a group once we know which are visible.
    visible = [(i, text, size, dy) for i, text, size, dy in parts if local >= i]
    fonts = [(text, font(size), dy) for _, text, size, dy in visible]
    gap = 28
    widths = [draw.textlength(text, font=f) for text, f, _ in fonts]
    total = sum(widths) + gap * (len(widths) - 1 if widths else 0)
    x = (W - total) / 2
    for (text, f, dy), w in zip(fonts, widths):
        draw.text((x, 430 + dy), text, font=f, fill=PAPER if text not in {"iπ"} else LIME)
        x += w + gap
    if local > 18:
        label(draw, "EULER", 300)
        center_text(draw, "the most beautiful equation", 700, MUTED, 28, mono=True)


def scene_close(frame, canvas: Image.Image):
    local = frame - int(18.5 * FPS)
    a = smooth(min(1, local / 10))
    draw = ImageDraw.Draw(canvas)
    mark = MARK.copy()
    mark.thumbnail((640, 240), Image.Resampling.LANCZOS)
    if a < 1:
        band = mark.split()[-1].point(lambda p: int(p * a))
        mark.putalpha(band)
    canvas.alpha_composite(mark, ((W - mark.width) // 2, 250))
    if local > 6:
        center_text(draw, "FRANCIS DEY", 560, PAPER, 84)
        label(draw, "SHOWREEL", 670)
        center_text(draw, "MATHEMATICS  ·  MOTION", 760, MUTED, 26, mono=True)
        # Palette rule
        colors = (LIME, GOLD, TERR, (46, 106, 75))
        rw = len(colors) * 36 - 12
        rx = (W - rw) / 2
        for i, color in enumerate(colors):
            draw.rounded_rectangle((rx + i * 36, 830, rx + i * 36 + 24, 838), radius=4, fill=color)


def finish(canvas: Image.Image, frame: int) -> Image.Image:
    """Scanlines, a little grain, and a one-frame lime tick on the beat."""
    rgb = canvas.convert("RGB")
    arr = np.asarray(rgb).astype(np.float32)
    arr *= SCAN
    if frame % 2 == 0:
        noise = np.random.default_rng(frame).integers(0, 10, size=(H, W, 1), dtype=np.uint8)
        arr += noise * 0.35
    # Beat tick: a hairline, not a full flash.
    if frame % int(BEAT * FPS) == 0 and frame not in (0, FRAMES):
        arr[H // 2 - 1:H // 2 + 1, :, 1] = np.minimum(255, arr[H // 2 - 1:H // 2 + 1, :, 1] + 80)
    np.clip(arr, 0, 255, out=arr)
    return Image.fromarray(arr.astype(np.uint8), "RGB")


def render_frame(frame: int, fractal_cache: dict) -> Image.Image:
    t = frame / FPS
    canvas = PLATE.copy().convert("RGBA")
    # Dim code persists under the math, so the hacking field never fully leaves.
    if 2.0 <= t < 18.5 and not (13.0 <= t < 15.5):
        veil = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(veil)
        fnt = font(16, mono=True)
        charset = "01πΣ∫"
        for c in range(0, 28):
            x = 20 + c * 70
            head = int((frame * (0.4 + (c % 5) * 0.08) + c * 50) % (H + 80)) - 40
            for k in range(8):
                ch = charset[(c + k + frame // 4) % len(charset)]
                d.text((x, head - k * 22), ch, font=fnt, fill=(136, 204, 0, 28 if t > 4.5 else 0))
        if t >= 4.5:
            canvas.alpha_composite(veil)
    if t < 2:
        scene_intro(frame, canvas)
    elif t < 4.5:
        scene_matrix(frame, canvas, None)
    elif t < 6.5:
        scene_curves(frame, canvas)
    elif t < 9:
        scene_fourier(frame, canvas)
    elif t < 11:
        scene_waves(frame, canvas)
    elif t < 13:
        scene_spirals(frame, canvas)
    elif t < 15.5:
        scene_fractal(frame, canvas, fractal_cache)
    elif t < 17.5:
        scene_polytope(frame, canvas)
    elif t < 18.5:
        scene_euler(frame, canvas)
    else:
        scene_close(frame, canvas)
    return finish(canvas, frame)


# --- audio -----------------------------------------------------------------

def env_exp(n, decay):
    return np.exp(-np.arange(n) / decay).astype(np.float32)


def synth(duration=20.0) -> np.ndarray:
    n = int(SR * duration)
    mix = np.zeros(n, dtype=np.float32)
    beat = int(SR * BEAT)

    def add(start, wave_):
        end = min(n, start + len(wave_))
        mix[start:end] += wave_[: end - start]

    # Kick
    for i in range(int(duration / BEAT)):
        if i % 4 in (0, 1, 2, 3):
            length = int(SR * 0.18)
            e = env_exp(length, SR * 0.045)
            freq = 140 * np.exp(-np.arange(length) / (SR * 0.06)) + 46
            phase = np.cumsum(freq) / SR * 2 * math.pi
            add(i * beat, np.sin(phase).astype(np.float32) * e * 0.55)

    # Soft noise hat on the off-eighth
    rng = np.random.default_rng(7)
    eighth = beat // 2
    for i in range(int(duration / BEAT * 2)):
        if i % 2 == 1:
            length = int(SR * 0.04)
            add(i * eighth, rng.normal(0, 1, length).astype(np.float32) * env_exp(length, SR * 0.008) * 0.08)

    # Bass ostinato, A minor: A C E G
    notes = [55.0, 65.41, 82.41, 98.0]
    for i in range(int(duration / BEAT)):
        if i < 4 or i >= int(duration / BEAT) - 3:
            continue
        freq = notes[i % 4]
        length = int(beat * 0.92)
        t = np.arange(length) / SR
        e = np.minimum(1, t / 0.02) * np.exp(-t / 0.35)
        tone = np.sin(2 * math.pi * freq * t) + 0.35 * np.sin(2 * math.pi * freq * 2 * t)
        add(i * beat, tone.astype(np.float32) * e.astype(np.float32) * 0.22)

    # Quiet arp in the math sections (from 4.5s)
    arp = [440.0, 523.25, 659.25, 783.99, 659.25, 523.25]
    step = beat // 2
    start = int(4.5 * SR)
    stop = int(17.5 * SR)
    k = 0
    pos = start
    while pos < stop:
        freq = arp[k % len(arp)]
        length = int(step * 0.85)
        t = np.arange(length) / SR
        e = np.exp(-t / 0.12) * np.minimum(1, t / 0.005)
        tone = np.sin(2 * math.pi * freq * t) * e * 0.05
        add(pos, tone.astype(np.float32))
        k += 1
        pos += step

    # Pad, A minor, ducked slightly by a slow pulse
    t = np.arange(n) / SR
    pad = (
        np.sin(2 * math.pi * 220 * t)
        + np.sin(2 * math.pi * 261.63 * t)
        + np.sin(2 * math.pi * 329.63 * t)
    ) / 3
    pulse = 0.65 + 0.35 * (0.5 + 0.5 * np.cos(2 * math.pi * (BPM / 60) * t))
    fade = np.clip(t / 1.2, 0, 1) * np.clip((duration - t) / 1.4, 0, 1)
    mix += (pad * pulse * fade * 0.06).astype(np.float32)

    # Scene whooshes: short filtered noise
    for when in (2.0, 4.5, 6.5, 9.0, 11.0, 13.0, 15.5, 17.5, 18.5):
        length = int(SR * 0.35)
        noise = rng.normal(0, 1, length).astype(np.float32)
        kernel = np.hanning(64).astype(np.float32)
        kernel /= kernel.sum()
        noise = np.convolve(noise, kernel, mode="same")
        add(int(when * SR), noise * env_exp(length, SR * 0.08) * 0.12)

    peak = np.max(np.abs(mix)) or 1
    mix *= 0.9 / peak
    return mix


def write_wav(path: Path, audio: np.ndarray) -> None:
    samples = (np.clip(audio, -1, 1) * 32767).astype(np.int16)
    with wave.open(str(path), "w") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(SR)
        handle.writeframes(samples.tobytes())


def main():
    out = ROOT / "francis-dey-mathematics-showreel.mp4"
    wav = Path("/tmp/showreel-cache") / "score.wav"
    wav.parent.mkdir(exist_ok=True)
    print("scoring…")
    write_wav(wav, synth(20.0))
    cmd = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
        "-i", str(wav),
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "medium",
        "-c:a", "aac", "-b:a", "160k",
        "-t", "20",
        "-movflags", "+faststart",
        str(out),
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    cache: dict = {}
    assert proc.stdin is not None
    for frame in range(FRAMES):
        image = render_frame(frame, cache)
        proc.stdin.write(image.tobytes())
        if frame % 30 == 0:
            print(f"frame {frame}/{FRAMES}")
    proc.stdin.close()
    code = proc.wait()
    if code != 0:
        raise SystemExit(f"ffmpeg exited {code}")
    print("wrote", out, out.stat().st_size)


if __name__ == "__main__":
    main()
