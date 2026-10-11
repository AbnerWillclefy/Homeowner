"""Generate the placeholder PWA icons: python3 web/scripts/gen-icons.py web/public"""
import struct
import sys
import zlib

BG = (0x2F, 0x6F, 0x4F)
FG = (255, 255, 255)


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
            body = -0.3 <= u <= 0.3 and 0.0 <= v <= 0.32
            roof = -0.42 <= u <= 0.42 and -0.34 <= v < 0.0 and abs(u) <= (v + 0.34) * 1.24
            row += bytes(FG if (body or roof) else BG)
        rows.append(bytes(row))
    ihdr = struct.pack(">IIBBBBB", n, n, 8, 2, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(b"".join(rows), 9)) + chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


out = sys.argv[1]
write_png(out + "/icon-192.png", 192, 0.8)
write_png(out + "/icon-512.png", 512, 0.8)
write_png(out + "/icon-512-maskable.png", 512, 0.6)
write_png(out + "/apple-touch-icon.png", 180, 0.8)
