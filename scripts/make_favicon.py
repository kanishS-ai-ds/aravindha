"""
Build the ARAVINDHA favicon / app-icon set.

Source   : public/ner-logo.png   (transparent PNG — blue ring + coloured NER states map)
Output   : public/favicon.ico    (16/32/48/64)
           public/favicon-32.png
           public/favicon-192.png
           public/favicon-512.png
           public/apple-touch-icon.png (180x180, opaque)
           public/favicon.svg    (scalable, embeds a 256px tile)
           public/ner-logo-badge.png (256x256)

Geometry is derived from the source at runtime rather than hard-coded:

  * The icon is a FULL-BLEED square amber tile (no rounded corners, no padding).
  * The artwork is scaled so the blue ring occupies TARGET_RING_FRAC of the canvas,
    then centred — matching the ARAVINDHA app-icon reference (ring at 94.3%).
    The source logo has the ring at only ~85% of its canvas, which leaves too much
    dead margin once it becomes a tab icon, so the ring is measured and scaled up.

Run:  python scripts/make_favicon.py
"""

from __future__ import annotations

import base64
import io
import os

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, "public")
SOURCE = os.path.join(PUBLIC, "ner-logo.png")

MASTER = 1024            # master tile size
BADGE = (213, 124, 10)   # amber tile fill (#D57C0A)
TARGET_RING_FRAC = 0.943  # ring diameter as a fraction of the tile (from the reference)
OPAQUE = 150             # alpha above which a pixel counts as visible


def measure_ring_px(logo: Image.Image) -> int:
    """Diameter of the blue ring in the given image, in pixels."""
    arr = np.asarray(logo.convert("RGBA")).astype(int)
    rgb, alpha = arr[:, :, :3], arr[:, :, 3]
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    ring = (alpha > OPAQUE) & (b > 110) & (r < 100) & (g < 140)
    ys, xs = np.where(ring)
    if xs.size == 0:
        raise SystemExit("could not locate the blue ring in the source logo")
    return int(max(xs.max() - xs.min(), ys.max() - ys.min()))


def build_master() -> Image.Image:
    logo = Image.open(SOURCE).convert("RGBA")

    # Drop stray near-invisible pixels so sizing stays predictable.
    logo = logo.crop(
        Image.fromarray((np.asarray(logo)[:, :, 3] > 8).astype("uint8") * 255).getbbox()
    )

    # Scale so the ring ends up at an ABSOLUTE diameter on the master tile. Scaling
    # against the canvas width instead would drift, because the canvas shrinks as the
    # transparent margin is trimmed.
    ring_px = measure_ring_px(logo)
    scale = (TARGET_RING_FRAC * MASTER) / ring_px
    logo = logo.resize(
        (max(1, round(logo.width * scale)), max(1, round(logo.height * scale))),
        Image.LANCZOS,
    )

    # The ring sits at the centre of the logo, so centring the logo centres the ring.
    # Whatever falls outside the tile is the now-redundant transparent margin.
    if logo.width > MASTER or logo.height > MASTER:
        left = (logo.width - MASTER) // 2
        top = (logo.height - MASTER) // 2
        logo = logo.crop((left, top, left + MASTER, top + MASTER))
    else:
        padded = Image.new("RGBA", (MASTER, MASTER), (0, 0, 0, 0))
        padded.alpha_composite(logo, ((MASTER - logo.width) // 2, (MASTER - logo.height) // 2))
        logo = padded

    tile = Image.new("RGBA", (MASTER, MASTER), BADGE + (255,))
    tile.alpha_composite(logo)
    return tile


def flatten(img: Image.Image, bg=(255, 255, 255, 255)) -> Image.Image:
    """Composite onto an opaque background; the tile is already opaque, so this
    mainly guards against any residual transparency."""
    out = Image.new("RGBA", img.size, bg)
    out.alpha_composite(img)
    return out.convert("RGB")


def png(img: Image.Image, name: str, size: int, opaque: bool = False) -> None:
    resized = img.resize((size, size), Image.LANCZOS)
    if opaque:
        resized = flatten(resized)
    resized.save(os.path.join(PUBLIC, name), "PNG", optimize=True)
    print(f"  {name:24s} {size}x{size}")


def svg(master: Image.Image) -> None:
    """Vector container for the raster tile — keeps /favicon.svg working."""
    buf = io.BytesIO()
    master.resize((256, 256), Image.LANCZOS).save(buf, "PNG", optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    out = (
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
        'viewBox="0 0 1024 1024" width="1024" height="1024">\n'
        '  <title>ARAVINDHA - North Eastern Region</title>\n'
        f'  <image width="1024" height="1024" xlink:href="data:image/png;base64,{b64}"/>\n'
        "</svg>\n"
    )
    with open(os.path.join(PUBLIC, "favicon.svg"), "w", encoding="utf-8") as fh:
        fh.write(out)
    print(f"  {'favicon.svg':24s} 1024x1024 (embedded 256px)")


def ico(master: Image.Image) -> None:
    master.resize((64, 64), Image.LANCZOS).save(
        os.path.join(PUBLIC, "favicon.ico"),
        "ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64)],
    )
    print(f"  {'favicon.ico':24s} 16/32/48/64")


def main() -> None:
    if not os.path.exists(SOURCE):
        raise SystemExit(f"source logo not found: {SOURCE}")

    src = Image.open(SOURCE).convert("RGBA")
    print("Building ARAVINDHA favicon set from", os.path.relpath(SOURCE, ROOT))
    print(f"  source ring: {measure_ring_px(src)}px of {src.width}px canvas"
          f"  ->  target ring {TARGET_RING_FRAC:.3f} of the tile")
    master = build_master()

    ico(master)
    svg(master)
    png(master, "favicon-32.png", 32)
    png(master, "favicon-192.png", 192)
    png(master, "favicon-512.png", 512)
    png(master, "apple-touch-icon.png", 180, opaque=True)
    png(master, "ner-logo-badge.png", 256)
    print("Done.")


if __name__ == "__main__":
    main()
