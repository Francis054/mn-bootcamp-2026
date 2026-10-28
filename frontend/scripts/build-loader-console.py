#!/usr/bin/env python3
"""Original MN Bootcamp 2026 console. Not stock footage.

Draws a glassy forest HUD, encodes a muted H.264 and WebM clip, and writes
the opening frame plus the ACCESS GRANTED poster. Classroom text only.
"""
from __future__ import annotations

import math
import shutil
import subprocess
from io import BytesIO
from pathlib import Path

import cairosvg
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "assets" / "boot"
MARK = ROOT / "src" / "components" / "hood-mark.svg"
FONT_MED = "/usr/share/fonts/truetype/jetbrains-mono/JetBrainsMono-Medium.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/jetbrains-mono/JetBrainsMono-Bold.ttf"

W, H = 1920, 1080
FPS = 30
DURATION = 4.2
FOREST = (10, 31, 22, 255)
FOREST_DEEP = (6, 20, 14, 255)
PANEL = (14, 42, 30, 214)
LIME = (136, 204, 0, 255)
LIME_DIM = (136, 204, 0, 90)
PAPER = (246, 247, 242, 255)
MUTED = (201, 214, 204, 255)

LOGS = [
    "$ bootcamp --cohort 2026",
    "  cohort link · forest node",
    "  module 03 · networks",
    "  welcome desk · ready",
    "  syllabus · week map",
    "  seat in Accra · held",
    "  session key · 2026",
    "  lab bench · open",
]
STATUSES = [
    (0.35, "welcome desk", "OK"),
    (0.95, "syllabus sync", "OK"),
    (1.55, "seat in Accra", "OK"),
    (2.15, "session key", "OK"),
    (2.70, "firewall check", "OK"),
]
NODES = [(90, 70), (230, 40), (360, 110), (180, 160), (420, 180), (300, 50)]
EDGES = [(0, 1), (1, 2), (0, 3), (3, 4), (1, 5), (2, 4)]


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def clamp(value: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, value))


def progress_at(t: float) -> float:
    return clamp(t / 3.05)


def glass(base: Image.Image, box: tuple[int, int, int, int], radius: int = 28) -> None:
    x0, y0, x1, y1 = box
    plate = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(plate)
    draw.rounded_rectangle(box, radius=radius, fill=PANEL)
    draw.rounded_rectangle(box, radius=radius, outline=LIME_DIM, width=2)
    draw.line((x0 + 24, y0 + 2, x1 - 24, y0 + 2), fill=(246, 247, 242, 50), width=2)
    base.alpha_composite(plate)


def draw_grid(base: Image.Image) -> None:
    grid = Image.new("RGBA", base.size, (0, 0, 0, 0))
    pen = ImageDraw.Draw(grid)
    for x in range(0, W, 96):
        pen.line((x, 0, x, H), fill=(136, 204, 0, 18), width=1)
    for y in range(0, H, 96):
        pen.line((0, y, W, y), fill=(136, 204, 0, 18), width=1)
    base.alpha_composite(grid)


def draw_graph(base: Image.Image, origin: tuple[int, int], t: float) -> None:
    ox, oy = origin
    pen = ImageDraw.Draw(base)
    pts = [(ox + x, oy + y) for x, y in NODES]
    for a, b in EDGES:
        pen.line((*pts[a], *pts[b]), fill=(136, 204, 0, 120), width=2)
    pulse = int((math.sin(t * 6) + 1) * 3)
    for index, (x, y) in enumerate(pts):
        r = 8 + (pulse if index == 2 else 0)
        pen.ellipse((x - r, y - r, x + r, y + r), fill=LIME if index == 2 else PAPER)


def hood_image(size: int) -> Image.Image:
    svg = MARK.read_text(encoding="utf-8").replace("currentColor", "#F6F7F2")
    raw = cairosvg.svg2png(bytestring=svg.encode(), output_width=size, output_height=size)
    return Image.open(BytesIO(raw)).convert("RGBA")


def frame(t: float, hood: Image.Image, fonts: dict[str, ImageFont.FreeTypeFont]) -> Image.Image:
    img = Image.new("RGBA", (W, H), FOREST)
    wash = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(wash).ellipse((-200, -180, 1100, 900), fill=(14, 42, 30, 255))
    img.alpha_composite(wash)
    draw_grid(img)
    pen = ImageDraw.Draw(img)

    pen.text((80, 48), "MN BOOTCAMP  //  CYBERSECURITY 2026", font=fonts["head"], fill=PAPER)
    pen.text((1180, 52), "SES-2026-0142", font=fonts["meta"], fill=LIME)
    pen.text((1460, 52), "05 OCT 2026   08:00", font=fonts["meta"], fill=MUTED)

    reveal = clamp((t - 3.15) / 0.28)
    console_alpha = 1 - reveal * 0.55

    glass(img, (72, 150, 1180, 860))
    glass(img, (1220, 150, 1848, 560))
    glass(img, (1220, 596, 1848, 860))

    pen = ImageDraw.Draw(img)
    pen.text((108, 176), "COHORT CONSOLE", font=fonts["label"], fill=LIME)
    pen.text((1256, 176), "SESSION", font=fonts["label"], fill=LIME)
    pen.text((1256, 622), "LAB NETWORK", font=fonts["label"], fill=LIME)

    scroll = int(t * 36) % 24
    for index, line in enumerate(LOGS):
        y = 248 + index * 62 - scroll
        if 228 < y < 680:
            pen.text((108, y), line, font=fonts["log"], fill=PAPER if line.startswith("$") else MUTED)

    done = progress_at(t)
    for index, (when, label, state) in enumerate(STATUSES):
        y = 248 + index * 56
        shown = t >= when
        pen.text((1256, y), label if shown else "· · ·", font=fonts["status"], fill=PAPER if shown else (201, 214, 204, 120))
        if shown:
            pen.text((1568, y), state, font=fonts["status"], fill=LIME)

    draw_graph(img, (1260, 680), t)

    pct = int(done * 100)
    ring_box = (1704, 188, 1824, 308)
    pen.arc(ring_box, start=-90, end=-90 + max(done * 360, 0.01), fill=LIME, width=8)
    pen.arc(ring_box, start=-90 + done * 360, end=269, fill=(136, 204, 0, 55), width=8)
    label = str(pct)
    box = pen.textbbox((0, 0), label, font=fonts["pct"])
    tw, th = box[2] - box[0], box[3] - box[1]
    cx = (ring_box[0] + ring_box[2]) / 2
    cy = (ring_box[1] + ring_box[3]) / 2
    pen.text((cx - tw / 2, cy - th / 2 - 8), label, font=fonts["pct"], fill=PAPER)

    pen.text((108, 736), "COHORT PROGRESS", font=fonts["label"], fill=MUTED)
    bar = (108, 784, 1120, 812)
    pen.rounded_rectangle(bar, radius=14, fill=(6, 20, 14, 255))
    fill_to = int(lerp(bar[0], bar[2], done))
    if fill_to > bar[0] + 16:
        pen.rounded_rectangle((bar[0], bar[1], fill_to, bar[3]), radius=14, fill=LIME)

    if console_alpha < 1:
        dim = Image.new("RGBA", (W, H), (10, 31, 22, int(210 * reveal)))
        img.alpha_composite(dim)

    if reveal > 0:
        card = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        cd = ImageDraw.Draw(card)
        cd.rounded_rectangle((430, 250, 1490, 860), radius=36, fill=(8, 26, 18, 242), outline=LIME, width=2)
        img.alpha_composite(card)
        img.alpha_composite(hood, (860, 290))
        overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        od = ImageDraw.Draw(overlay)
        grant = "ACCESS GRANTED"
        welcome = "welcome to MN Bootcamp 2026"
        gw = od.textlength(grant, font=fonts["grant"])
        ww = od.textlength(welcome, font=fonts["welcome"])
        od.text(((W - gw) / 2, 530), grant, font=fonts["grant"], fill=PAPER)
        od.text(((W - ww) / 2, 680), welcome, font=fonts["welcome"], fill=LIME)
        img.alpha_composite(overlay)

        if t < 3.32:
            glitch = img.crop((0, 480, W, 640))
            shifted = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            shifted.paste(glitch, (18, 480))
            img.alpha_composite(shifted)
            ImageDraw.Draw(img).rectangle((0, 600, W, 606), fill=LIME)

    if console_alpha < 1:
        img.putalpha(255)
    return img


def main() -> None:
    if not shutil.which("ffmpeg"):
        raise SystemExit("ffmpeg is required")
    frames = Path("/tmp/mn-boot-frames")
    if frames.exists():
        shutil.rmtree(frames)
    frames.mkdir()
    hood = hood_image(200)
    fonts = {
        "head": font(FONT_BOLD, 42),
        "meta": font(FONT_MED, 32),
        "label": font(FONT_MED, 26),
        "log": font(FONT_MED, 40),
        "status": font(FONT_MED, 32),
        "pct": font(FONT_BOLD, 36),
        "grant": font(FONT_BOLD, 108),
        "welcome": font(FONT_MED, 56),
    }
    count = int(DURATION * FPS)
    poster_at = int(3.7 * FPS)
    for index in range(count):
        t = index / FPS
        frame(t, hood, fonts).convert("RGB").save(frames / f"f{index:04d}.png", optimize=False)
        if index % 15 == 0:
            print(f"frame {index}/{count}")
    OUT.mkdir(parents=True, exist_ok=True)
    mp4 = OUT / "loader.mp4"
    subprocess.run(
        [
            "ffmpeg", "-y", "-framerate", str(FPS), "-i", str(frames / "f%04d.png"),
            "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-profile:v", "high",
            "-movflags", "+faststart", "-preset", "slow", "-crf", "26",
            str(mp4),
        ],
        check=True,
    )
    subprocess.run(
        [
            "ffmpeg", "-y", "-i", str(mp4), "-an", "-c:v", "libvpx-vp9",
            "-pix_fmt", "yuv420p", "-b:v", "0", "-crf", "36", "-row-mt", "1",
            "-deadline", "good", str(OUT / "loader.webm"),
        ],
        check=True,
    )
    Image.open(frames / "f0000.png").convert("RGB").save(OUT / "loader-start.jpg", quality=82)
    Image.open(frames / f"f{poster_at:04d}.png").convert("RGB").save(OUT / "loader-poster.jpg", quality=86)
    size = mp4.stat().st_size
    print(f"loader.mp4 {size} bytes")
    if size > 1_500_000:
        raise SystemExit("loader.mp4 is over 1.5MB")
    subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(mp4)], check=True)


if __name__ == "__main__":
    main()
