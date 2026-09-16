#!/usr/bin/env python3
"""
Brand assets.

The mark is one colour as four people receive it: normal vision, deutan,
protan, and total colour blindness. The base was not chosen by eye; it was
searched with the plugin's own engine for the base whose four simulated views
are maximally distinct from each other while all clearing the non-text contrast
floor on the mark's ground. Base #f20ddf, minimum pairwise deltaE 12.1, worst
contrast 4.00:1.

A ring rather than a pie: it reads at 16px, and the gaps keep it from looking
like a stock chart glyph. Quadrants start at -45 degrees so the divisions are
diagonal and the form has movement.

Drawn locally and supersampled. Rasterising through a browser corrupted a PNG
once with the byte count intact.
"""
from PIL import Image, ImageDraw

S = 4
GROUND = (0x14, 0x17, 0x1A, 255)

# normal, deutan, protan, achromatopsia — engine output for base #f20ddf
VIEWS = [
    (0xF2, 0x0D, 0xDF, 255),
    (0x70, 0x92, 0xDA, 255),
    (0x00, 0x75, 0xE4, 255),
    (0x88, 0x88, 0x88, 255),
]

GAP_DEG = 7.0
START_DEG = -45.0

# True radii in the authored 128 space. Pillow's arc draws its stroke INWARD
# from the bbox path, not centred on it, so the bbox radius IS the outer edge
# and the ring occupies R_OUT - THICK .. R_OUT. Measured, not assumed: the
# first version put the ring at 18..35 when the code claimed 27..44.
R_OUT = 46.0
THICK = 18.0
R_MID = R_OUT - THICK / 2  # the ring's centre line, for sampling
R_DOT = 9.0


def draw(size: int) -> Image.Image:
    img = Image.new("RGBA", (size * S, size * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    k = size / 128.0

    d.rounded_rectangle([0, 0, size * S - 1, size * S - 1], radius=28 * k * S, fill=GROUND)

    cx = cy = size / 2
    r_out = R_OUT * k
    thick = THICK * k

    bbox = [(cx - r_out) * S, (cy - r_out) * S, (cx + r_out) * S, (cy + r_out) * S]

    for i, colour in enumerate(VIEWS):
        a0 = START_DEG + i * 90 + GAP_DEG / 2
        a1 = START_DEG + (i + 1) * 90 - GAP_DEG / 2
        d.arc(bbox, a0, a1, fill=colour, width=int(round(thick * S)))

    # A dot at the centre: the one colour all four views are of.
    r = R_DOT * k
    d.ellipse([(cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S], fill=VIEWS[0])

    return img.resize((size, size), Image.LANCZOS)


def verify(path: str, size: int) -> None:
    """Check the file rather than trusting that the draw succeeded."""
    import math

    im = Image.open(path).convert("RGBA")
    assert im.size == (size, size), f"{path}: expected {size}px, got {im.size}"
    px = im.load()
    k = size / 128.0
    c = size / 2

    assert px[int(c), int(10 * k)][:3] == GROUND[:3], f"{path}: ground wrong"
    assert px[2, 2][3] == 0, f"{path}: corner should be transparent"
    assert px[int(c), int(c)][:3] == VIEWS[0][:3], f"{path}: centre dot wrong"

    # One sample per quadrant, on the ring's measured centre line.
    r = R_MID * k
    for i, colour in enumerate(VIEWS):
        ang = math.radians(START_DEG + i * 90 + 45)
        x = int(c + r * math.cos(ang))
        y = int(c + r * math.sin(ang))
        got = px[x, y][:3]
        near = all(abs(a - b) <= 6 for a, b in zip(got, colour[:3]))
        assert near, f"{path}: quadrant {i} at ({x},{y}) is {got}, expected ~{colour[:3]}"
    print(f"verified {path} {size}px: ground, corner, centre and four quadrants")


if __name__ == "__main__":
    for size, name in [(128, "brand/icon-128.png"), (512, "brand/icon-512.png")]:
        draw(size).save(name)
        verify(name, size)
