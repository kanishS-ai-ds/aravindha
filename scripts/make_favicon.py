"""
Build the ARAVINDHA favicon / app-icon set from the source NER logo.

Source   : public/ner-logo.png   (transparent PNG, blue ring + coloured NER states map)
Output   : public/favicon.ico    (16/32/48/64)
           public/favicon-32.png
           public/favicon-192.png
           public/favicon-512.png
           public/apple-touch-icon.png (180x180, opaque)
           public/favicon.svg    (scalable, embeds a 256px badge)

The badge is an amber rounded square (sampled from the reference app-icon render,
rgb(213,124,10)) with the logo centred at ~86% of the canvas, which is what makes the
mark readable at 16x16 where a transparent-background map would disappear.

Run:  python scripts/make_favicon.py
"""

from __future__ import annotations

import base64
import io
import os

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, "public")
SOURCE = os.path.join(PUBLIC, "ner-logo.png")

MASTER = 1024          # master canvas size
BADGE = (213, 124, 10)  # amber badge fill (#D57C0A)
RADIUS_RATIO = 0.22     # app-icon style rounded corners
LOGO_RATIO = 0.86       # logo width as a fraction of the canvas


def build_master() -> Image.Image:
    logo = Image.open(SOURCE).convert("RGBA")
    # Trim the transparent margins so the artwork scales predictably.
    logo = logo.crop(logo.split()[3].getbbox())

    side = int(MASTER * LOGO_RATIO)
    scale = min(side / logo.width, side / logo.height)
    logo = logo.resize(
        (max(1, round(logo.width * scale)), max(1, round(logo.height * scale))),
        Image.LANCZOS,
    )

    canvas = Image.new("RGBA", (MASTER, MASTER), (0, 0, 0, 0))
    mask = Image.new("L", (MASTER, MASTER), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, MASTER - 1, MASTER - 1),
        radius=int(MASTER * RADIUS_RATIO),
        fill=255,
    )

    badge = Image.new("RGBA", (MASTER, MASTER), BADGE + (255,))
    badge.putalpha(mask)
    canvas.alpha_composite(badge)
    canvas.alpha_composite(
        logo,
        ((MASTER - logo.width) // 2, (MASTER - logo.height) // 2),
    )
    return canvas


def flatten(img: Image.Image, bg=(255, 255, 255, 255)) -> Image.Image:
    """Composite onto an opaque background (required for apple-touch-icon)."""
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
    """Vector container for the raster badge - keeps /favicon.svg working."""
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
    path = os.path.join(PUBLIC, "favicon.ico")
    master.resize((64, 64), Image.LANCZOS).save(
        path, "ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)]
    )
    print(f"  {'favicon.ico':24s} 16/32/48/64")


def main() -> None:
    if not os.path.exists(SOURCE):
        raise SystemExit(f"source logo not found: {SOURCE}")

    print("Building ARAVINDHA favicon set from", os.path.relpath(SOURCE, ROOT))
    master = build_master()

    ico(master)
    svg(master)
    png(master, "favicon-32.png", 32)
    png(master, "favicon-192.png", 192)
    png(master, "favicon-512.png", 512)
    png(master, "apple-touch-icon.png", 180, opaque=True)

    master.resize((256, 256), Image.LANCZOS).save(
        os.path.join(PUBLIC, "ner-logo-badge.png"), "PNG", optimize=True
    )
    print(f"  {'ner-logo-badge.png':24s} 256x256")
    print("Done.")


if __name__ == "__main__":
    main()
