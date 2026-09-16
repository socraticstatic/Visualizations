#!/usr/bin/env python3
"""
Figma Community cover art, 1920x1080.

Figma's publish modal recommends 1920x1080 for a plugin cover. This was 1920x960
until 2026-09-16, which is 2:1 rather than 16:9 - the listing would have letter-
boxed or cropped it. Checked against Figma's own help centre rather than assumed.

The cover makes one claim and shows the evidence for it: the same six series
under normal vision, deutan, and total colour blindness. By the third row the
colour is gone and the dash and the marker are the only thing still holding the
series apart. That is the product.

The palette is not decoration and was not picked by eye. These are the engine's
own values for six categorical slots on a white surface, together with its own
simulations, read out of the running application. Nothing here is an
approximation of what the plugin does.

Like the icon, this renders locally and then audits the artifact rather than
the intent.
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H, SS = 1920, 1080, 2

GROUND = (0x14, 0x17, 0x1A)
HEADING = (0xF7, 0xF9, 0xFB)
BODY = (0xC3, 0xCC, 0xD6)
QUIET = (0x8E, 0x9A, 0xA6)
ACCENT = (0xF2, 0x0D, 0xDF)
CARD = (0xFF, 0xFF, 0xFF)
CARD_EDGE = (0xD8, 0xDE, 0xE4)

FONT = "/System/Library/Fonts/SFNS.ttf"

# The engine's output for n=6 on #ffffff, and its own simulations of it, read
# out of the running application. Regenerate these whenever PALETTE_VERSION
# changes - they were stale for exactly as long as it took to notice that the
# determinism fix had moved every palette. Current at 0.8.0.
ROWS = [
    ("Normal vision", ["#733c8a", "#003307", "#3e7b00", "#2f5227", "#541761", "#9261b5"]),
    ("Deuteranopia", ["#3b5588", "#2f290b", "#786b16", "#4f482a", "#1e365f", "#5a76b3"]),
    ("Total colour blindness", ["#535353", "#2b2b2b", "#6d6d6d", "#4a4a4a", "#333333", "#767676"]),
]
DASHES = [None, [6, 3], [2, 3], [10, 3, 2, 3], [8, 4], [1, 3]]
SHAPES = ["circle", "triangle", "rect", "diamond", "pin", "arrow"]


def font(size, weight="Regular"):
    f = ImageFont.truetype(FONT, size * SS)
    f.set_variation_by_name(weight)
    return f


def hex_rgb(h):
    return tuple(int(h[i : i + 2], 16) for i in (1, 3, 5))


def relative_luminance(rgb):
    c = np.asarray(rgb, dtype=float) / 255.0
    lin = np.where(c <= 0.03928, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * lin[..., 0] + 0.7152 * lin[..., 1] + 0.0722 * lin[..., 2]


def contrast(a, b):
    la, lb = relative_luminance(a), relative_luminance(b)
    hi, lo = np.maximum(la, lb), np.minimum(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def ground_with_glow():
    """The mark's own colour spilling from the top right, so it is not a slab."""
    yy, xx = np.mgrid[0:H, 0:W]
    u = (xx - W * 0.86) / (W * 0.46)
    v = (yy - H * 0.02) / (H * 0.62)
    d = np.clip(1.0 - np.hypot(u, v), 0.0, 1.0) ** 1.7
    base = np.repeat(np.array(GROUND, float)[None, None, :], H, 0).repeat(W, 1)
    return Image.fromarray(
        np.clip(base + np.array(ACCENT, float) * (d * 0.30)[..., None], 0, 255).astype(np.uint8)
    )


def dashed(d, xy0, xy1, colour, width, pattern):
    """A dash pattern walked by hand; ImageDraw has no dash support."""
    x0, y = xy0
    x1, _ = xy1
    if pattern is None:
        d.line([x0, y, x1, y], fill=colour, width=width)
        return
    x, i = x0, 0
    while x < x1:
        seg = pattern[i % len(pattern)] * SS
        if i % 2 == 0:
            d.line([x, y, min(x + seg, x1), y], fill=colour, width=width)
        x += seg
        i += 1


def marker(d, kind, cx, cy, colour, s):
    if kind == "circle":
        d.ellipse([cx - s, cy - s, cx + s, cy + s], fill=colour)
    elif kind == "triangle":
        d.polygon([(cx, cy - s * 1.1), (cx + s * 1.1, cy + s * 0.85), (cx - s * 1.1, cy + s * 0.85)], fill=colour)
    elif kind == "rect":
        d.rectangle([cx - s * 0.95, cy - s * 0.95, cx + s * 0.95, cy + s * 0.95], fill=colour)
    elif kind == "diamond":
        d.polygon([(cx, cy - s * 1.25), (cx + s * 1.15, cy), (cx, cy + s * 1.25), (cx - s * 1.15, cy)], fill=colour)
    elif kind == "pin":
        d.ellipse([cx - s, cy - s * 1.2, cx + s, cy + s * 0.8], fill=colour)
        d.polygon([(cx - s * 0.62, cy + s * 0.4), (cx + s * 0.62, cy + s * 0.4), (cx, cy + s * 1.5)], fill=colour)
    elif kind == "arrow":
        d.polygon(
            [(cx, cy - s * 1.25), (cx + s * 1.1, cy + s * 1.1), (cx, cy + s * 0.45), (cx - s * 1.1, cy + s * 1.1)],
            fill=colour,
        )


def render():
    im = ground_with_glow().resize((W * SS, H * SS), Image.BICUBIC).convert("RGB")
    d = ImageDraw.Draw(im)
    S = SS

    # ---- left: the claim -------------------------------------------------
    icon = Image.open("brand/icon-512.png").convert("RGBA").resize((132 * S, 132 * S), Image.LANCZOS)
    im.paste(icon, (120 * S, 236 * S), icon)

    d.text((120 * S, 424 * S), "F I G M A   P L U G I N", font=font(19, "Semibold"), fill=QUIET)
    d.text((116 * S, 462 * S), "Chart Color System", font=font(86, "Bold"), fill=HEADING)
    d.text((120 * S, 596 * S), "Palettes that still work", font=font(37), fill=BODY)
    d.text((120 * S, 644 * S), "when the colour does not.", font=font(37), fill=BODY)

    d.line([120 * S, 730 * S, 176 * S, 730 * S], fill=ACCENT, width=4 * S)
    for i, line in enumerate(
        [
            "Solved against the background your chart",
            "actually sits on. Written into your file as",
            "variables, with the encodings that carry",
            "identity when colour cannot.",
        ]
    ):
        d.text((120 * S, (766 + i * 38) * S), line, font=font(26), fill=QUIET)

    # ---- right: the evidence --------------------------------------------
    cx0, cy0, cx1, cy1 = 1004 * S, 196 * S, 1800 * S, 832 * S
    d.rounded_rectangle([cx0, cy0, cx1, cy1], radius=20 * S, fill=CARD, outline=CARD_EDGE, width=2 * S)

    pad = 44 * S
    row_h = (cy1 - cy0 - pad * 2) / 3.0
    for ri, (label, colours) in enumerate(ROWS):
        top = cy0 + pad + ri * row_h
        d.text((cx0 + pad, top), label.upper(), font=font(19, "Semibold"), fill=(0x55, 0x5E, 0x68))
        y = top + 92 * S
        span = (cx1 - cx0 - pad * 2) / len(colours)
        for si, hexc in enumerate(colours):
            colour = hex_rgb(hexc)
            x0 = cx0 + pad + si * span
            dashed(d, (x0 + 6 * S, y), (x0 + span - 6 * S, y), colour, 6 * S, DASHES[si])
            marker(d, SHAPES[si], x0 + span / 2, y, colour, 11 * S)

    d.text(
        (cx0 + pad, cy1 - pad - 6 * S),
        "Colour is gone in the last row. Dash and marker are not.",
        font=font(23),
        fill=(0x55, 0x5E, 0x68),
    )

    # What it does, under the evidence for why it matters.
    caps = ["Write variables", "Audit a selection", "Simulate on canvas", "Dev Mode codegen"]
    x = cx0
    f = font(24, "Medium")
    for i, cap in enumerate(caps):
        if i:
            d.text((x, 886 * S), "·", font=f, fill=ACCENT)
            x += 24 * S
        d.text((x, 886 * S), cap, font=f, fill=BODY)
        x += int(d.textlength(cap, font=f)) + 24 * S

    return im.resize((W, H), Image.LANCZOS)


def verify(path):
    """Audit the artifact and the claims printed on it."""
    im = Image.open(path).convert("RGB")
    assert im.size == (W, H), f"{path}: {im.size}"
    a = np.asarray(im).astype(float)

    # Text colours against the ground they are actually drawn on. Sampled from
    # a ground-only render of the same gradient, not from the artifact: the
    # artifact contains the text itself, so measuring there compares the
    # heading with its own pixels and reports 1.00:1. The mask was wrong, not
    # the art - the same mistake the icon verifier made.
    ground = np.asarray(ground_with_glow()).astype(float)
    left_ground = ground[230:1010, 100:960].reshape(-1, 3)
    # The capability line runs under the card, across the glow.
    caps_ground = ground[880:925, 1000:1810].reshape(-1, 3)
    worst_caps = contrast(np.array(BODY, float), caps_ground).min()
    assert worst_caps >= 4.5, f"{path}: capability line is {worst_caps:.2f}:1 on the glow"
    for name, colour, floor in [("heading", HEADING, 4.5), ("body", BODY, 4.5), ("quiet", QUIET, 4.5)]:
        worst = contrast(np.array(colour, float), left_ground).min()
        assert worst >= floor, f"{path}: {name} is {worst:.2f}:1 on its own ground"

    # Every series colour against the card it is drawn on, at the 3:1
    # non-text floor, because these are strokes and markers.
    for label, colours in ROWS:
        for hexc in colours:
            c = contrast(np.array(hex_rgb(hexc), float), np.array(CARD, float))
            assert c >= 3.0, f"{path}: {hexc} in {label} is {c:.2f}:1 on the card"

    # The claim the cover makes: in the last row colour alone stops separating
    # the series. If every pair were still distinct, the cover would be lying.
    grey = [hex_rgb(h) for h in ROWS[-1][1]]
    pairs = [
        contrast(np.array(grey[i], float), np.array(grey[j], float))
        for i in range(len(grey))
        for j in range(i + 1, len(grey))
    ]
    assert min(pairs) < 1.3, f"{path}: greyscale row still separates, closest pair {min(pairs):.2f}:1"

    # And the thing that does still separate them has to be distinct.
    assert len({str(x) for x in DASHES}) == len(DASHES), f"{path}: two slots share a dash"
    assert len(set(SHAPES)) == len(SHAPES), f"{path}: two slots share a marker"

    # Not a flat slab.
    assert a.std(axis=(0, 1)).mean() > 12.0, f"{path}: cover is flat"

    print(
        f"verified {path} {im.size[0]}x{im.size[1]}: "
        f"text clears 4.5:1 on its ground, every series clears 3:1 on the card, "
        f"closest greyscale pair {min(pairs):.2f}:1"
    )


if __name__ == "__main__":
    out = "brand/cover-1920x1080.png"
    render().save(out)
    verify(out)
