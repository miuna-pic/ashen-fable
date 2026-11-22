import numpy as np, sys
from score import *
def f0(y, lo=40, hi=2500):
    y = y[:, 0] if y.ndim > 1 else y; a = int(.15 * SR); y = y[a:a + int(.5 * SR)] if len(y) > a + int(.5*SR) else y
    y = y * np.hanning(len(y)); n = 1 << 18; S = np.abs(np.fft.rfft(y, n)); fr = np.fft.rfftfreq(n, 1 / SR)
    # harmonic product spectrum
    best = None
    return S, fr
def est(y, expect, inst=None):
    S, fr = f0(y); best = (0, 0)
    for c in np.arange(-700, 700, 2):
        f = expect * 2 ** (c / 1200); e = sum(S[int(round(f * h / (fr[1])))] / h for h in range(1, getattr(inst,'harmonics',5)+1) if f * h < 12000)
        if e > best[0]: best = (e, c)
    return best[1]
names = sys.argv[1:] or ['box','glass','celeste','harp','vln','vc','v1','va','vcs','cb','chf','chm','hps','org','orgd','orgp','cl','fl','ob','bsn','hn','tbn','xyl','glk','chimes','timp','crot','v1s','vcss','cbs','v1p','vap','vcp','cbp','cbt','v1t']
for k in names:
    inst = I(k); keys = getattr(inst, 'keys', [60, 72, 84]); out = []
    for z in keys:
        inst.rr = 0; y = inst.render(z, 1.0, .8); c = est(y, 440 * 2 ** ((z - 69) / 12), inst); out.append(f'{z}:{c:+.0f}')
    print(k, ' '.join(out))
save_tuning()
