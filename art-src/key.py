# Chroma-keys the green-screen character art into trimmed transparent WebP standees.
import sys, glob, os
import numpy as np
from PIL import Image
from scipy import ndimage
out = 'public/art'
for path in sorted(glob.glob('art-src/*_*.png')):
    im = np.asarray(Image.open(path).convert('RGB')).astype(np.float32) / 255
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    spill = g - np.maximum(r, b)
    alpha = 1 - np.clip((spill - 0.12) / 0.38, 0, 1)
    # keep only what connects to the figure: drop stray specks
    solid = alpha > 0.5
    lab, n = ndimage.label(solid)
    if n > 1:
        sizes = ndimage.sum(solid, lab, range(1, n + 1))
        keep = np.isin(lab, 1 + np.flatnonzero(sizes > 400))
        alpha = np.where(keep | (ndimage.binary_dilation(keep, iterations=3) & (alpha > 0)), alpha, 0)
    alpha = ndimage.gaussian_filter(alpha, 0.6)
    g2 = np.where(spill > 0, np.maximum(r, b), g)  # despill
    rgba = np.dstack([r, g2, b, alpha])
    ys, xs = np.nonzero(alpha > 0.05)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    pad = 12
    y0, x0 = max(0, y0 - pad), max(0, x0 - pad)
    y1, x1 = min(im.shape[0], y1 + pad), min(im.shape[1], x1 + pad)
    res = Image.fromarray((rgba[y0:y1, x0:x1] * 255).astype(np.uint8), 'RGBA')
    name = os.path.splitext(os.path.basename(path))[0]
    big = res.copy(); big.thumbnail((900, 1200), Image.LANCZOS)
    big.save(f'{out}/{name}.webp', quality=86, method=6)
    # board standee: small, with a die-cut sticker outline (ink by day, bone by night)
    small = res.copy(); small.thumbnail((480, 640), Image.LANCZOS)
    m = 10
    canvas = Image.new('RGBA', (small.width + 2 * m, small.height + 2 * m), (0, 0, 0, 0))
    canvas.paste(small, (m, m))
    a = np.asarray(canvas)[..., 3] > 90
    ring = ndimage.binary_dilation(a, iterations=6)
    edge = ndimage.gaussian_filter(ring.astype(np.float32), 0.8)
    colour = (26, 14, 20) if name.endswith('day') else (240, 230, 214)
    under = np.zeros((*a.shape, 4), np.uint8); under[..., :3] = colour; under[..., 3] = (edge * 255).astype(np.uint8)
    sticker = Image.alpha_composite(Image.fromarray(under, 'RGBA'), canvas)
    sticker.save(f'{out}/s_{name}.webp', quality=84, method=6)
    print(name, big.size, sticker.size)
