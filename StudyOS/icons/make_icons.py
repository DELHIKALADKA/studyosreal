"""
Rasterise the StudyOS mark into the PNG sizes the PWA manifest needs.

No SVG rasteriser is required — the geometry is redrawn with Pillow at 8x
and downsampled, which gives clean edges. The curves are sampled from
quadratic beziers so the book cover reads as a curve, not a polygon.

Run from the icons/ folder:

    python make_icons.py
"""
from PIL import Image, ImageDraw

S = 64          # design grid (matches the SVG viewBox)
SS = 8          # supersample factor

INK_DARK = (244, 247, 251, 255)   # white ink -> dark tile
TILE_DARK = (20, 24, 33, 255)
INK_LIGHT = (22, 35, 60, 255)     # navy ink  -> white tile
TILE_LIGHT = (255, 255, 255, 255)
BLUE = ((47, 124, 246), (106, 168, 255))
GREEN = ((47, 195, 154), (87, 217, 176))


def q(p0, p1, p2, n=26):
    """Sample a quadratic bezier."""
    out = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        out.append((u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
                    u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]))
    return out


def px(pts):
    return [(x * SS, y * SS) for x, y in pts]


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient(size, c0, c1, mask):
    """Vertical gradient clipped to `mask`."""
    g = Image.new("RGB", (size, size))
    d = ImageDraw.Draw(g)
    for i in range(size):
        d.line([(0, i), (size, i)], fill=lerp(c0, c1, i / max(1, size - 1)))
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(g, (0, 0), mask)
    return out


def book_cover():
    """Outer silhouette of the open book: spine at centre, two curved wings."""
    return (
        q((32, 33.2), (24.5, 26.4), (11.5, 25.4))          # spine -> left top
        + [(11.5, 47.2)]
        + q((11.5, 47.2), (24.5, 48.4), (32, 55.4))        # left bottom -> spine
        + q((32, 55.4), (39.5, 48.4), (52.5, 47.2))        # spine -> right bottom
        + [(52.5, 25.4)]
        + q((52.5, 25.4), (39.5, 26.4), (32, 33.2))        # right top -> spine
    )


def page(side):
    """Inner page block. side = -1 left, +1 right."""
    inner_x = 32 + side * 1.0
    outer_x = 32 + side * 16.6
    ctrl = 32 + side * 8.5
    return (
        q((inner_x, 36.4), (ctrl, 30.9), (outer_x, 30.2))
        + [(outer_x, 43.4)]
        + q((outer_x, 43.4), (ctrl, 44.1), (inner_x, 49.6))
    )


def build(ink, tile, radius=True):
    n = S * SS
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    if radius:
        d.rounded_rectangle([0, 0, n - 1, n - 1], radius=15 * SS, fill=tile)
    else:
        d.rectangle([0, 0, n - 1, n - 1], fill=tile)

    # ---- book cover ----
    d.polygon(px(book_cover()), fill=ink)

    # ---- pages: gradient fill, then a tile-coloured outline as the seam ----
    for side, cols in ((-1, BLUE), (1, GREEN)):
        pts = page(side)
        mask = Image.new("L", (n, n), 0)
        ImageDraw.Draw(mask).polygon(px(pts), fill=255)
        img.alpha_composite(gradient(n, cols[0], cols[1], mask))
        d.line(px(pts + [pts[0]]), fill=tile, width=round(1.9 * SS), joint="curve")

    # ---- mortarboard ----
    # The cap base is drawn on top of the cover, so no seam is needed between them.
    d.polygon(px([(23.6, 20.0), (23.6, 26.2)]
                 + q((23.6, 26.2), (32, 30.4), (40.4, 26.2))
                 + [(40.4, 20.0)]), fill=ink)
    top = [(32, 6.6), (55.4, 16.2), (32, 25.8), (8.6, 16.2)]
    d.polygon(px(top), fill=ink)
    d.line(px(top + [top[0]]), fill=tile, width=round(1.5 * SS), joint="curve")
    # tassel — thin cord from the cap's right corner, weighted with a bead
    d.line(px([(48.4, 20.2), (48.4, 27.4)]), fill=ink, width=round(1.5 * SS))
    r = 2.4 * SS
    cx, cy = 48.4 * SS, 29.4 * SS
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=ink)

    return img


def save(img, name, size):
    img.resize((size, size), Image.LANCZOS).save(name)
    print("wrote", name)


dark = build(INK_DARK, TILE_DARK)
light = build(INK_LIGHT, TILE_LIGHT)

# App icons use the dark tile — it reads well on both iOS and Android grids.
save(dark, "icon-192.png", 192)
save(dark, "icon-512.png", 512)
save(dark, "icon-180.png", 180)   # apple-touch-icon
save(dark, "favicon-32.png", 32)
save(light, "icon-light-512.png", 512)

# Maskable needs ~10% safe padding so launchers can crop to any shape.
full = build(INK_DARK, TILE_DARK, radius=False)
pad = Image.new("RGBA", (full.width, full.height), TILE_DARK)
inner = full.resize((round(full.width * 0.78),) * 2, Image.LANCZOS)
off = (full.width - inner.width) // 2
pad.alpha_composite(inner, (off, off))
save(pad, "icon-maskable-512.png", 512)
