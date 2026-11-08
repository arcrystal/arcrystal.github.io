"""Traces a route line out of a Strava map screenshot into a vector polyline, so a page can draw the
route in its own style instead of showing the map tiles.

  python3 tools/site/trace_route.py static/strava/activities/17475380288.png static/site/route-birkie.json

macOS sips converts the PNG to BMP (no imaging library needed); numpy finds the orange route
pixels, walks them from the start (the end farthest from the finish flag) by breadth-first
distance, and simplifies the walk (Ramer-Douglas-Peucker). Output: {"viewBox": [w, h], "points": [[x, y], ...]}
in the screenshot's pixel space, cropped to the route with a margin.
"""
import json
import os
import struct
import subprocess
import sys
import tempfile
from collections import deque

import numpy as np


def read_bmp(path):
    with open(path, 'rb') as f:
        data = f.read()
    offset = struct.unpack_from('<I', data, 10)[0]
    width, height = struct.unpack_from('<ii', data, 18)
    bpp = struct.unpack_from('<H', data, 28)[0]
    if bpp not in (24, 32):
        raise SystemExit(f'unsupported BMP depth {bpp}')
    step = bpp // 8
    stride = (width * step + 3) & ~3
    rows = abs(height)
    raw = np.frombuffer(data, dtype=np.uint8, count=stride * rows, offset=offset).reshape(rows, stride)
    px = raw[:, :width * step].reshape(rows, width, step)
    if height > 0:
        px = px[::-1]
    return px[:, :, 2].astype(int), px[:, :, 1].astype(int), px[:, :, 0].astype(int)


def route_mask(r, g, b):
    mask = (r > 190) & (g > 50) & (g < 150) & (b < 100) & (r - g > 90)
    h, w = mask.shape
    mask[h - 60:, w - 60:] = False   # the map's orange play button
    return mask


def largest_component(mask):
    h, w = mask.shape
    seen = np.zeros_like(mask)
    best = []
    for y, x in zip(*np.nonzero(mask)):
        if seen[y, x]:
            continue
        comp, q = [], deque([(y, x)])
        seen[y, x] = True
        while q:
            cy, cx = q.popleft()
            comp.append((cy, cx))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        q.append((ny, nx))
        if len(comp) > len(best):
            best = comp
    return best


def bfs(cells, start):
    dist = {start: 0}
    q = deque([start])
    while q:
        c = q.popleft()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                n = (c[0] + dy, c[1] + dx)
                if n in cells and n not in dist:
                    dist[n] = dist[c] + 1
                    q.append(n)
    return dist


def rdp(points, eps):
    if len(points) < 3:
        return points
    a, b = np.array(points[0], float), np.array(points[-1], float)
    ab = b - a
    norm = np.hypot(*ab) or 1.0
    d = [abs(ab[0] * (p[1] - a[1]) - ab[1] * (p[0] - a[0])) / norm for p in points[1:-1]]
    i = int(np.argmax(d)) + 1
    if d[i - 1] > eps:
        return rdp(points[:i + 1], eps)[:-1] + rdp(points[i:], eps)
    return [points[0], points[-1]]


def main(src, out):
    with tempfile.TemporaryDirectory() as tmp:
        bmp = os.path.join(tmp, 'map.bmp')
        subprocess.run(['sips', '-s', 'format', 'bmp', src, '--out', bmp], check=True, capture_output=True)
        r, g, b = read_bmp(bmp)
    comp = largest_component(route_mask(r, g, b))
    cells = set(comp)
    # One end of the line is the farthest cell from an arbitrary cell; the other, the farthest from it.
    d0 = bfs(cells, comp[0])
    end_a = max(d0, key=d0.get)
    da = bfs(cells, end_a)
    end_b = max(da, key=da.get)
    # Walk back from end_b to end_a down the distance field: an ordered, roughly central path.
    path, c = [end_b], end_b
    while c != end_a:
        c = min(((c[0] + dy, c[1] + dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1)
                 if (c[0] + dy, c[1] + dx) in da), key=lambda n: da[n])
        path.append(c)
    pts = [(int(x), int(y)) for y, x in path]
    # Start at the upper end: the Birkebeiner runs south-west from Cable (the map's green start dot)
    # to Hayward (the chequered flag).
    if pts[0][1] > pts[-1][1]:
        pts.reverse()
    pts = rdp(pts, 0.6)
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    m = 12
    x0, y0 = min(xs) - m, min(ys) - m
    data = {
        'source': os.path.relpath(src),
        'viewBox': [max(xs) - x0 + m, max(ys) - y0 + m],
        'points': [[x - x0, y - y0] for x, y in pts],
    }
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(data, f, separators=(',', ':'))
        f.write('\n')
    print(f'{len(comp)} route pixels → {len(pts)} points → {out}')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2])
