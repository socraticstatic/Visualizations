#!/usr/bin/env python3
"""
Render the brand assets from the same geometry the SVG describes.

Drawn locally rather than rasterised from the SVG through a browser: moving a
PNG through the conversation corrupted it once with the byte count intact,
which CRC caught and `sips` did not. Supersampled 4x and downsampled for
antialiasing.
"""
from PIL import Image, ImageDraw

S = 4  # supersample
GROUND = (0x14, 0x17, 0x1A, 255)
SLOTS = [
    # colour,            y,  dash(on, off) or None, marker
    ((0xEB, 0xF2, 0xF9, 255), 40, None,      "circle"),
    ((0xA8, 0xC7, 0xE6, 255), 64, (18, 11),  "triangle"),
    ((0x65, 0x9C, 0xD2, 255), 88, (6, 9),    "square"),
]
X0, X1, STROKE = 24, 104, 7


def capsule(d, x0, x1, y, w, fill):
    """A round-capped horizontal stroke, which is what SVG's linecap draws."""
    r = w / 2
    d.rectangle([x0 * S, (y - r) * S, x1 * S, (y + r) * S], fill=fill)
    for cx in (x0, x1):
        d.ellipse([(cx - r) * S, (y - r) * S, (cx + r) * S, (y + r) * S], fill=fill)


def draw(size):
    img = Image.new("RGBA", (size * S, size * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    k = size / 128.0  # the geometry is authored at 128

    def sx(v):
        return v * k

    d.rounded_rectangle(
        [0, 0, size * S - 1, size * S - 1], radius=28 * k * S, fill=GROUND
    )

    for colour, y, dash, marker in SLOTS:
        yy, x0, x1, w = sx(y), sx(X0), sx(X1), sx(STROKE)
        if dash is None:
            capsule(d, x0, x1, yy, w, colour)
        else:
            on, off = sx(dash[0]), sx(dash[1])
            x = x0
            while x < x1:
                capsule(d, x, min(x + on, x1), yy, w, colour)
                x += on + off

        cx = sx(64)
        if marker == "circle":
            r = sx(10)
            d.ellipse([(cx - r) * S, (yy - r) * S, (cx + r) * S, (yy + r) * S], fill=colour)
        elif marker == "triangle":
            d.polygon(
                [
                    (cx * S, (yy - sx(11)) * S),
                    ((cx + sx(10)) * S, (yy + sx(8)) * S),
                    ((cx - sx(10)) * S, (yy + sx(8)) * S),
                ],
                fill=colour,
            )
        else:
            h = sx(9)
            d.rounded_rectangle(
                [(cx - h) * S, (yy - h) * S, (cx + h) * S, (yy + h) * S],
                radius=sx(3) * S,
                fill=colour,
            )

    return img.resize((size, size), Image.LANCZOS)


for size, name in [(128, "brand/icon-128.png"), (512, "brand/icon-512.png")]:
    draw(size).save(name)
    print("wrote", name)
