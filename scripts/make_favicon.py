"""
Build the ARAVINDHA logo + favicon / app-icon set.

Source   : the circular landscape emblem defined in this file (single source of truth)
Output   : public/ner-logo.png          (sidebar logo, used by src/main.js)
           public/ner-logo-badge.png    (app badge)
           public/favicon.svg           (vector, fully self-contained)
           public/favicon.ico           (16/32/48/64)
           public/favicon-32.png
           public/favicon-192.png
           public/favicon-512.png
           public/apple-touch-icon.png  (180x180, opaque)

Every one of those paths already ships with the prototype: the emblem is written
INTO the existing files, so no new asset is introduced and no reference has to move.

The mark is a circular landscape: a lime->teal gradient ring, a sunset sky, three
layered blue mountain ranges and rolling green foreground hills. Geometry is
declared once, in normalized 0..1 units, and BOTH the SVG and the raster icons are
emitted from it -- so the vector master and the tab icon can never drift apart.

A detailed landscape turns to mush at 16px, so the artwork is drawn at four detail
levels keyed to the target size (see _detail_level). Each output is drawn AT its
target size and supersampled, never downsampled from the 1024px master, so a 16px
tab icon gets the simplified 4-shape reduction rather than a resampled blur.

Run:  python scripts/make_favicon.py
"""

from __future__ import annotations

import math
import os

from PIL import Image, ImageChops, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, "public")

MASTER = 1024              # SVG viewBox / master raster size
NAVY = (13, 24, 42)        # emblem backfill (apple-touch-icon, opaque outputs)

# ── Ring ──────────────────────────────────────────────────────────────────────
# The emblem is inscribed in the square, so the ring hugs the icon edge -- that is
# what makes the tab icon read as a bright circular badge rather than a small blob.
R_OUT = 0.500              # outer radius
R_IN = 0.454               # inner radius -> ring thickness = 4.6% of the icon
RING_STOPS = [
    (0.00, (160, 229, 60)),   # #A0E53C  lime  (left)
    (0.50, (35, 213, 140)),   # #23D58C  green (centre)
    (1.00, (1, 196, 165)),    # #01C4A5  teal  (right)
]
RING_W = R_OUT - R_IN
RING_W_MAX = 0.110         # small icons get a heavier ring so it survives at 16px
RING_MIN_PX = 2.4          # ...but never thinner than this many pixels

# ── Sky ───────────────────────────────────────────────────────────────────────
# Deep blue zenith -> mauve haze -> orange burn -> yellow horizon glow.
SKY_STOPS = [
    (0.046, (12, 92, 186)),
    (0.115, (26, 96, 180)),
    (0.160, (60, 106, 165)),
    (0.195, (108, 118, 146)),
    (0.225, (196, 138, 100)),
    (0.255, (240, 152, 72)),
    (0.290, (253, 165, 52)),
    (0.325, (254, 194, 70)),
    (0.360, (253, 214, 92)),
    (0.410, (250, 228, 140)),
    (0.560, (255, 240, 190)),
]
SKY_STOPS_LITE = [
    (0.046, (12, 92, 186)),
    (0.160, (60, 106, 165)),
    (0.255, (240, 152, 72)),
    (0.360, (253, 214, 92)),
    (0.560, (255, 240, 190)),
]
SKY_STOPS_TINY = [
    (0.046, (14, 86, 180)),
    (0.250, (236, 150, 74)),
    (0.560, (255, 236, 180)),
]

# Sun glow sitting on the horizon, just right of centre.
GLOW = dict(cx=0.52, cy=0.400, radius=0.360, color=(255, 238, 170), peak=0.30)

# ── Clouds ────────────────────────────────────────────────────────────────────
# (cx, cy, rx, ry, colour). Dark navy streaks ride above the lit warm bands.
CLOUDS = [
    (0.40, 0.152, 0.135, 0.013, (32, 72, 134)),
    (0.74, 0.182, 0.180, 0.013, (26, 64, 126)),
    (0.33, 0.228, 0.170, 0.012, (244, 200, 140)),
    (0.62, 0.248, 0.235, 0.013, (248, 208, 146)),
    (0.87, 0.220, 0.115, 0.011, (238, 196, 142)),
]
CLOUDS_LITE = [(0.62, 0.248, 0.235, 0.013, (248, 208, 146))]
CLOUDS_TINY = []

# ── Mountain ranges (back to front) ───────────────────────────────────────────
# Each ridge is a polyline in normalized units; the silhouette is closed down to
# the bottom of the canvas and clipped to the disc at composite time.
RANGES = [
    {
        # far -- hazy periwinkle, pokes through the gaps of the range in front
        "ridge": [
            (-0.06, 0.470), (0.03, 0.404), (0.09, 0.436), (0.15, 0.376),
            (0.21, 0.408), (0.27, 0.356), (0.33, 0.392), (0.39, 0.344),
            (0.45, 0.386), (0.51, 0.336), (0.58, 0.378), (0.65, 0.340),
            (0.72, 0.386), (0.79, 0.352), (0.86, 0.398), (0.93, 0.362),
            (1.06, 0.404),
        ],
        "color": (86, 144, 206),
        "facet_color": None,
        "facet_apexes": [],
    },
    {
        # mid -- the sunlit blue range
        "ridge": [
            (-0.06, 0.560), (0.05, 0.478), (0.11, 0.512), (0.18, 0.432),
            (0.24, 0.470), (0.31, 0.408), (0.38, 0.452), (0.44, 0.388),
            (0.51, 0.432), (0.57, 0.372), (0.63, 0.416), (0.70, 0.378),
            (0.77, 0.428), (0.84, 0.392), (0.91, 0.436), (1.06, 0.462),
        ],
        "color": (32, 98, 188),
        "facet_color": (104, 168, 232),
        "facet_apexes": [(0.44, 0.388), (0.57, 0.372), (0.31, 0.408)],
    },
    {
        # near -- deep navy, carries the dominant peak against the sunset
        "ridge": [
            (-0.06, 0.640), (0.06, 0.560), (0.13, 0.596), (0.21, 0.520),
            (0.28, 0.560), (0.36, 0.496), (0.43, 0.540), (0.50, 0.470),
            (0.56, 0.516), (0.62, 0.430), (0.68, 0.480), (0.72, 0.248),
            (0.78, 0.430), (0.86, 0.492), (0.93, 0.444), (1.06, 0.500),
        ],
        "color": (10, 52, 122),
        "facet_color": (46, 112, 198),
        "facet_apexes": [(0.72, 0.248), (0.36, 0.496)],
    },
]
TINY_PEAK = [(-0.06, 0.640), (0.50, 0.300), (1.06, 0.640)]

# ── Rolling hills / forest (back to front) ────────────────────────────────────
# (base y, amplitude, frequency, phase, fill, crest highlight or None)
FOREST_LAYERS = [
    (0.658, 0.046, 0.85, 0.25, (12, 58, 42), (26, 96, 64)),
    (0.700, 0.038, 1.30, 0.60, (7, 42, 32), None),
]
HILL_LAYERS = [
    (0.760, 0.042, 1.10, 0.10, (46, 122, 42), (124, 203, 51)),
    (0.822, 0.046, 0.80, 0.45, (78, 160, 52), (165, 220, 60)),
    (0.898, 0.040, 1.50, 0.80, (30, 107, 46), (99, 180, 50)),
]
BAND_SPAN = (-0.06, 1.06)
BAND_SAMPLES = 128


# ── Colour / gradient helpers ─────────────────────────────────────────────────

def _lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def _sample_stops(stops, t):
    if t <= stops[0][0]:
        return stops[0][1]
    if t >= stops[-1][0]:
        return stops[-1][1]
    for i in range(len(stops) - 1):
        t0, c0 = stops[i]
        t1, c1 = stops[i + 1]
        if t0 <= t <= t1:
            return _lerp(c0, c1, (t - t0) / (t1 - t0) if t1 > t0 else 0.0)
    return stops[-1][1]


def _gradient(size, stops, horizontal):
    """1px gradient strip stretched to a full square (exact, no interpolation blur)."""
    strip = Image.new("RGB", (size if horizontal else 1, 1 if horizontal else size))
    px = strip.load()
    for i in range(size):
        c = _sample_stops(stops, i / (size - 1))
        if horizontal:
            px[i, 0] = c
        else:
            px[0, i] = c
    return strip.resize((size, size), Image.NEAREST)


def _circle_box(r, size):
    return [round((0.5 - r) * size), round((0.5 - r) * size),
            round((0.5 + r) * size), round((0.5 + r) * size)]


def _ring_geometry(size):
    """Optically sized ring: the artwork's 4.6% weight scales down to under a pixel
    at 16px, so small icons get a heavier ring and a correspondingly tighter disc."""
    w = min(RING_W_MAX, max(RING_W, RING_MIN_PX / size))
    return w, R_OUT - w


def _glow(size):
    """Radial horizon glow. Concentric ellipses painted large-to-small leave the
    alpha falloff in place, so no per-pixel blending is needed."""
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    steps = 40
    for i in range(steps, 0, -1):
        f = i / steps
        a = int(255 * GLOW["peak"] * ((1.0 - f) ** 2.2))
        if a <= 0:
            continue
        r = GLOW["radius"] * size * f
        cx, cy = GLOW["cx"] * size, GLOW["cy"] * size
        d.ellipse([cx - r, cy - r, cx + r, cy + r],
                  fill=GLOW["color"] + (a,))
    return layer


# ── Shape helpers ─────────────────────────────────────────────────────────────

def _pts(points, size):
    return [(x * size, y * size) for x, y in points]


def _draw_range(layer, size, rng, with_facets):
    """One mountain range, drawn opaque with optional sunlit flank facets that are
    clipped to the range's own silhouette so they can never spill onto the sky."""
    body = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ridge = rng["ridge"]
    poly = ridge + [(ridge[-1][0], 1.06), (ridge[0][0], 1.06)]
    ImageDraw.Draw(body).polygon(_pts(poly, size), fill=rng["color"] + (255,))

    if with_facets and rng["facet_apexes"]:
        facets = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        fd = ImageDraw.Draw(facets)
        for ax, ay in rng["facet_apexes"]:
            fd.polygon(
                _pts([(ax, ay), (ax + 0.085, ay + 0.185), (ax + 0.030, ay + 0.170)],
                     size),
                fill=rng["facet_color"] + (255,),
            )
        facets.putalpha(ImageChops.multiply(facets.getchannel("A"),
                                            body.getchannel("A")))
        body.alpha_composite(facets)

    layer.alpha_composite(body)


def _lens_poly(cx, cy, rx, ry, p=1.6, samples=28):
    """Tapered lens outline -- pointed cloud ends rather than a flat ellipse slab."""
    top, bottom = [], []
    for i in range(samples + 1):
        u = -1.0 + 2.0 * i / samples
        dy = ry * (1.0 - abs(u) ** p)
        top.append((cx + u * rx, cy - dy))
        bottom.append((cx + u * rx, cy + dy))
    return top + bottom[::-1]


def _band_points(base, amp, freq, phase):
    pts = []
    for i in range(BAND_SAMPLES + 1):
        t = i / BAND_SAMPLES
        x = BAND_SPAN[0] + (BAND_SPAN[1] - BAND_SPAN[0]) * t
        pts.append((x, base + amp * math.sin(2.0 * math.pi * (freq * t + phase))))
    return pts


def _draw_band(layer, size, spec, with_crest):
    base, amp, freq, phase, fill, crest = spec
    pts = _band_points(base, amp, freq, phase)
    d = ImageDraw.Draw(layer)
    d.polygon(_pts(pts + [(BAND_SPAN[1], 1.06), (BAND_SPAN[0], 1.06)], size), fill=fill + (255,))
    if crest and with_crest:
        width = max(1, round(0.011 * size))
        d.line(_pts(pts, size), fill=crest + (255,), width=width, joint="curve")


def _detail_level(size):
    """How much of the landscape survives at this size (see module docstring)."""
    if size < 20:
        return 0        # 16px  -- ring + peak + green base
    if size < 48:
        return 1        # 20-47 -- one range, one hill band, no clouds
    if size < 96:
        return 2        # 48-95 -- all ranges, clouds, no facets
    return 3            # 96+   -- full artwork


def draw_mark(size: int, background=None) -> Image.Image:
    """Render the emblem at size x size (RGBA; transparent unless `background`)."""
    level = _detail_level(size)
    ss = 8 if size <= 32 else (6 if size <= 64 else (4 if size <= 160 else 2))
    big = size * ss

    if level == 0:
        sky_stops, clouds, ranges, facets = SKY_STOPS_TINY, CLOUDS_TINY, None, False
        forests, hills = [], [HILL_LAYERS[1]]
        with_glow = False
    elif level == 1:
        sky_stops, clouds, ranges, facets = SKY_STOPS_LITE, CLOUDS_LITE, RANGES[1:2], False
        forests, hills = [], [HILL_LAYERS[1]]
        with_glow = True
    elif level == 2:
        sky_stops, clouds, ranges, facets = SKY_STOPS, CLOUDS, RANGES, False
        forests, hills = FOREST_LAYERS[:1], HILL_LAYERS[:2]
        with_glow = True
    else:
        sky_stops, clouds, ranges, facets = SKY_STOPS, CLOUDS, RANGES, True
        forests, hills = FOREST_LAYERS, HILL_LAYERS
        with_glow = True

    art = _gradient(big, sky_stops, horizontal=False).convert("RGBA")

    if with_glow:
        art.alpha_composite(_glow(big))

    cd = ImageDraw.Draw(art)
    for cx, cy, rx, ry, color in clouds:
        cd.polygon(_pts(_lens_poly(cx, cy, rx, ry), big), fill=color + (255,))

    if ranges is None:
        _draw_range(art, big, {"ridge": TINY_PEAK, "color": (18, 60, 130),
                               "facet_color": None, "facet_apexes": []}, False)
    else:
        for rng in ranges:
            _draw_range(art, big, rng, facets)

    for spec in forests:
        _draw_band(art, big, spec, level >= 3)
    for spec in hills:
        _draw_band(art, big, spec, level >= 2)

    # Trim the artwork to the disc, then lay the ring on top of the seam.
    ring_w, r_in = _ring_geometry(size)
    disc = Image.new("L", (big, big), 0)
    ImageDraw.Draw(disc).ellipse(_circle_box(r_in + 0.002, big), fill=255)

    out = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    out.paste(art, (0, 0), disc)
    out.paste(_gradient(big, RING_STOPS, horizontal=True).convert("RGBA"), (0, 0),
              _ring_mask(big, r_in))

    out = out.resize((size, size), Image.LANCZOS)

    if background is not None:
        flat = Image.new("RGBA", out.size, background + (255,))
        flat.alpha_composite(out)
        out = flat
    return out


def _ring_mask(size, r_in):
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.ellipse(_circle_box(R_OUT, size), fill=255)
    d.ellipse(_circle_box(r_in, size), fill=0)
    return mask


# ── SVG (same geometry, true vector) ──────────────────────────────────────────

def _hex(rgb) -> str:
    return "#{:02X}{:02X}{:02X}".format(*rgb)


def _svg_points(points, size) -> str:
    return " ".join(f"{x * size:.1f},{y * size:.1f}" for x, y in points)


def _svg_range_polygon(rng, size) -> str:
    ridge = rng["ridge"]
    return _svg_points(ridge + [(ridge[-1][0], 1.06), (ridge[0][0], 1.06)], size)


def _svg_band_path(spec, size) -> str:
    pts = _band_points(spec[0], spec[1], spec[2], spec[3])
    head = f"M {_svg_points(pts, size).replace(' ', ' L ')}"
    return (f'{head} L {BAND_SPAN[1] * size:.1f},{1.06 * size:.1f} '
            f'L {BAND_SPAN[0] * size:.1f},{1.06 * size:.1f} Z')


def svg_mark(size: int = MASTER) -> str:
    """True-vector, self-contained SVG emblem (no external refs, no embedded raster)."""
    out = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" '
        f'width="{size}" height="{size}" role="img" '
        f'aria-label="ARAVINDHA — Disaster Intelligence">',
        "  <title>ARAVINDHA — Disaster Intelligence</title>",
        "  <defs>",
        f'    <linearGradient id="sky" gradientUnits="userSpaceOnUse" '
        f'x1="0" y1="0" x2="0" y2="{size}">',
    ]
    for t, c in SKY_STOPS:
        out.append(f'      <stop offset="{t:.4f}" stop-color="{_hex(c)}"/>')
    out += [
        "    </linearGradient>",
        f'    <linearGradient id="ring" gradientUnits="userSpaceOnUse" '
        f'x1="0" y1="0" x2="{size}" y2="0">',
    ]
    for t, c in RING_STOPS:
        out.append(f'      <stop offset="{t:.2f}" stop-color="{_hex(c)}"/>')
    out += [
        "    </linearGradient>",
        f'    <radialGradient id="glow" gradientUnits="userSpaceOnUse" '
        f'cx="{GLOW["cx"] * size:.1f}" cy="{GLOW["cy"] * size:.1f}" '
        f'r="{GLOW["radius"] * size:.1f}">',
        f'      <stop offset="0" stop-color="{_hex(GLOW["color"])}" '
        f'stop-opacity="{GLOW["peak"]:.2f}"/>',
        f'      <stop offset="1" stop-color="{_hex(GLOW["color"])}" stop-opacity="0"/>',
        "    </radialGradient>",
        f'    <clipPath id="disc"><circle cx="{size / 2:.1f}" cy="{size / 2:.1f}" '
        f'r="{(R_IN + 0.002) * size:.1f}"/></clipPath>',
    ]
    for i, rng in enumerate(RANGES):
        out.append(f'    <clipPath id="range{i}"><polygon '
                   f'points="{_svg_range_polygon(rng, size)}"/></clipPath>')
    out += [
        "  </defs>",
        '  <g clip-path="url(#disc)">',
        f'    <rect width="{size}" height="{size}" fill="url(#sky)"/>',
        f'    <rect width="{size}" height="{size}" fill="url(#glow)"/>',
    ]
    for cx, cy, rx, ry, c in CLOUDS:
        out.append(f'    <polygon points="{_svg_points(_lens_poly(cx, cy, rx, ry), size)}" '
                   f'fill="{_hex(c)}"/>')
    for i, rng in enumerate(RANGES):
        out.append(f'    <g clip-path="url(#range{i})">')
        out.append(f'      <polygon points="{_svg_range_polygon(rng, size)}" '
                   f'fill="{_hex(rng["color"])}"/>')
        if rng["facet_color"]:
            for ax, ay in rng["facet_apexes"]:
                out.append(
                    f'      <polygon points="{_svg_points([(ax, ay), (ax + 0.085, ay + 0.185), (ax + 0.030, ay + 0.170)], size)}" '
                    f'fill="{_hex(rng["facet_color"])}"/>')
        out.append("    </g>")
    for spec in FOREST_LAYERS:
        out.append(f'    <path d="{_svg_band_path(spec, size)}" '
                   f'fill="{_hex(spec[4])}"/>')
        if spec[5]:
            pts = _svg_points(_band_points(spec[0], spec[1], spec[2], spec[3]), size)
            out.append(f'    <polyline points="{pts}" fill="none" '
                       f'stroke="{_hex(spec[5])}" stroke-width="{0.011 * size:.1f}"/>')
    for spec in HILL_LAYERS:
        out.append(f'    <path d="{_svg_band_path(spec, size)}" '
                   f'fill="{_hex(spec[4])}"/>')
        if spec[5]:
            pts = _svg_points(_band_points(spec[0], spec[1], spec[2], spec[3]), size)
            out.append(f'    <polyline points="{pts}" fill="none" '
                       f'stroke="{_hex(spec[5])}" stroke-width="{0.011 * size:.1f}"/>')
    out += [
        "  </g>",
        f'  <circle cx="{size / 2:.1f}" cy="{size / 2:.1f}" '
        f'r="{(R_OUT - RING_W / 2) * size:.1f}" fill="none" stroke="url(#ring)" '
        f'stroke-width="{RING_W * size:.1f}"/>',
        "</svg>",
        "",
    ]
    return "\n".join(out)


# ── Writers ───────────────────────────────────────────────────────────────────

def _write_svg(name: str) -> None:
    path = os.path.join(PUBLIC, name)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(svg_mark())
    print(f"  {name:24s} {MASTER}x{MASTER} (vector)")


def _write_png(name: str, size: int, background=None) -> None:
    """Draw the emblem AT this size, so size-dependent detail rules apply.
    Resizing the 1024px master down would silently keep full detail at 16px."""
    out = draw_mark(size, background=background)
    out.save(os.path.join(PUBLIC, name), "PNG", optimize=True)
    print(f"  {name:24s} {size}x{size}")


def _write_ico(sizes=(16, 32, 48, 64)) -> None:
    """Multi-size ICO, each frame drawn at its own resolution for crisp pixels."""
    frames = [draw_mark(s) for s in sizes]
    frames[-1].save(
        os.path.join(PUBLIC, "favicon.ico"),
        "ICO",
        sizes=[(s, s) for s in sizes],
        append_images=frames[:-1],
    )
    print(f"  {'favicon.ico':24s} {'/'.join(str(s) for s in sizes)}")


def main() -> None:
    print("Building ARAVINDHA landscape emblem logo + favicon set")

    # The prototype's own asset paths, replaced in place (no new files).
    _write_png("ner-logo.png", 512)         # sidebar logo, used by src/main.js
    _write_png("ner-logo-badge.png", 256)   # app badge

    _write_ico()
    _write_svg("favicon.svg")
    _write_png("favicon-32.png", 32)
    _write_png("favicon-192.png", 192)
    _write_png("favicon-512.png", 512)
    _write_png("apple-touch-icon.png", 180, background=NAVY)
    print("Done.")


if __name__ == "__main__":
    main()
