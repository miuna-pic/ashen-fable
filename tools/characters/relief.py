# Flattens a baked figure into a relief map for its illustration: R = depth toward the viewer, G = how freely that
# part swings (hair, ribbons, hems). The game draws the illustration itself, pushed out by this map.
import sys, numpy as np, trimesh, cv2
from PIL import Image
from scipy import ndimage as ndi

def relief(name, src, out, width=256):
    m = trimesh.load(src, force='mesh', process=False)
    P = np.asarray(m.vertices); uv = np.asarray(m.visual.uv); sw = np.asarray(m.vertex_attributes['_SWAY']).ravel()
    art = np.array(Image.open(f'in/{name}.png').convert('RGBA')); H0, W0 = art.shape[:2]
    W = width; H = round(width * H0 / W0)
    front = uv[:, 0] < 2 / 3 - 1e-4
    px = uv[:, 0] * 1.5 * W; py = (1 - uv[:, 1]) * H
    f = m.faces[front[m.faces].all(1)]
    z = P[f, 2].mean(1); order = np.argsort(z)
    D = np.full((H, W), np.nan, np.float32); S = np.zeros((H, W), np.float32)
    for i in order:
        tri = np.c_[px[f[i]], py[f[i]]].round().astype(np.int32)
        cv2.fillConvexPoly(D, tri, float(z[i])); cv2.fillConvexPoly(S, tri, float(sw[f[i]].mean()))
    hit = ~np.isnan(D)
    _, idx = ndi.distance_transform_edt(~hit, return_indices=True)
    D = D[idx[0], idx[1]]; S = S[idx[0], idx[1]]
    # the sculpt's fine surface is noisy; keep the big forms only
    D = cv2.GaussianBlur(D, (0, 0), W / 64); S = cv2.GaussianBlur(S, (0, 0), W / 80)
    a = cv2.resize(art[..., 3], (W, H), interpolation=cv2.INTER_AREA) > 60
    lo, hi = np.percentile(D[a], [1, 99]); mid = np.median(D[a])
    span = max(hi - mid, mid - lo)
    R = np.clip(.5 + (D - mid) / span * .5, 0, 1)
    img = np.zeros((H, W, 3), np.uint8); img[..., 0] = R * 255; img[..., 1] = np.clip(S, 0, 1) * 255
    Image.fromarray(img).save(out)
    print(name, W, H, 'depth span (of height)', round(float(span), 3))

if __name__ == '__main__': relief(sys.argv[1], sys.argv[2], sys.argv[3])
