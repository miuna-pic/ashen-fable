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

def out(name, m, ir=None, target=-16.0, wet=.8, mono=False, peak=.8, trim=None):
    x = m.bounce(HALL if ir is None else ir, wet); x = filt(x, 'high', 40)
    if trim: x = x[: int(trim * SR)]
    k = int(.03 * SR); x[-k:] *= np.linspace(1, 0, k)[:, None]
    x *= peak / np.abs(x).max(); save(f'{OUT}/sfx/{name}.m4a', x, '96k', mono=mono); print(name, round(len(x) / SR, 2), 's')

def raw(path): x = load(path); return x / np.abs(x).max()

def build():
    # step: one tine of the music box at D5; the game re-pitches it to the chord the score is on
    m = Mix(2.2); m.add(I('box'), 74, 0, .3, .7, send=.5, human=0); out('step', m, trim=2.0)
    # slide: the mirror body skating under the glass. Bowed wine glass swelling into a low piano string
    m = Mix(2.2); m.put(reverse_swell(I('glass').render(62, .5, .8), .32), 0, 0, .7); m.add(I('pnod'), 50, .3, .4, .5, send=.8, human=0); m.add(I('glass'), 74, .3, .25, .3, send=.9, human=0); out('slide', m, CRYPT, trim=2.0)
    # tick: a piece that is not yours takes its turn. Pocket watch + muted bell
    m = Mix(1.0); a = Arr(60, 1, 0, rubato=0); a.m = m; clock(a, 1 / 3, vel=.9); m.add(I('xyl'), 62, .0, .1, .25, send=.3, human=0); out('tick', m, trim=.7, peak=.6)
    # flip: the world turns over. A reversed gong sucks in, the glass rings, and a harp runs the scale down then back up inverted
    m = Mix(4.0); g = raw(f'{P}/tamtam-b.wav'); m.put(reverse_swell(g, .7) * .7, 0, 0, .5); m.put(g * .25, .7, 0, .6)
    m.add(I('sub'), 38, .7, .5, .7, send=0, human=0)
    for i, n in enumerate([86, 84, 81, 79, 77, 74, 72, 69, 67, 65, 62]): m.add(I('harp'), n, .05 + i * .055, .6, .3 + i * .02, pan=-.6 + i * .12, send=.6, human=0)
    for i, n in enumerate([62, 67, 71, 74, 79, 83, 86]): m.add(I('celeste'), n, .75 + i * .06, .8, .4, pan=.5 - i * .15, send=.8, human=0)
    m.put(raw(f'{P}/bar_chimes-b.wav') * .18, .75, .2, .7); m.add(I('glass'), 62, .7, 1.0, .35, send=.9, human=0); out('flip', m, CRYPT, trim=3.6, peak=.85)
    # kill: a piece shatters. Glass, a crotale fifth, a soft drum under it
    m = Mix(3.0); m.put(shards(), 0, 0, .5, .9); m.put(raw(f'{P}/bass_drum-p.wav') * .6, 0, 0, .2)
    for i, n in enumerate([86, 93, 98]): m.add(I('crot'), n, i * .05, 1.2, .5, pan=-.3 + i * .3, send=.7, human=0)
    out('kill', m, trim=2.6, peak=.85)
    # death: the executioner's axe lands on Alice. Drum, gong, the tune's first notes falling apart in the low piano
    m = Mix(4.5); m.put(raw(f'{P}/bass_drum-f.wav'), 0, 0, .3, .9); m.put(raw(f'{P}/tamtam-a.wav') * .5, 0, 0, .6); m.put(shards(18, .3, 900, 3000, 5) * .6, .02, 0, .5)
    for i, n in enumerate([57, 62, 65, 64, 51, 38]): m.add(I('pnod'), n - 12 if i < 4 else n, .12 + i * .16 * (1 + i * .12), 1.5, .5, send=.8, human=0)
    m.add(I('chm'), 38, .1, 2.2, .3, send=.9, human=0); out('death', m, CRYPT, trim=4.2, peak=.9)
    # win: the lullaby's last cadence, finally allowed to end in D major
    m = Mix(7.5); sp = .32
    for i, (n, d) in enumerate([(73, 1), (76, 1), (78, 1), (81, 1), (86, 6)]):
        m.add(I('box'), n, i * sp, d * sp, .6, send=.6, human=0); m.add(I('pno'), n - 12, i * sp, d * sp, .45, send=.5, human=0)
    t0 = 4 * sp
    for i, n in enumerate([38, 45, 50, 54, 57, 62, 66, 69, 74, 78, 81, 86, 90]): m.add(I('harp'), n, t0 - .28 + i * .035, 2, .34, pan=-.5 + i * .08, send=.6, human=0)
    for n, v in ((62, 'chf'), (66, 'chf'), (69, 'chf'), (50, 'vcs'), (57, 'va'), (38, 'cb')): m.add(I(v), n, t0, 3.2, .3, send=.8, human=0)
    m.put(raw(f'{P}/bar_chimes-a.wav') * .2, t0 + .1, .3, .7); m.add(I('glk'), 98, t0 + .5, 2, .25, .4, .8, human=0); out('win', m, trim=7.0, peak=.85)
    # ui: a button. dialog: the next line. banner: a chapter card
    m = Mix(1.2); m.add(I('celeste'), 86, 0, .1, .4, send=.4, human=0); out('ui', m, trim=.9, peak=.45)
    m = Mix(1.2); m.add(I('harp'), 74, 0, .2, .4, send=.4, human=0); m.add(I('harp'), 81, .04, .2, .3, send=.4, human=0); out('dialog', m, trim=1.0, peak=.45)
    m = Mix(5.0)
    for i, n in enumerate([50, 57, 62, 64, 65, 69, 76]): m.add(I('pno'), n, i * .07, 3, .4, pan=-.3 + i * .1, send=.6, human=0)
    m.add(I('glk'), 88, .45, 2, .25, .3, .8, human=0); m.add(I('vcs'), 50, 0, 2.5, .2, send=.8, human=0); out('banner', m, trim=4.5, peak=.6)
    # warn: a telegraphed square is about to be struck. Two low harpsichord notes a tritone apart
    m = Mix(1.6); m.add(I('hps'), 50, 0, .2, .5, send=.5, human=0); m.add(I('hps'), 56, .12, .3, .5, send=.5, human=0); out('warn', m, CRYPT, trim=1.4, peak=.5)
    save_tuning()

if __name__ == '__main__': build()
