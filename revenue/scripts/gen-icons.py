"""Generate Revenue's PWA icons: python3 revenue/scripts/gen-icons.py revenue/public

Same method as web/scripts/gen-icons.py, a different picture: three rising green bars on Bedrock's dark surface,
so Revenue is not mistaken for Homeowner's white house on green.
The outputs are committed in revenue/public; the build and deploy do not run this script.
Re-run it and commit the PNGs only when the icon design changes.
"""
import os
import struct
import sys
import zlib

BG = (0x16, 0x1A, 0x19)
FG = (0x4C, 0xC9, 0x8A)
# (left, right, top) of each bar in the unit square; every bar ends at the baseline v = 0.3.
BARS = [(-0.34, -0.14, 0.0), (-0.1, 0.1, -0.16), (0.14, 0.34, -0.32)]


def chunk(tag, data):
    body = tag + data
    return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)


def write_png(path, n, scale):
    rows = []
    for y in range(n):
        row = bytearray([0])
        for x in range(n):
            u = (x / n - 0.5) / scale
            v = (y / n - 0.5) / scale
            on = any(l <= u <= r and top <= v <= 0.3 for l, r, top in BARS)
            row += bytes(FG if on else BG)
        rows.append(bytes(row))
    ihdr = struct.pack(">IIBBBBB", n, n, 8, 2, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(b"".join(rows), 9)) + chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


out = sys.argv[1]
os.makedirs(out, exist_ok=True)
write_png(out + "/icon-192.png", 192, 0.8)
write_png(out + "/icon-512.png", 512, 0.8)
write_png(out + "/icon-512-maskable.png", 512, 0.6)
write_png(out + "/apple-touch-icon.png", 180, 0.8)
