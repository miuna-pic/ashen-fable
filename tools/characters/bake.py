"""Bake: raw generated mesh + 2D illustration -> game-ready GLB (decimated, projected texture, sway weights)."""
import sys, numpy as np, trimesh, cv2, fast_simplification
from PIL import Image
from scipy import ndimage as ndi

def inpaint_out(rgb, alpha, it=48):
    rgb = rgb.astype(np.float32); m = alpha > 128
    rgb[~m] = 0; w = m.astype(np.float32)
    for _ in range(it):
        s = cv2.blur(rgb * w[..., None], (5, 5)); sw = cv2.blur(w, (5, 5))
        new = (sw > 1e-4) & (w == 0)
        rgb[new] = (s[new] / sw[new][:, None]); w[new] = 1
    # fill the rest with mean colour
    rgb[w == 0] = rgb[w > 0].mean(0)
    return rgb

def bake(name, src, out, faces=36000, flip=False, tex=1024):
    m = trimesh.load(src, force='mesh', process=True)
    v, f = fast_simplification.simplify(m.vertices.astype(np.float32), m.faces, target_count=faces, agg=5)
    m = trimesh.Trimesh(v, f, process=True)
    comps = m.split(only_watertight=False)
    big = max(c.area for c in comps)
    m = trimesh.util.concatenate([c for c in comps if c.area > big * 2e-4])
    v = m.vertices.copy()
    if flip: v[:, [0, 2]] *= -1
    m = trimesh.Trimesh(v, m.faces, process=False)
    trimesh.smoothing.filter_taubin(m, lamb=.5, nu=-.53, iterations=6)
    v = m.vertices; f = m.faces
    art = np.array(Image.open(f'in/{name}.png').convert('RGBA'))
    a = art[..., 3]; ys, xs = np.where(a > 128)
    l, r, t, b = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    H, W = a.shape
    x0, x1 = v[:, 0].min(), v[:, 0].max(); y0, y1 = v[:, 1].min(), v[:, 1].max()
    u = (l + (v[:, 0] - x0) / (x1 - x0) * (r - l)) / W
    vv = (t + (y1 - v[:, 1]) / (y1 - y0) * (b - t)) / H
    front = inpaint_out(art[..., :3], a)
    # the unseen side: colours pulled in from the silhouette edge (hair, cloth), so no face is smeared on the back of the head
    inside = a > 128
    _, idx = ndi.distance_transform_edt(inside, return_indices=True)
    k = int(max(H, W) * .03) | 1
    edge = cv2.GaussianBlur(front[idx[0], idx[1]], (k, k), 0)
    k2 = int(max(H, W) * .09) | 1
    back = edge * .7 + cv2.GaussianBlur(front, (k2, k2), 0) * .3
    g = back.mean(-1, keepdims=True); back = (back * .85 + g * .15) * .72
    S = tex
    fr = cv2.resize(front, (S, S), interpolation=cv2.INTER_AREA); bk = cv2.resize(back, (S // 2, S // 2), interpolation=cv2.INTER_AREA)
    atlas = np.zeros((S, S + S // 2, 3), np.float32); atlas[:, :S] = fr; atlas[:S // 2, S:] = bk; atlas[S // 2:, S:] = bk[::-1]
    AW = S + S // 2
    # split faces by facing
    fn = m.face_normals
    isback = fn[:, 2] < -.12
    # smooth the classification a bit over adjacency to avoid speckle
    adj = m.face_adjacency
    for _ in range(2):
        cnt = np.zeros(len(f)); tot = np.zeros(len(f))
        for a_, b_ in ((0, 1), (1, 0)):
            np.add.at(cnt, adj[:, a_], isback[adj[:, b_]]); np.add.at(tot, adj[:, a_], 1)
        isback = np.where(tot > 0, (cnt + isback) / (tot + 1) > .5, isback)
    ff, fb = f[~isback], f[isback]
    ub, ib = np.unique(fb, return_inverse=True)
    nv = len(v)
    V = np.vstack([v, v[ub]])
    F = np.vstack([ff, ib.reshape(-1, 3) + nv])
    UV = np.zeros((len(V), 2), np.float32)
    UV[:nv, 0] = u * S / AW; UV[:nv, 1] = vv
    UV[nv:, 0] = (S + u[ub] * (S // 2)) / AW; UV[nv:, 1] = vv[ub] * .5
    # normalise: feet at y=0, height 1, centred on x/z by the lower body
    hgt = y1 - y0
    low = v[v[:, 1] < y0 + hgt * .12]
    cx, cz = (low[:, 0].min() + low[:, 0].max()) / 2, (low[:, 2].min() + low[:, 2].max()) / 2
    cx = cx * .5 + (x0 + x1) / 2 * .5
    P = (V - [cx, y0, cz]) / hgt
    # normals from the welded mesh
    N = np.vstack([m.vertex_normals, m.vertex_normals[ub]])
    # sway weight: thin / far-from-core parts (hair tips, skirts, ribbons, weapons) move more
    p = P[:nv]
    core_r = np.hypot(p[:, 0], p[:, 2])
    # local thickness proxy via depth span of the silhouette column
    g = 96; gi = np.clip(((p[:, 0] + .6) / 1.2 * g).astype(int), 0, g - 1); gj = np.clip((p[:, 1] * g).astype(int), 0, g - 1)
    zmin = np.full((g, g), 9.); zmax = np.full((g, g), -9.)
    np.minimum.at(zmin, (gi, gj), p[:, 2]); np.maximum.at(zmax, (gi, gj), p[:, 2])
    thick = np.clip((zmax - zmin), 0, 1); thick = ndi.uniform_filter(thick, 3)[gi, gj]
    sway = np.clip(core_r / .28, 0, 1) ** 1.5 * np.clip(1.15 - thick / .16, .15, 1)
    sway *= np.clip(p[:, 1] / .08, 0, 1)  # feet planted
    # smooth over mesh
    e = m.edges_unique
    for _ in range(8):
        acc = np.zeros(nv); c = np.zeros(nv)
        np.add.at(acc, e[:, 0], sway[e[:, 1]]); np.add.at(acc, e[:, 1], sway[e[:, 0]]); np.add.at(c, e[:, 0], 1); np.add.at(c, e[:, 1], 1)
        sway = .5 * sway + .5 * acc / np.maximum(c, 1)
    sw = np.concatenate([sway, sway[ub]])
    col = np.zeros((len(P), 4), np.uint8); col[:, 0] = (np.clip(sw, 0, 1) * 255); col[:, 1:] = 255
    img = Image.fromarray(np.clip(atlas, 0, 255).astype(np.uint8))
    mat = trimesh.visual.material.PBRMaterial(baseColorTexture=img, metallicFactor=0, roughnessFactor=1)
    vis = trimesh.visual.TextureVisuals(uv=np.c_[UV[:, 0], 1 - UV[:, 1]], material=mat)
    om = trimesh.Trimesh(P, F, vertex_normals=N, visual=vis, process=False)
    om.vertex_attributes = {'_SWAY': sw.astype(np.float32)}
    om.export(out)
    print(name, len(P), len(F), P.min(0).round(2), P.max(0).round(2))

if __name__ == '__main__':
    bake(sys.argv[1], sys.argv[2], sys.argv[3], flip='flip' in sys.argv)
