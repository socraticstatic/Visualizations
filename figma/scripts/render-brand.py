#!/usr/bin/env python3
"""
Brand assets, rendered per-pixel.

The mark is one colour as four people receive it: normal vision, deutan,
protan, and total colour blindness, with the base colour at the centre. The
base was searched with the plugin's own engine, not chosen by eye: the colour
whose four simulated views are maximally distinct while all clearing the
non-text contrast floor on the mark's ground.

Drawn as a field rather than with shape primitives, because flat arcs looked
flat. Each quadrant carries an angular sweep and a radial tube shade, the gaps
fall off smoothly, the ring throws a soft glow onto the ground, and the centre
is lit like a sphere.

Local and supersampled. Rasterising through a browser corrupted a PNG once with
the byte count intact, and sips reported it fine because sips only reads the
header.
"""
import math

import numpy as np
from PIL import Image

SS = 4
GROUND = np.array([0x14, 0x17, 0x1A], dtype=float)

# Engine output for base #f20ddf: normal, deutan, protan, achromatopsia.
VIEWS = [
    np.array([0xF2, 0x0D, 0xDF], dtype=float),
    np.array([0x70, 0x92, 0xDA], dtype=float),
    np.array([0x00, 0x75, 0xE4], dtype=float),
    np.array([0x88, 0x88, 0x88], dtype=float),
]

R_OUT, R_IN, R_DOT = 46.0, 27.0, 11.0
GAP_DEG, START_DEG = 9.0, -45.0
CORNER = 28.0

# One mark, two tunings. The full geometry is the master and is what ships
# anywhere the mark is drawn at 32px or larger. Below that the ring, the gaps
# and the centre dot collapse into a blob - rendered at 16px and looked at,
# not assumed - so the small tuning opens the gaps, widens the ring inward and
# drops the dot. Same four views, same colours, same silhouette; only the
# detail that cannot survive the size is removed.
SMALL = {"R_OUT": 48.0, "R_IN": 16.0, "R_DOT": -2.0, "GAP_DEG": 14.0}


def use_geometry(**kw):
    """Temporarily override the module-level geometry."""
    prev = {k: globals()[k] for k in kw}
    globals().update(kw)
    return prev


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def relative_luminance(rgb):
    c = rgb / 255.0
    lin = np.where(c <= 0.03928, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * lin[..., 0] + 0.7152 * lin[..., 1] + 0.0722 * lin[..., 2]


def contrast(a, b):
    la, lb = relative_luminance(a), relative_luminance(b)
    hi, lo = np.maximum(la, lb), np.minimum(la, lb)
    return (hi + 0.05) / (lo + 0.05)


TUBE_MIN = 1.0 - 0.34
FLOOR_RATIO = 3.3  # margin over the 3:1 non-text floor


def min_factor(colour):
    """
    The darkest a view can be scaled to and still clear the contrast floor.

    The sweep gradient used to be a chosen range, which pushed the grey view
    down to 1.02:1 against the ground. The floor is derived now, so the audit
    passes by construction rather than by luck.
    """
    lo, hi = 0.05, 1.0
    for _ in range(40):
        mid = (lo + hi) / 2
        if contrast(np.clip(colour * mid * TUBE_MIN, 0, 255), GROUND) >= FLOOR_RATIO:
            hi = mid
        else:
            lo = mid
    return hi


def render(size):
    n = size * SS
    k = size / 128.0 * SS
    cx = cy = n / 2.0

    yy, xx = np.mgrid[0:n, 0:n]
    px, py = xx + 0.5 - cx, yy + 0.5 - cy
    r = np.hypot(px, py) / k                      # authored units
    ang = (np.degrees(np.arctan2(py, px)) - START_DEG) % 360.0

    rgb = np.repeat(GROUND[None, None, :], n, 0).repeat(n, 1)

    # A faint lift toward the middle so the tile is not a dead slab.
    lift = (1.0 - smoothstep(0.0, 62.0, r))[..., None] * 9.0
    rgb = rgb + lift

    quad = np.clip((ang // 90).astype(int), 0, 3)
    within = ang - quad * 90.0                    # 0..90 inside the quadrant

    # Soft gap at each quadrant boundary.
    gap = np.minimum(within, 90.0 - within)
    gap_a = smoothstep(0.0, GAP_DEG, gap)

    # Ring edges, softened.
    ring_a = smoothstep(R_IN - 1.0, R_IN + 0.9, r) * (1.0 - smoothstep(R_OUT - 0.9, R_OUT + 1.0, r))
    ring_a = ring_a * gap_a

    t = np.clip((within - GAP_DEG) / (90.0 - 2 * GAP_DEG), 0.0, 1.0)   # sweep
    u = np.clip((r - R_IN) / (R_OUT - R_IN), 0.0, 1.0)                 # across
    tube = 1.0 - 0.34 * (2.0 * u - 1.0) ** 2                           # lit tube

    view = np.zeros((n, n, 3), dtype=float)
    base = np.zeros((n, n), dtype=float)
    for i, colour in enumerate(VIEWS):
        m = quad == i
        view[m] = colour
        base[m] = min_factor(colour)

    # Sweep from each view's own contrast floor up to a slight overbright.
    shade = (base + (1.14 - base) * t) * tube
    ring_rgb = np.clip(view * shade[..., None], 0, 255)

    # Glow: the ring spilling onto the ground, inside and out.
    glow_out = (1.0 - smoothstep(R_OUT, R_OUT + 13.0, r)) * smoothstep(R_OUT - 0.5, R_OUT + 0.5, r)
    glow_in = (1.0 - smoothstep(R_IN - 13.0, R_IN, r)) * (1.0 - smoothstep(R_IN - 0.5, R_IN + 0.5, r))
    glow = np.clip(glow_out + glow_in, 0, 1) * 0.26 * gap_a
    rgb = rgb + view * glow[..., None] * 0.55

    rgb = rgb * (1.0 - ring_a[..., None]) + ring_rgb * ring_a[..., None]

    # Centre dot, lit from the upper left.
    d = np.hypot(px + 3.0 * k, py + 3.0 * k) / k
    dot_a = 1.0 - smoothstep(R_DOT - 1.0, R_DOT + 0.6, np.hypot(px, py) / k)
    sphere = np.clip(1.22 - 0.62 * (d / R_DOT), 0.35, 1.32)
    dot_rgb = np.clip(VIEWS[0] * sphere[..., None], 0, 255)
    rgb = rgb * (1.0 - dot_a[..., None]) + dot_rgb * dot_a[..., None]

    # Rounded-rect tile.
    q = np.abs(np.stack([px, py], -1)) - (n / 2.0 - CORNER * k)
    outside = np.hypot(np.maximum(q[..., 0], 0), np.maximum(q[..., 1], 0)) - CORNER * k
    inside = np.minimum(np.maximum(q[..., 0], q[..., 1]), 0.0)
    tile_a = 1.0 - smoothstep(-1.0, 1.0, outside + inside)

    out = np.dstack([np.clip(rgb, 0, 255), tile_a * 255.0]).astype(np.uint8)
    return Image.fromarray(out, "RGBA").resize((size, size), Image.LANCZOS)


def verify(path, size):
    """Audit the artifact, not the intent."""
    im = Image.open(path).convert("RGBA")
    assert im.size == (size, size), f"{path}: {im.size}"
    a = np.asarray(im).astype(float)
    k = size / 128.0
    c = size / 2.0

    yy, xx = np.mgrid[0:size, 0:size]
    pxx, pyy = xx + 0.5 - c, yy + 0.5 - c
    r = np.hypot(pxx, pyy) / k

    # The gaps between quadrants are deliberately ground-coloured, so measuring
    # them against the ground and demanding 3:1 asks the art to be something it
    # is not. Exclude them; an earlier version of this check did not, and
    # reported the render as broken when the mask was.
    ang = (np.degrees(np.arctan2(pyy, pxx)) - START_DEG) % 360.0
    within = ang - np.clip((ang // 90).astype(int), 0, 3) * 90.0
    off_gap = np.minimum(within, 90.0 - within) > GAP_DEG + 2.0

    assert a[2, 2, 3] == 0, f"{path}: corner not transparent"

    ring = (r > R_IN + 3) & (r < R_OUT - 3) & (a[..., 3] > 250) & off_gap
    ring_px = a[ring][:, :3]
    assert ring_px.shape[0] > 200, f"{path}: ring too small, {ring_px.shape[0]} px"

    worst = contrast(ring_px, GROUND).min()
    assert worst >= 3.0, f"{path}: a ring pixel is {worst:.2f}:1 on the ground"

    spread = ring_px.std(axis=0).mean()
    assert spread > 18.0, f"{path}: ring is too flat, channel spread {spread:.1f}"

    print(f"verified {path} {size}px: {ring_px.shape[0]} ring px, worst {worst:.2f}:1, spread {spread:.1f}")



# ---------------------------------------------------------------------------
# Site assets. The mark is the brand, so every surface draws the same one:
# browser tab, home-screen icon, the tile in the app's own sticky bar, the
# Figma plugin, the community cover. Generated here rather than hand-drawn
# anywhere else, so they cannot drift apart.
# ---------------------------------------------------------------------------

def _pt(deg, r):
    a = math.radians(deg)
    return 64.0 + r * math.cos(a), 64.0 + r * math.sin(a)


def svg_mark():
    """
    The mark as vector, for the tab icon.

    Uses the SMALL tuning: an svg favicon is rasterised by the browser at
    whatever size it wants, which is usually 16 or 32, so the geometry that
    survives those is the one that belongs in the vector. The gradients are a
    flat-sweep approximation of the per-pixel render - at tab size the
    difference is not resolvable, and the silhouette and colours are identical.
    """
    prev = use_geometry(**SMALL)
    try:
        segs, grads = [], []
        for i, colour in enumerate(VIEWS):
            a0 = START_DEG + i * 90.0 + GAP_DEG
            a1 = START_DEG + (i + 1) * 90.0 - GAP_DEG
            ox0, oy0 = _pt(a0, R_OUT)
            ox1, oy1 = _pt(a1, R_OUT)
            ix1, iy1 = _pt(a1, R_IN)
            ix0, iy0 = _pt(a0, R_IN)
            d = (
                f"M{ox0:.2f} {oy0:.2f}"
                f"A{R_OUT:.2f} {R_OUT:.2f} 0 0 1 {ox1:.2f} {oy1:.2f}"
                f"L{ix1:.2f} {iy1:.2f}"
                f"A{R_IN:.2f} {R_IN:.2f} 0 0 0 {ix0:.2f} {iy0:.2f}Z"
            )
            lo = min_factor(colour)
            c0 = np.clip(colour * lo, 0, 255).astype(int)
            c1 = np.clip(colour * 1.14, 0, 255).astype(int)
            grads.append(
                f'    <linearGradient id="q{i}" gradientUnits="userSpaceOnUse" '
                f'x1="{ox0:.2f}" y1="{oy0:.2f}" x2="{ox1:.2f}" y2="{oy1:.2f}">'
                f'<stop offset="0" stop-color="#{c0[0]:02x}{c0[1]:02x}{c0[2]:02x}"/>'
                f'<stop offset="1" stop-color="#{c1[0]:02x}{c1[1]:02x}{c1[2]:02x}"/>'
                f"</linearGradient>"
            )
            segs.append(f'  <path d="{d}" fill="url(#q{i})"/>')
        g = int(GROUND[0]), int(GROUND[1]), int(GROUND[2])
        return (
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" '
            'role="img" aria-label="Chart Color System">\n'
            "  <defs>\n"
            f'    <radialGradient id="tile" cx="0.5" cy="0.42" r="0.75">'
            f'<stop offset="0" stop-color="#1d2126"/>'
            f'<stop offset="1" stop-color="#{g[0]:02x}{g[1]:02x}{g[2]:02x}"/>'
            "</radialGradient>\n" + "\n".join(grads) + "\n  </defs>\n"
            f'  <rect width="128" height="128" rx="{CORNER:.0f}" fill="url(#tile)"/>\n'
            + "\n".join(segs)
            + "\n</svg>\n"
        )
    finally:
        use_geometry(**prev)


def write_ico(path, images):
    """
    A multi-size .ico carrying a DIFFERENT image per size.

    Pillow's ICO writer resamples one source into every size, which would put
    the full geometry into the 16px entry - the exact thing that does not
    survive. The format is small enough to write directly.
    """
    import io, struct

    blobs = []
    for im in images:
        buf = io.BytesIO()
        im.save(buf, format="PNG")
        blobs.append((im.size[0], buf.getvalue()))

    offset = 6 + 16 * len(blobs)
    header = struct.pack("<HHH", 0, 1, len(blobs))
    entries, payload = b"", b""
    for size, data in blobs:
        entries += struct.pack(
            "<BBBBHHII", size & 0xFF, size & 0xFF, 0, 0, 1, 32, len(data), offset
        )
        payload += data
        offset += len(data)
    with open(path, "wb") as f:
        f.write(header + entries + payload)


def render_small(size):
    prev = use_geometry(**SMALL)
    try:
        return render(size)
    finally:
        use_geometry(**prev)


def write_site_assets(public="../public"):
    import os

    os.makedirs(f"{public}/brand", exist_ok=True)

    # Large surfaces keep the full geometry and its depth.
    for size in (192, 512):
        render(size).save(f"{public}/brand/mark-{size}.png")
    render(180).save(f"{public}/apple-touch-icon.png")

    # The promo block draws the mark at 48 CSS px; keep its source the same file.
    render(512).save(f"{public}/plugin-icon.png")

    # Tab icon: vector for browsers that take it, and an .ico whose 16px entry
    # uses the small tuning because the full one is unreadable there.
    with open(f"{public}/favicon.svg", "w") as f:
        f.write(svg_mark())
    write_ico(f"{public}/favicon.ico", [render_small(16), render(32), render(48)])


def verify_site_assets(public="../public"):
    from PIL import Image as _I

    for name, size in [
        ("brand/mark-192.png", 192),
        ("brand/mark-512.png", 512),
        ("apple-touch-icon.png", 180),
        ("plugin-icon.png", 512),
    ]:
        im = _I.open(f"{public}/{name}")
        assert im.size == (size, size), f"{name}: {im.size}"

    svg = open(f"{public}/favicon.svg").read()
    assert svg.count("<path") == 4, "favicon.svg lost a view"
    # Every view's own colour has to appear, or the mark is no longer four views.
    for colour in VIEWS:
        assert any(
            abs(int(svg[i + 1 : i + 3], 16) - colour[0]) < 60
            for i in range(len(svg))
            if svg[i] == "#" and len(svg) > i + 7
        ), "a view is missing from favicon.svg"

    with open(f"{public}/favicon.ico", "rb") as f:
        head = f.read(6)
    assert head[:4] == b"\x00\x00\x01\x00", "favicon.ico is not an icon file"
    count = head[4] | (head[5] << 8)
    assert count == 3, f"favicon.ico has {count} entries, expected 3"

    print(f"verified site assets in {public}: 4 rasters, 4-view svg, 3-entry ico")


if __name__ == "__main__":
    for size, name in [(128, "brand/icon-128.png"), (512, "brand/icon-512.png")]:
        render(size).save(name)
        verify(name, size)
    write_site_assets()
    verify_site_assets()
