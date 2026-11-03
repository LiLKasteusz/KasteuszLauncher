#!/usr/bin/env python3
"""Generates new 64x32 cape textures into src/renderer/assets/capes/."""
import os
from PIL import Image

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   '..', 'src', 'renderer', 'assets', 'capes')

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def new_cape(top, bottom, edge):
    img = Image.new('RGBA', (64, 32), (0, 0, 0, 0))
    px = img.load()
    # panels: inner (1,1), outer (12,1), sides, top, bottom
    def fill(x0, y0, w, h):
        for y in range(h):
            for x in range(w):
                c = lerp(top, bottom, y / max(1, h - 1))
                if x in (0, w - 1) or y in (0, h - 1):
                    c = edge
                px[x0 + x, y0 + y] = c + (255,)
    fill(1, 1, 10, 16)
    fill(12, 1, 10, 16)
    fill(0, 1, 1, 16)
    fill(11, 1, 1, 16)
    fill(1, 0, 10, 1)
    fill(11, 0, 10, 1)
    return img, px

def put(px, ox, oy, pts, color):
    for (x, y) in pts:
        px[12 + ox + x, 1 + oy + y] = color + (255,)

def aurora():
    img, px = new_cape((20, 30, 60), (10, 110, 110), (120, 255, 220))
    for y in range(2, 14):
        for x in range(1, 9):
            t = (x + y) % 6
            if t < 2:
                put(px, 0, 0, [(x, y)], lerp((60, 255, 180), (160, 90, 255), y / 14))
    return img

def void_crystal():
    img, px = new_cape((10, 5, 25), (45, 10, 80), (170, 90, 255))
    gem = [(4, 3), (5, 3), (3, 4), (4, 4), (5, 4), (6, 4), (3, 5), (4, 5), (5, 5), (6, 5),
           (4, 6), (5, 6), (4, 7), (5, 7), (4, 8), (5, 8)]
    put(px, 0, 0, gem, (190, 120, 255))
    put(px, 0, 0, [(4, 4), (4, 5), (5, 4)], (240, 220, 255))
    for (x, y) in [(1, 11), (8, 12), (2, 14), (7, 10)]:
        put(px, 0, 0, [(x, y)], (130, 70, 220))
    return img

def golden_crown():
    img, px = new_cape((120, 20, 30), (60, 8, 20), (255, 210, 70))
    gold = (255, 210, 70)
    crown = [(2, 4), (4, 4), (5, 4), (7, 4), (2, 5), (3, 5), (4, 5), (5, 5), (6, 5), (7, 5)]
    crown += [(x, 6) for x in range(2, 8)]
    put(px, 0, 0, crown, gold)
    put(px, 0, 0, [(4, 5), (5, 5)], (255, 80, 80))
    put(px, 0, 0, [(3, 8), (4, 8), (5, 8), (6, 8)], (200, 150, 40))
    return img

def neon_circuit():
    img, px = new_cape((8, 10, 18), (14, 20, 36), (0, 230, 255))
    line = (0, 230, 255)
    pts = [(x, 3) for x in range(1, 6)] + [(5, y) for y in range(3, 9)]
    pts += [(x, 8) for x in range(5, 9)] + [(8, y) for y in range(8, 14)]
    pts += [(x, 13) for x in range(2, 9)] + [(2, y) for y in range(10, 14)]
    put(px, 0, 0, pts, line)
    for (x, y) in [(1, 3), (8, 13), (2, 10), (5, 8)]:
        put(px, 0, 0, [(x, y)], (255, 60, 200))
    return img

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for name, fn in [('aurora', aurora), ('void_crystal', void_crystal),
                     ('golden_crown', golden_crown), ('neon_circuit', neon_circuit)]:
        path = os.path.normpath(os.path.join(OUT, name + '.png'))
        fn().save(path)
        print('wrote', path)