#!/usr/bin/env python3
"""Build logo files for the Cyber Bootcamp site.

The live community mark is the hood line drawing in `src/components/hood-mark.svg`.
`--badge-only` rasterises that file into the favicons and the social card.

The rest of this script redraws the older two-hat SVGs. Those are not the
community logo. That path needs fontTools and Shapely.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

try:
    from fontTools.pens.svgPathPen import SVGPathPen
    from fontTools.ttLib import TTFont
    from fontTools.varLib import instancer
    from shapely import affinity
    from shapely.geometry import Point, Polygon
    from shapely.ops import unary_union
except ImportError:  # `--badge-only` does not need these.
    SVGPathPen = TTFont = instancer = None  # type: ignore[misc, assignment]
    affinity = Point = Polygon = unary_union = None  # type: ignore[misc, assignment]

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "assets" / "logo"
FONT_DIR = ROOT / "public" / "assets" / "fonts"

# Palette — sourced from frontend/src/styles/tokens.css
BLACK = "#111111"
FOREST = "#0A1F16"
FOREST_800 = "#0E2A1E"
FOREST_600 = "#1F4D36"
LIME = "#88CC00"
LIME_DEEP = "#6FA800"
PAPER = "#F6F7F2"
WHITE = "#FFFFFF"
TERR = "#C8553D"
GOLD = "#D9A441"
INK = "#0F1A14"
INK_3 = "#5E6A63"
LIME_SITE = "#A9CF3E"

LEAN = 6.5  # degrees each hat tips toward the other

# Facing right. Front (the opponent) is +x.
CROWN = [
    ("M", (78, 196)),
    ("C", (68, 132), (84, 54), (126, 30)),
    ("C", (152, 14), (174, 36), (182, 66)),
    ("C", (192, 36), (234, 16), (266, 48)),
    ("C", (292, 74), (290, 148), (268, 200)),
    ("C", (210, 186), (118, 190), (78, 196)),
    ("Z",),
]
BRIM = [
    ("M", (34, 202)),
    ("C", (96, 178), (176, 172), (242, 186)),
    ("C", (292, 196), (332, 174), (368, 150)),
    ("C", (376, 162), (356, 180), (322, 190)),
    ("C", (248, 210), (128, 220), (46, 210)),
    ("C", (22, 206), (18, 206), (34, 202)),
    ("Z",),
]
PINCH = [
    ("M", (166, 32)),
    ("C", (176, 58), (184, 82), (178, 112)),
    ("C", (196, 76), (216, 48), (208, 30)),
    ("C", (194, 22), (176, 22), (166, 32)),
    ("Z",),
]
BAND = [
    ("M", (98, 166)),
    ("C", (154, 146), (214, 146), (262, 170)),
    ("L", (256, 188)),
    ("C", (206, 196), (140, 194), (102, 184)),
    ("Z",),
]
# Light on the face turned toward the other hat.
LIGHT = [
    ("M", (200, 58)),
    ("C", (236, 40), (274, 62), (276, 112)),
    ("C", (278, 162), (262, 190), (250, 194)),
    ("C", (240, 148), (232, 96), (200, 58)),
    ("Z",),
]
SHEEN = [
    ("M", (114, 44)),
    ("C", (142, 26), (170, 32), (178, 54)),
    ("C", (162, 42), (140, 38), (120, 54)),
    ("Z",),
]


def cubic(p0, p1, p2, p3, n=36):
    pts = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        x = u**3 * p0[0] + 3 * u**2 * t * p1[0] + 3 * u * t**2 * p2[0] + t**3 * p3[0]
        y = u**3 * p0[1] + 3 * u**2 * t * p1[1] + 3 * u * t**2 * p2[1] + t**3 * p3[1]
        pts.append((x, y))
    return pts


def compile_path(cmds, n=36):
    pts = []
    current = None
    for cmd in cmds:
        op = cmd[0]
        if op == "M":
            current = cmd[1]
            pts.append(current)
        elif op == "L":
            current = cmd[1]
            pts.append(current)
        elif op == "C":
            p1, p2, p3 = cmd[1], cmd[2], cmd[3]
            pts.extend(cubic(current, p1, p2, p3, n)[1:])
            current = p3
        elif op == "Z":
            if pts and pts[0] != pts[-1]:
                pts.append(pts[0])
    return pts


def silhouette() -> Polygon:
    crown = Polygon(compile_path(CROWN))
    brim = Polygon(compile_path(BRIM))
    return unary_union([crown, brim]).buffer(0)


def hat_origin():
    minx, miny, maxx, maxy = silhouette().bounds
    return ((minx + maxx) / 2, (miny + maxy) / 2)


ORIGIN = hat_origin() if Polygon is not None else (0.0, 0.0)


def pose_geom(geom, side: str, shift: float):
    angle = -LEAN if side == "black" else LEAN
    g = affinity.rotate(geom, angle, origin=ORIGIN)
    if side == "white":
        g = affinity.scale(g, -1, 1, origin=ORIGIN)
        g = affinity.translate(g, xoff=shift)
    return g


def pose_point(x, y, side: str, shift: float):
    return pose_geom(Point(x, y), side, shift).coords[0]


def shift_for(gap: float) -> float:
    sil = silhouette()
    black = pose_geom(sil, "black", 0)
    white = pose_geom(sil, "white", 0)
    return (black.bounds[2] + gap) - white.bounds[0]


def fmt(n: float) -> str:
    return f"{n:.1f}".rstrip("0").rstrip(".")


def cmds_to_d(cmds, side: str, shift: float) -> str:
    parts = []
    for cmd in cmds:
        op = cmd[0]
        if op == "Z":
            parts.append("Z")
            continue
        if op == "M":
            x, y = pose_point(*cmd[1], side, shift)
            parts.append(f"M{fmt(x)} {fmt(y)}")
        elif op == "L":
            x, y = pose_point(*cmd[1], side, shift)
            parts.append(f"L{fmt(x)} {fmt(y)}")
        elif op == "C":
            pts = [pose_point(*p, side, shift) for p in cmd[1:]]
            parts.append("C" + " ".join(f"{fmt(x)} {fmt(y)}" for x, y in pts))
    return "".join(parts)


def ring_d(coords) -> str:
    pts = list(coords)
    if len(pts) > 1 and pts[0] == pts[-1]:
        pts = pts[:-1]
    if len(pts) < 3:
        return ""
    d = [f"M{fmt(pts[0][0])} {fmt(pts[0][1])}"]
    d.extend(f"L{fmt(x)} {fmt(y)}" for x, y in pts[1:])
    d.append("Z")
    return "".join(d)


def geom_d(geom) -> str:
    if geom.is_empty:
        return ""
    geoms = [geom] if geom.geom_type == "Polygon" else [g for g in geom.geoms if g.geom_type == "Polygon"]
    chunks = []
    for poly in geoms:
        chunks.append(ring_d(poly.exterior.coords))
        for hole in poly.interiors:
            chunks.append(ring_d(hole.coords))
    return "".join(chunks)


def spark_paths(black_sil, white_sil):
    gx = (black_sil.bounds[2] + white_sil.bounds[0]) / 2
    # Sit the spark on the brim tips, not floating above the crowns.
    gy = (black_sil.bounds[3] + white_sil.bounds[3]) / 2 - 6
    s = 13
    outer = [
        (gx, gy - s * 1.45),
        (gx + s * 0.46, gy - s * 0.08),
        (gx, gy + s * 0.72),
        (gx - s * 0.46, gy - s * 0.08),
    ]
    inner = [
        (gx, gy - s * 0.72),
        (gx + s * 0.2, gy - s * 0.02),
        (gx, gy + s * 0.34),
        (gx - s * 0.2, gy - s * 0.02),
    ]
    return ring_d(outer + [outer[0]]), ring_d(inner + [inner[0]]), (gx, gy)


def seal_path(band_geom):
    bx0, by0, bx1, by1 = band_geom.bounds
    cx, cy = bx0 + (bx1 - bx0) * 0.18, (by0 + by1) / 2
    s = 6.4
    pts = [(cx, cy - s), (cx + s * 0.62, cy), (cx, cy + s), (cx - s * 0.62, cy)]
    return ring_d(pts + [pts[0]])


def bounds_of(geoms, pad=18):
    minx, miny, maxx, maxy = unary_union(geoms).bounds
    return minx - pad, miny - pad, maxx + pad, maxy + pad


def svg_doc(view, body, title, desc):
    minx, miny, maxx, maxy = view
    w, h = maxx - minx, maxy - miny
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="{fmt(minx)} {fmt(miny)} {fmt(w)} {fmt(h)}" fill="none" role="img" aria-labelledby="title desc">
  <title id="title">{title}</title>
  <desc id="desc">{desc}</desc>
{body}
</svg>
'''


def hat_group(side: str, shift: float, colors: dict, keyline: float) -> tuple[str, object]:
    sil = pose_geom(silhouette(), side, shift)
    gid = "black-hat" if side == "black" else "ethical-hat"
    lines = [f'  <g id="{gid}">']
    if keyline:
        # One simplified outline so the keyline is a single shape, not a double stroke.
        key = sil.buffer(keyline, join_style=1, resolution=6).simplify(0.9, preserve_topology=True)
        lines.append(f'    <path fill="{colors["key"]}" d="{geom_d(key)}"/>')
    # Crown and brim share a fill. Overlap hides the join; the curves stay editable.
    lines.append(f'    <path fill="{colors["body"]}" d="{cmds_to_d(CROWN, side, shift)}"/>')
    lines.append(f'    <path fill="{colors["body"]}" d="{cmds_to_d(BRIM, side, shift)}"/>')
    lines.append(f'    <path fill="{colors["light"]}" d="{cmds_to_d(LIGHT, side, shift)}"/>')
    lines.append(f'    <path fill="{colors["sheen"]}" d="{cmds_to_d(SHEEN, side, shift)}"/>')
    lines.append(f'    <path fill="{colors["pinch"]}" d="{cmds_to_d(PINCH, side, shift)}"/>')
    lines.append(f'    <path fill="{colors["band"]}" d="{cmds_to_d(BAND, side, shift)}"/>')
    if side == "white" and colors.get("seal"):
        band = pose_geom(Polygon(compile_path(BAND, 8)), side, shift)
        lines.append(f'    <path fill="{colors["seal"]}" d="{seal_path(band)}"/>')
    lines.append("  </g>")
    return "\n".join(lines), sil


PRIMARY_BLACK = {
    "key": LIME,
    "body": BLACK,
    "light": FOREST_600,
    "sheen": "#2A5A40",
    "pinch": "#070E0B",
    "band": TERR,
}
PRIMARY_WHITE = {
    "key": FOREST,
    "body": PAPER,
    "light": WHITE,
    "sheen": WHITE,
    "pinch": "#D5DCC8",
    "band": LIME,
    "seal": GOLD,
}
# On the lime plate the lime band and lime keyline would vanish, so the icon
# swaps the ethical band to forest and drops the keylines.
ON_LIME_BLACK = {
    "key": LIME,
    "body": "#0C140F",
    "light": FOREST_600,
    "sheen": "#24513A",
    "pinch": "#070E0B",
    "band": TERR,
}
ON_LIME_WHITE = {
    "key": FOREST,
    "body": PAPER,
    "light": WHITE,
    "sheen": WHITE,
    "pinch": "#D5DCC8",
    "band": FOREST_800,
    "seal": GOLD,
}


def build_mark(black_colors, white_colors, keyline: float, gap=34):
    shift = shift_for(gap)
    black_svg, black_sil = hat_group("black", shift, black_colors, keyline)
    white_svg, white_sil = hat_group("white", shift, white_colors, keyline)
    spark, core, _ = spark_paths(black_sil, white_sil)
    spark_svg = f'''  <g id="spark">
    <path fill="{LIME if keyline else GOLD}" d="{spark}"/>
    <path fill="{GOLD if keyline else WHITE}" d="{core}"/>
  </g>'''
    geoms = [black_sil, white_sil]
    if keyline:
        geoms = [black_sil.buffer(keyline), white_sil.buffer(keyline)]
    return black_svg, white_svg, spark_svg, geoms, shift


def write(name: str, text: str):
    path = OUT / name
    path.write_text(text)
    print(f"wrote {path.relative_to(ROOT)} ({path.stat().st_size} bytes)")


def export_rasters():
    """Favicon PNG and the social card. Cairo draws the vectors; Pillow composes type."""
    import cairosvg

    cairosvg.svg2png(url=str(OUT / "logo-icon-app.svg"), write_to=str(OUT / "apple-touch-icon.png"), output_width=180, output_height=180)

    mark_png = Path("/tmp/logo-iters/og-mark.png")
    mark_png.parent.mkdir(exist_ok=True)
    cairosvg.svg2png(url=str(OUT / "logo-wordmark-on-dark.svg"), write_to=str(mark_png), output_width=920)
    mark = Image.open(mark_png).convert("RGBA")

    W, H = 1200, 630
    img = Image.new("RGB", (W, H), (14, 42, 30))
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.ellipse((-200, -260, 620, 420), fill=(169, 207, 62, 70))
    od.ellipse((780, -200, 1400, 360), fill=(217, 164, 65, 55))
    od.ellipse((420, 360, 1100, 900), fill=(200, 85, 61, 45))
    img = Image.alpha_composite(img.convert("RGBA"), overlay)
    img.paste(mark, ((W - mark.width) // 2, (H - mark.height) // 2 - 16), mark)
    draw = ImageDraw.Draw(img)
    small = ImageFont.truetype("/usr/share/fonts/truetype/jetbrains-mono/JetBrainsMono-Medium.ttf", 18)
    caption = "MAXIM NYANSA FOUNDATION"
    tw = draw.textlength(caption, font=small)
    draw.text(((W - tw) / 2, H - 78), caption, font=small, fill=(201, 214, 196))
    colors = ((136, 204, 0), (217, 164, 65), (200, 85, 61), (46, 106, 75))
    rule_w = len(colors) * 36 - 12
    rx = (W - rule_w) / 2
    for i, color in enumerate(colors):
        draw.rounded_rectangle((rx + i * 36, H - 46, rx + i * 36 + 24, H - 38), radius=4, fill=color)
    img.convert("RGB").save(OUT / "og-image.png", "PNG", optimize=True)
    print(f"wrote og-image.png ({(OUT / 'og-image.png').stat().st_size} bytes)")


def glyph_path(font, text, size, x, y, tracking=0):
    """Return (svg path, width). Font y-up units are flipped into y-down."""
    glyphset = font.getGlyphSet()
    cmap = font.getBestCmap()
    upem = font["head"].unitsPerEm
    scale = size / upem
    pen_paths = []
    cursor = x
    for ch in text:
        gid = cmap.get(ord(ch))
        if gid is None:
            raise SystemExit(f"missing glyph {ch!r}")
        pen = SVGPathPen(glyphset)
        glyphset[gid].draw(pen)
        d = pen.getCommands()
        if d:
            pen_paths.append((d, cursor))
        cursor += glyphset[gid].width * scale + tracking
    width = cursor - x - (tracking if text else 0)
    chunks = []
    for d, cx in pen_paths:
        # SVGPathPen emits font coordinates (y up). Flip around the baseline.
        chunks.append(f'<path d="{d}" transform="translate({fmt(cx)} {fmt(y)}) scale({fmt(scale)} {-scale})"/>')
    return "".join(chunks), width


def load_fonts():
    space = instancer.instantiateVariableFont(TTFont(FONT_DIR / "SpaceGrotesk-latin-ecea81.woff2"), {"wght": 700})
    mono = TTFont("/usr/share/fonts/truetype/jetbrains-mono/JetBrainsMono-Medium.ttf")
    return space, mono


def wordmark_svg(text_main, text_sub, on_dark: bool):
    black_svg, white_svg, spark_svg, geoms, _ = build_mark(PRIMARY_BLACK, PRIMARY_WHITE, keyline=2.4, gap=32)
    minx, miny, maxx, maxy = bounds_of(geoms, pad=8)
    mark_h = maxy - miny
    space, mono = load_fonts()
    main_size = mark_h * 0.46
    sub_size = mark_h * 0.175
    text_x = maxx + mark_h * 0.28
    main_y = miny + mark_h * 0.50
    sub_y = miny + mark_h * 0.78
    main_fill = PAPER if on_dark else INK
    sub_fill = LIME_SITE if on_dark else "#3E5248"
    main_d, main_w = glyph_path(space, text_main, main_size, text_x, main_y, tracking=main_size * -0.02)
    sub_d, sub_w = glyph_path(mono, text_sub, sub_size, text_x, sub_y, tracking=sub_size * 0.14)
    body = "\n".join([black_svg, white_svg, spark_svg, f'  <g id="wordmark" fill="{main_fill}">{main_d}</g>', f'  <g id="wordmark-sub" fill="{sub_fill}">{sub_d}</g>'])
    view = (minx - 8, miny - mark_h * 0.08, text_x + max(main_w, sub_w) + 8, maxy + mark_h * 0.12)
    title = "Cyber Bootcamp community logo with wordmark"
    desc = "Black hat and ethical hat facing off, beside the words Cyber Bootcamp, 2026 Accra."
    return svg_doc(view, body, title, desc)


def raster_mark(colors_b, colors_w, keyline, bg, scale=3, gap=34):
    """PIL proof used while checking silhouette weight. Not the shipped asset."""
    shift = shift_for(gap)
    sil_b = pose_geom(silhouette(), "black", shift)
    sil_w = pose_geom(silhouette(), "white", shift)
    geoms = [sil_b.buffer(keyline or 0), sil_w.buffer(keyline or 0)]
    minx, miny, maxx, maxy = bounds_of(geoms, 16)
    W, H = int((maxx - minx) * scale), int((maxy - miny) * scale)
    img = Image.new("RGBA", (W, H), bg)

    def paint(geom, fill):
        if geom.is_empty:
            return
        polys = [geom] if geom.geom_type == "Polygon" else list(geom.geoms)
        draw = ImageDraw.Draw(img)
        for poly in polys:
            pts = [((x - minx) * scale, (y - miny) * scale) for x, y in poly.exterior.coords]
            draw.polygon(pts, fill=fill)

    def hex_rgba(h):
        h = h.lstrip("#")
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)

    if keyline:
        paint(sil_b.buffer(keyline), hex_rgba(colors_b["key"]))
        paint(sil_w.buffer(keyline), hex_rgba(colors_w["key"]))
    paint(sil_b, hex_rgba(colors_b["body"]))
    paint(sil_w, hex_rgba(colors_w["body"]))
    return img


def main():
    if SVGPathPen is None or affinity is None:
        raise SystemExit("fontTools and shapely are required to redraw the older hat SVGs")
    OUT.mkdir(parents=True, exist_ok=True)
    title = "Cyber Bootcamp community logo"
    desc = "A black hat and an ethical white hat face each other across a lime spark. Community mark of the 2026 Cyber Bootcamp."

    black_svg, white_svg, spark_svg, geoms, shift = build_mark(PRIMARY_BLACK, PRIMARY_WHITE, keyline=2.6, gap=34)
    view = bounds_of(geoms, 16)
    write("logo-mark.svg", svg_doc(view, "\n".join([black_svg, white_svg, spark_svg]), title, desc))

    # Single hats, same pose as the pair, each with its own tight viewBox.
    for side, colors, filename, label in (
        ("black", PRIMARY_BLACK, "hat-black.svg", "Black hat"),
        ("white", PRIMARY_WHITE, "hat-ethical.svg", "Ethical hat"),
    ):
        group, sil = hat_group(side, shift if side == "white" else 0, colors, 2.6)
        # Re-pose black at shift 0; white already includes shift. For a single
        # hat the white shift only adds empty space, so pose white at 0 too.
        group, sil = hat_group(side, 0, colors, 2.6)
        key = sil.buffer(2.6)
        write(filename, svg_doc(bounds_of([key], 10), group, label, f"{label} from the Cyber Bootcamp community logo, drawn to face its opposite."))

    icon_b, icon_w, icon_spark, icon_geoms, _ = build_mark(ON_LIME_BLACK, ON_LIME_WHITE, keyline=0, gap=28)
    icon_view = bounds_of(icon_geoms, 10)
    write("logo-icon.svg", svg_doc(icon_view, "\n".join([icon_b, icon_w, icon_spark]), "Cyber Bootcamp icon", "Compact black hat and ethical hat icon for favicons, app icons and the header."))

    # App plate. Fit the icon viewBox into a 64px rounded square.
    ix0, iy0, ix1, iy1 = icon_view
    iw, ih = ix1 - ix0, iy1 - iy0
    pad = 7
    avail = 64 - pad * 2
    s = min(avail / iw, avail / ih)
    tx = (64 - iw * s) / 2 - ix0 * s
    ty = (64 - ih * s) / 2 - iy0 * s + 1
    plate = f'''  <rect width="64" height="64" rx="14" fill="{LIME}"/>
  <g transform="translate({fmt(tx)} {fmt(ty)}) scale({fmt(s)})">
{icon_b}
{icon_w}
{icon_spark}
  </g>'''
    write("logo-icon-app.svg", svg_doc((0, 0, 64, 64), plate, "Cyber Bootcamp app icon", "Lime app icon with the black hat and ethical hat facing off."))

    write("logo-wordmark.svg", wordmark_svg("Cyber Bootcamp", "2026  ·  ACCRA", on_dark=False))
    write("logo-wordmark-on-dark.svg", wordmark_svg("Cyber Bootcamp", "2026  ·  ACCRA", on_dark=True))

    # Small raster proofs for a quick look, not shipped.
    proof = Path("/tmp/logo-iters")
    proof.mkdir(exist_ok=True)
    raster_mark(PRIMARY_BLACK, PRIMARY_WHITE, 2.6, (246, 247, 242, 255)).save(proof / "final-paper.png")
    raster_mark(PRIMARY_BLACK, PRIMARY_WHITE, 2.6, (14, 42, 30, 255)).save(proof / "final-forest.png")
    raster_mark(ON_LIME_BLACK, ON_LIME_WHITE, 0, (136, 204, 0, 255), gap=28).save(proof / "final-lime.png")
    print("proofs in", proof)
    export_rasters()


BRAND = ROOT / "scripts" / "brand"
POPPINS_BLACK = BRAND / "Poppins-Black.ttf"
BADGE_TAGLINE = "STRONGER TOGETHER"


def circular_rgba(im: Image.Image) -> Image.Image:
    """Transparent outside the outer lime ring. Matches the loader mask."""
    im = im.convert("RGBA")
    width, height = im.size
    scale = 4
    mask = Image.new("L", (width * scale, height * scale), 0)
    draw = ImageDraw.Draw(mask)
    radius = width * scale * 0.492
    cx, cy = width * scale / 2, height * scale / 2
    draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=255)
    mask = mask.resize((width, height), Image.Resampling.LANCZOS)
    mask = mask.filter(ImageFilter.GaussianBlur(max(0.6, width * 0.012)))
    im.putalpha(mask)
    return im


def compose_approved_badge(bare: Image.Image, foundation: Image.Image) -> Image.Image:
    """concept-a plus the cream foundation plate and the STRONGER TOGETHER banner.

    Geometry matches badge-compose-reference.py at 1024px. The live site draws
    the plate and the banner in HTML so an uploaded foundation logo stays current.
    This flattened file is the static fallback (favicon crop, social card, no-JS).
    """
    im = bare.convert("RGBA")
    logo = foundation.convert("RGBA")
    draw = ImageDraw.Draw(im)
    logo_w = 250
    logo_h = int(logo_w * 41 / 200)
    plate_w, plate_h = logo_w + 44, logo_h + 30
    cx, cy = 512, 770
    x0 = cx - plate_w // 2
    y0 = cy - plate_h // 2
    draw.rounded_rectangle(
        [x0, y0, x0 + plate_w, y0 + plate_h],
        radius=plate_h // 2,
        fill=(246, 247, 242, 255),
        outline=(136, 204, 0, 255),
        width=3,
    )
    fitted = logo.resize((logo_w, logo_h), Image.Resampling.LANCZOS)
    im.paste(fitted, (cx - logo_w // 2, cy - logo_h // 2), fitted)
    draw = ImageDraw.Draw(im)
    draw.rounded_rectangle(
        [362, 905, 662, 949],
        radius=22,
        fill=(10, 31, 22, 255),
        outline=(136, 204, 0, 255),
        width=3,
    )
    font = ImageFont.truetype(str(POPPINS_BLACK), 17)
    gap = 2
    widths = [draw.textlength(char, font=font) + gap for char in BADGE_TAGLINE]
    x = 512 - sum(widths) / 2
    for char, width in zip(BADGE_TAGLINE, widths):
        draw.text((x, 916), char, font=font, fill=(136, 204, 0, 255))
        x += width
    return im


def emblem_crop(im: Image.Image, size: int) -> Image.Image:
    """Hats and lime ring, without the plate or the banner. Readable at 16–32px."""
    side = 640
    left = (1024 - side) // 2
    top = 48
    crop = im.crop((left, top, left + side, top + side))
    return crop.resize((size, size), Image.Resampling.LANCZOS)


def save_rgba(im: Image.Image, stem: str) -> None:
    png = OUT / f"{stem}.png"
    webp = OUT / f"{stem}.webp"
    # A 256-colour PNG stays under 100 KB. The WebP keeps the full gradient.
    quantized = im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    quantized.save(png, "PNG", optimize=True)
    im.save(webp, "WEBP", quality=82, method=6)
    print(f"wrote {stem}.png ({png.stat().st_size} bytes), {stem}.webp ({webp.stat().st_size} bytes)")


def subset_poppins() -> None:
    from fontTools.subset import Options, Subsetter
    from fontTools.ttLib import TTFont

    font = TTFont(str(POPPINS_BLACK))
    options = Options()
    options.flavor = "woff2"
    options.layout_features = ["kern"]
    options.desubroutinize = True
    subsetter = Subsetter(options=options)
    subsetter.populate(unicodes=list(range(0x20, 0x7F)))
    subsetter.subset(font)
    dest = ROOT / "public" / "assets" / "fonts" / "Poppins-Black-latin.woff2"
    font.flavor = "woff2"
    font.save(str(dest))
    print(f"wrote Poppins-Black-latin.woff2 ({dest.stat().st_size} bytes)")


def social_card(badge: Image.Image) -> Image.Image:
    width, height = 1200, 630
    img = Image.new("RGB", (width, height), (10, 31, 22))
    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.ellipse((-180, -240, 560, 420), fill=(136, 204, 0, 46))
    draw.ellipse((760, -180, 1380, 380), fill=(217, 164, 65, 40))
    card = Image.alpha_composite(img.convert("RGBA"), overlay)
    mark = badge.resize((420, 420), Image.Resampling.LANCZOS)
    card.paste(mark, ((width - 420) // 2, 48), mark)
    caption = ImageDraw.Draw(card)
    font = ImageFont.truetype(str(POPPINS_BLACK), 40)
    text = "2026 CYBERSECURITY BOOTCAMP"
    caption.text(((width - caption.textlength(text, font=font)) / 2, 500), text, font=font, fill=(136, 204, 0, 255))
    return card.convert("RGB")


def build_community_badge() -> None:
    """Rasterise the hood mark. See build-hood-mark.py."""
    import runpy

    runpy.run_path(str(Path(__file__).with_name("build-hood-mark.py")), run_name="__main__")


if __name__ == "__main__":
    import sys

    if "--badge-only" in sys.argv:
        build_community_badge()
    else:
        main()
        build_community_badge()
