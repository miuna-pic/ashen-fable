"""One-shot sounds and stingers for 镜渊爱丽丝, rendered from the same instruments as the score. Run: python sfx.py"""
from score import *
VC = f'{VCSL}'
rng = np.random.default_rng(4)

def shards(n=46, span=.55, lo=2200, hi=9000, seed=1):
    """Breaking glass: a crack, then dozens of tiny ringing splinters falling."""
    r = np.random.default_rng(seed); N = int(SR * (span + 1.2)); y = np.zeros((N, 2), 'float32'); t = np.arange(N) / SR
    crack = r.standard_normal(N) * np.exp(-t / .012); crack = filt(crack[:, None], 'high', 1800)[:, 0]
    y += np.stack([crack, crack], 1) * .5
    for _ in range(n):
        at = r.uniform(0, 1) ** 1.8 * span; f = r.uniform(lo, hi); d = r.uniform(.03, .22); m = int(SR * d * 6); tt = np.arange(m) / SR
        g = (np.sin(2 * np.pi * f * tt) + .5 * np.sin(2 * np.pi * f * 2.76 * tt)) * np.exp(-tt / d) * r.uniform(.05, .22); i = int(at * SR); p = r.uniform(.15, .85)
        y[i:i + m, 0] += g[: N - i] * (1 - p); y[i:i + m, 1] += g[: N - i] * p
    return y

def loud(x):
    """Loudest 400 ms of a one-shot, on the same scale as the score's integrated loudness."""
    w = int(.4 * SR); return max(lufs(x[i:i + w]) for i in range(0, max(1, len(x) - w // 2), w // 4))

def out(name, m, ir=None, target=-17, wet=.8, mono=False, trim=None, fade=.03, bright=0.0):
    """`target` is the loudest 400 ms in LUFS. The score's own loudest 400 ms is about -15.5, so -16 is level with its loud passages; peaks stay under -3 dBFS."""
    x = m.bounce(HALL if ir is None else ir, wet); x = filt(x, 'high', 40)
    if bright: x = x + bright * filt(x, 'high', 3500, 1)
    if trim: x = x[: int(trim * SR)]
    k = int(fade * SR); x[-k:] *= np.linspace(1, 0, k)[:, None] ** 2
    x = limit(x * 10 ** ((target - loud(x)) / 20), .7)
    save(f'{OUT}/sfx/{name}.m4a', x, '96k', mono=mono); print(name, round(len(x) / SR, 2), 's', round(loud(x), 1), 'LUFS', round(20 * np.log10(np.abs(x).max()), 1), 'dBFS')

def tap(f=2600, d=.012, seed=3):
    """A heel on glass: a few ms of band-passed noise."""
    r = np.random.default_rng(seed); n = int(SR * .08); t = np.arange(n) / SR
    y = filt(filt((r.standard_normal(n) * np.exp(-t / d))[:, None], 'high', f * .6), 'low', f * 2.2)[:, 0]; y /= np.abs(y).max()
    return np.stack([y, y], 1).astype('float32')

def raw(path): x = load(path); return x / np.abs(x).max()

def build():
    # step: a heel on glass, then one bright tine of the music box at D5; the game re-pitches it to the chord the score is on
    m = Mix(1.4); m.put(tap(), 0, 0, .2, .5); m.add(I('cel'), 74, 0, .25, .9, send=.35, human=0); m.add(I('glk'), 86, 0, .3, .35, send=.4, human=0); m.add(I('xyl'), 74, 0, .1, .3, send=.2, human=0)
    out('step', m, trim=1.1, target=-19, fade=.3, bright=.5)
    # slide: the mirror body skating under the glass. Bowed wine glass swelling into a low piano string
    m = Mix(2.2); m.put(reverse_swell(I('glass').render(62, .5, .8), .32), 0, 0, .7); m.add(I('pnod'), 50, .3, .4, .5, send=.8, human=0); m.add(I('glass'), 74, .3, .25, .3, send=.9, human=0); out('slide', m, CRYPT, trim=1.6, target=-19, fade=.4)
    # tick: a piece that is not yours takes its turn. Pocket watch + muted bell
    m = Mix(1.0); a = Arr(60, 1, 0, rubato=0); a.m = m; clock(a, 1 / 3, vel=.9); m.add(I('xyl'), 62, .0, .1, .25, send=.3, human=0); out('tick', m, trim=.7, target=-24)
    # flip: the world turns over. A short reversed gong sucks in, the glass rings, a harp runs down and a celeste answers upward
    m = Mix(2.2); g = raw(f'{P}/tamtam-b.wav'); m.put(reverse_swell(g, .32) * .6, 0, 0, .3); m.put(g[: int(SR * .9)] * .12, .32, 0, .4)
    m.add(I('sub'), 38, .32, .25, .6, send=0, human=0); m.put(tap(1800, .02, 5), .32, 0, .3, .5)
    for i, n in enumerate([86, 81, 77, 74, 69, 65, 62]): m.add(I('harp'), n, .04 + i * .04, .3, .3 + i * .03, pan=-.6 + i * .2, send=.4, human=0)
    for i, n in enumerate([62, 67, 71, 74, 79, 86]): m.add(I('celeste'), n, .34 + i * .04, .4, .45, pan=.5 - i * .2, send=.5, human=0)
    m.add(I('glass'), 74, .32, .5, .3, send=.6, human=0); out('flip', m, CRYPT, wet=.5, trim=1.5, target=-16, fade=.5)
    # kill: a piece shatters. A sharp crack, bright glass, a crotale fifth, a drum under it
    m = Mix(2.2); m.put(shards(60, .4, 2600, 11000), 0, 0, .35, 1.0); m.put(raw(f'{P}/snare-rh-mf.wav')[: int(SR * .12)] * .35, 0, 0, .2); m.put(raw(f'{P}/bass_drum-f.wav')[: int(SR * .5)] * .7, 0, 0, .15)
    m.put(raw(f'{P}/triangle-mtd-rr1.wav') * .3, 0, .2, .3)
    for i, n in enumerate([86, 93, 98]): m.add(I('crot'), n, i * .04, .8, .6, pan=-.3 + i * .3, send=.5, human=0)
    out('kill', m, wet=.6, trim=1.4, target=-15, fade=.5, bright=.6)
    # death: the executioner's axe lands on Alice. Drum and gong, then the tune's first notes falling apart in the low piano
    m = Mix(3.0); m.put(raw(f'{P}/bass_drum-f.wav'), 0, 0, .2, .9); m.put(raw(f'{P}/tamtam-a.wav')[: int(SR * 1.6)] * .35, 0, 0, .4); m.put(shards(18, .25, 900, 3000, 5) * .6, .02, 0, .4)
    for i, n in enumerate([45, 50, 53, 39]): m.add(I('pnod'), n, .1 + i * .15 * (1 + i * .15), 1.0, .5, send=.6, human=0)
    out('death', m, CRYPT, wet=.6, trim=2.3, target=-15, fade=.9)
    # win: the lullaby's last cadence, finally allowed to end in D major
    m = Mix(7.5); sp = .32
    for i, (n, d) in enumerate([(73, 1), (76, 1), (78, 1), (81, 1), (86, 6)]):
        m.add(I('box'), n, i * sp, d * sp, .6, send=.6, human=0); m.add(I('pno'), n - 12, i * sp, d * sp, .45, send=.5, human=0)
    t0 = 4 * sp
    for i, n in enumerate([38, 45, 50, 54, 57, 62, 66, 69, 74, 78, 81, 86, 90]): m.add(I('harp'), n, t0 - .28 + i * .035, 2, .34, pan=-.5 + i * .08, send=.6, human=0)
    for n, v in ((62, 'chf'), (66, 'chf'), (69, 'chf'), (50, 'vcs'), (57, 'va'), (38, 'cb')): m.add(I(v), n, t0, 3.2, .3, send=.8, human=0)
    m.put(raw(f'{P}/bar_chimes-a.wav') * .2, t0 + .1, .3, .7); m.add(I('glk'), 98, t0 + .5, 2, .25, .4, .8, human=0); out('win', m, trim=7.0, target=-16, fade=1.5)
    # ui: a button. dialog: the next line. banner: a chapter card
    m = Mix(1.2); m.add(I('celeste'), 86, 0, .1, .4, send=.4, human=0); out('ui', m, trim=.6, target=-24, fade=.2)
    m = Mix(1.2); m.add(I('harp'), 74, 0, .2, .4, send=.4, human=0); m.add(I('harp'), 81, .04, .2, .3, send=.4, human=0); out('dialog', m, trim=.7, target=-24, fade=.2)
    m = Mix(5.0)
    for i, n in enumerate([50, 57, 62, 64, 65, 69, 76]): m.add(I('pno'), n, i * .07, 3, .4, pan=-.3 + i * .1, send=.6, human=0)
    m.add(I('glk'), 88, .45, 2, .25, .3, .8, human=0); m.add(I('vcs'), 50, 0, 2.5, .2, send=.8, human=0); out('banner', m, trim=3.5, target=-20, fade=1.2)
    # warn: most of what she can do next kills her. Two soft low piano notes a tritone apart, felt more than heard
    m = Mix(1.6); m.add(I('pnod'), 50, 0, .4, .5, send=.6, human=0); m.add(I('pnod'), 56, .14, .5, .45, send=.6, human=0); m.add(I('celeste'), 68, .14, .3, .2, send=.7, human=0)
    out('warn', m, CRYPT, trim=1.3, target=-22, fade=.5)
    save_tuning()

if __name__ == '__main__': build()
