"""Draws the home-screen icon: three lines of writing on the app's teal."""
import zlib, struct, sys

BG = (0x0F, 0x6E, 0x7E)
FG = (0xFF, 0xFF, 0xFF)

def bars(size):
    """Three rounded bars, like lines of text, centred on the square."""
    h = round(size * 0.088)
    gap = round(size * 0.072)
    widths = [0.60, 0.78, 0.44]
    total = len(widths) * h + (len(widths) - 1) * gap
    top = (size - total) / 2
    out = []
    for i, frac in enumerate(widths):
        w = size * frac
        out.append(((size - w) / 2, top + i * (h + gap), w, h))
    return out

def make(size, path):
    shapes = bars(size)
    rows = []
    for y in range(size):
        row = bytearray()
        for x in range(size):
            colour = BG
            for (bx, by, bw, bh) in shapes:
                if by <= y < by + bh:
                    r = bh / 2
                    if bx + r <= x <= bx + bw - r:
                        colour = FG; break
                    cy = by + r
                    for cx in (bx + r, bx + bw - r):
                        if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                            colour = FG; break
                    if colour == FG: break
            row += bytes(colour)
        rows.append(b"\x00" + bytes(row))
    raw = zlib.compress(b"".join(rows), 9)

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
           + chunk(b"IDAT", raw) + chunk(b"IEND", b""))
    open(path, "wb").write(png)
    print(path, size, len(png), "bytes")

make(512, "assets/icon-512.png")
make(192, "assets/icon-192.png")
make(180, "assets/icon-180.png")
