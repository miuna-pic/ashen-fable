"""镜渊爱丽丝 score. One lullaby in D Dorian; the mirror face plays its exact melodic inversion around D5.
Dorian is its own mirror image, so the inverted tune stays in key and every chord flips quality (Dm<->G, F<->Em, A<->Cm).
Each cue renders three bar-locked stems: surface, mirror, pulse (danger layer). Run: python score.py [cue ...]"""
import sys, json, os
from synth import *

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'audio')
P = f'{SSO}/Percussion'
_I = {}
def I(k):
    if k not in _I:
        s = dict(sustain=True)
        _I[k] = {
            'box': lambda: Layer((I('cel'), 0, .8), (I('glk'), 12, .16), (Synth(music_box), 0, .22)),
            'cel': lambda: Inst(f'{SSO}/Celeste/celeste-*-hard.flac', release=.7),
            'pno': lambda: Piano(), 'pnod': lambda: Piano(lowpass=1800, ring=6.0), 'glass': lambda: Synth(glass), 'sub': lambda: Synth(sub),
            'celeste': lambda: Inst(f'{SSO}/Celeste/celeste-*-soft.flac', release=.6),
            'harp': lambda: Inst(f'{SSO}/Harp/harp-*.wav', release=.9),
            'vln': lambda: Inst(f'{SSO}/Violin/violin-[a-g]*', lowpass=7000, attack=.07, release=.22, **s),
            'vc': lambda: Inst(f'{SSO}/Cello/cello-[a-g]*', attack=.08, release=.25, **s),
            'v1': lambda: Inst(f'{SSO}/1st Violins/1st-violins-sus-*', lowpass=5000, attack=.22, release=.45, **s),
            'va': lambda: Inst(f'{SSO}/Violas/violas-sus-*', lowpass=5000, attack=.22, release=.45, **s),
            'vcs': lambda: Inst(f'{SSO}/Celli/celli-sus-*', attack=.2, release=.45, **s),
            'cb': lambda: Inst(f'{SSO}/Basses/basses-sus-*', attack=.2, release=.5, **s),
            'v1s': lambda: Inst(f'{SSO}/1st Violins/1st-violins-stc-rr*', release=.3),
            'vas': lambda: Inst(f'{SSO}/Violas/violas-stc-rr*', release=.3),
            'vcss': lambda: Inst(f'{SSO}/Celli/celli-stc-rr*', release=.3),
            'cbs': lambda: Inst(f'{SSO}/Basses/basses-stc-rr*', release=.3),
            'v1p': lambda: Inst(f'{SSO}/1st Violins/1st-violins-piz-rr*', release=.5),
            'vap': lambda: Inst(f'{SSO}/Violas/violas-piz-rr*', release=.5),
            'vcp': lambda: Inst(f'{SSO}/Celli/celli-piz-rr*', release=.5),
            'cbp': lambda: Inst(f'{SSO}/Basses/basses-piz-rr*', release=.6),
            'cbt': lambda: Inst(f'{SSO}/Basses/basses-trm-*', attack=.5, release=.6, **s),
            'v1t': lambda: Inst(f'{SSO}/1st Violins/1st-violins-trm-*', lowpass=5000, attack=.4, release=.5, **s),
            'chf': lambda: Inst(f'{SSO}/Chorus/chorus-female-*', attack=.3, release=.6, **s),
            'chm': lambda: Inst(f'{SSO}/Chorus/chorus-male-*', attack=.3, release=.6, **s),
            'hps': lambda: Inst(f'{SSO}/Harpsichord/Sustains/High/*.flac', rx=r'_([A-G]#?\d)_', release=.35),
            'org': lambda: Inst(f'{SSO}/Organ/swell-gedact8ft/*.flac', rx=r'^(\d+)-', attack=.04, release=.3, **s),
            'orgd': lambda: Inst(f'{SSO}/Organ/great-opendiapason8ft/*.flac', rx=r'^(\d+)-', attack=.04, release=.3, **s),
            'orgp': lambda: Inst(f'{SSO}/Organ/pedal-bourdon16ft/*.flac', rx=r'^(\d+)-', attack=.05, release=.35, **s),
            'cl': lambda: Inst(f'{SSO}/Clarinet/clarinet-*', attack=.04, release=.15, **s),
            'fl': lambda: Inst(f'{SSO}/Flute/flute-*', attack=.05, release=.15, **s),
            'ob': lambda: Inst(f'{SSO}/Oboe/oboe-*', attack=.04, release=.15, **s),
            'bsn': lambda: Inst(f'{SSO}/Bassoon/bassoon-*', attack=.04, release=.15, **s),
            'hn': lambda: Inst(f'{SSO}/Horns/horns-sus-mp-*', rx=r'mp-([a-g]#?\d)', attack=.1, release=.3, **s),
            'tbn': lambda: Inst(f'{SSO}/Trombones/trombones-sus-*', attack=.08, release=.3, **s),
            'xyl': lambda: Inst(f'{P}/xylophone-*', release=.3, harmonics=1, octave=2), 'glk': lambda: Inst(f'{P}/glockenspiel-*', release=1.2, harmonics=1, octave=2),
            'chimes': lambda: Inst(f'{P}/chimes-*', release=2.0, harmonics=1), 'timp': lambda: Inst(f'{P}/timpani-f-rh-*', release=1.2, harmonics=1, octave=1),
            'timpp': lambda: Inst(f'{P}/timpani-p-rh-*', release=1.2, harmonics=1, octave=1),
            'crot': lambda: Inst(f'{SSO}/Crotales/crotale-*-pp.flac', release=2.0, harmonics=1),
        }[k]()
    return _I[k]

def N(s):
    """'a4:2 d5:1 -:1' -> [(midi|None, beats)]"""
    return [(None if a == '-' else midi(a), float(b)) for a, b in (x.split(':') for x in s.split())]

# The lullaby, 16 bars of 3/4.
THEME = N('a4:2 d5:1  f5:2 e5:1  d5:1 b4:1 d5:1  e5:3   a5:2 g5:1  e5:2 g5:1  f5:1 e5:1 d5:1  e5:3 '
          'a4:2 d5:1  f5:2 a5:1  b5:2 a5:1  g5:3   a5:1 g5:1 f5:1  e5:2 d5:1  c#5:2 e5:1  d5:3')
CHORDS = 'Dm Dm G Am F C G A Dm Dm G Em F Dm A Dm'.split()
# The mad tea party hiccups through the same tune with wrong notes.
TEA = N('a4:1 a4:.5 c#5:.5 d5:1  f5:1 e5:.5 f5:.5 e5:1  d5:.5 c#5:.5 d5:.5 b4:.5 d5:1  e5:2 -:1 '
        'a5:1 a5:.5 g#5:.5 g5:1  e5:1 e5:.5 f#5:.5 g5:1  f5:.5 g5:.5 f5:.5 e5:.5 d5:1  e5:1 c#5:1 a4:1 '
        'a4:1 a4:.5 c#5:.5 d5:1  f5:1 g5:.5 g#5:.5 a5:1  b5:1 b5:.5 a#5:.5 a5:1  g5:2 -:1 '
        'a5:.5 a#5:.5 a5:.5 g5:.5 f5:1  e5:1 e5:.5 d#5:.5 d5:1  c#5:1 e5:1 g5:1  d5:1 -:1 d6:1')
# The Queen of Hearts: D harmonic minor, then Alice's tune dragged into her key.
QUEEN = N('a5:2 d6:1  c#6:1 d6:1 e6:1  f6:2 d6:1  e6:3   g5:2 a#5:1  a5:1 a#5:1 a5:1  g5:1 e5:1 c#5:1  d5:3 '
          'a4:2 d5:1  f5:2 e5:1  d5:1 a#4:1 d5:1  e5:3   a5:2 g5:1  e5:2 g5:1  f5:1 e5:1 c#5:1  d5:3')
QCH = 'Dm Dm Bb A Gm Dm A Dm Dm Dm Gm A F C A Dm'.split()
PC = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}

class Arr:
    def __init__(s, bpm, bars, face, seed=1, rubato=.035):
        s.rubato = rubato; s.spb, s.bars, s.face = 60 / bpm, bars, face; s.len = bars * 3 * s.spb; s.m = Mix(s.len + 9, seed)
    def n(s, note): return 148 - note if s.face else note
    def ch(s, name):
        root = PC[name[0]] + (-1 if name[1:2] == 'b' else 1 if name[1:2] == '#' else 0); minor = name.endswith('m')
        return ((-root - 3) % 12, not minor) if s.face else (root, minor)
    def tones(s, name, low):
        root, minor = s.ch(name); r = low + (root - low) % 12; return [r, r + (3 if minor else 4), r + 7]
    def t(s, bar, beat=0.0):
        b = bar * 3 + beat; return b * s.spb + s.rubato * (np.sin(2 * np.pi * (b / 12 - .25)) + 1)
    def line(s, inst, notes, bar0, shift=0, vel=.6, pan=0.0, send=.3, leg=1.0, bars=None, human=.01, swell=None, gain=1.0):
        b = 0.0
        for note, d in notes:
            if note is not None and (bars is None or b < bars * 3):
                arc = .82 + .3 * np.sin(np.pi * ((b / 12) % 1)) ** .8  # every 4-bar phrase breathes
                y = I(inst).render(s.n(note) + shift, d * s.spb * leg, vel * arc * (1.1 if b % 3 == 0 else 1.0), s.m.rng.normal(0, .03))
                if swell: s.m.put(reverse_swell(y, swell) * .7, s.t(bar0, b) - min(swell, len(y) / SR), pan, send, gain)
                else: s.m.put(y, s.t(bar0, b) + s.m.rng.normal(0, human), pan, send, gain)
            b += d
    def each(s, chords, bar0, fn, bars=None):
        for i, c in enumerate(chords[:bars]): fn(bar0 + i, c, i)
    def note(s, inst, note, bar, beat, dur, vel=.5, pan=0.0, send=.3, **k): s.m.add(I(inst), note, s.t(bar, beat), dur * s.spb, vel, pan, send, **k)
    def pad(s, inst, chords, bar0, low, vel=.3, pan=0.0, send=.45, voices=(0, 1, 2), bars=None, spread=.5):
        def f(bar, c, i):
            arc = (.75 + .4 * np.sin(np.pi * ((i % 4) + .5) / 4)) * min(1, .45 + .28 * i)
            for j, v in enumerate(voices): s.note(inst, s.tones(c, low)[v], bar, 0, 3.02, vel * arc, pan + spread * (j - 1) * .6, send, human=.02)
        s.each(chords, bar0, f, bars)
    def arp(s, inst, chords, bar0, low, pattern, step=.5, vel=.35, pan=0.0, send=.3, bars=None, dur=.9, sway=.25):
        def f(bar, c, i):
            tn = s.tones(c, low); tn = tn + [x + 12 for x in tn] + [tn[0] + 24]
            for k, p in enumerate(pattern):
                if p is not None: s.note(inst, tn[p], bar, k * step, dur, vel * (1.15 if k == 0 else .9 + .1 * (k % 2)), pan + sway * np.sin(k * 1.3 + bar), send)
        s.each(chords, bar0, f, bars)
    def bass(s, inst, chords, bar0, low, beats=(0,), dur=2.8, vel=.5, send=.25, bars=None, fifth=()):
        def f(bar, c, i):
            tn = s.tones(c, low)
            for b in beats: s.note(inst, tn[0], bar, b, dur, vel, 0, send)
            for b in fifth: s.note(inst, tn[2], bar, b, dur, vel * .8, 0, send)
        s.each(chords, bar0, f, bars)
    def hit(s, file, bar, beat=0.0, gain=.5, pan=0.0, send=.3, rate=1.0):
        x = load(file if file.startswith('/') else f'{P}/{file}')
        if rate != 1.0: x = resample_poly(x, 100, int(100 * rate), axis=0).astype('float32')
        s.m.put(x / (np.abs(x).max() + 1e-6), s.t(bar, beat), pan, send, gain)

def clock(a, bars, bar0=0, vel=.5, sub_div=1):
    """A pocket watch: tick, tock."""
    rng = np.random.default_rng(3)
    for k in range(int(bars * 3 * sub_div)):
        n = int(SR * .05); t = np.arange(n) / SR; f = 2900 if k % 2 == 0 else 2150
        y = (np.sin(2 * np.pi * f * t) * np.exp(-t / .006) + .6 * rng.standard_normal(n) * np.exp(-t / .0025)) * (1 if k % (3 * sub_div) == 0 else .6)
        a.m.put(np.repeat(y[:, None], 2, 1).astype('float32'), a.t(bar0, k / sub_div), .0, .12, vel)

def heart(a, bars, bar0=0, vel=.8, beats=(0, .62)):
    for b in range(bars):
        for i, bt in enumerate(beats): a.note('sub', midi('d1') + 12, bar0 + b, bt, .12, vel * (1 if i == 0 else .7), 0, .05, human=0)

# --- cues -------------------------------------------------------------------------------------------------
def rabbit(face):
    """兔子洞: a music box falling down a well. 84 bpm."""
    a = Arr(84, 32, face, 11); T, C = THEME, CHORDS
    if face == 0:
        a.line('box', T, 0, vel=.6, send=.55); a.line('box', T, 16, shift=12, vel=.34, pan=.25, send=.7)
        a.arp('pno', C, 0, 38, [0, 2, 4, 5, 4, 5], vel=.3, pan=-.1, send=.4, dur=1.5, sway=.1)
        a.arp('pno', C, 16, 38, [0, 2, 4, 5, 4, 2], vel=.36, pan=-.1, send=.4, dur=1.5, sway=.1)
        a.line('pno', T, 16, vel=.5, pan=.1, send=.45); a.line('pno', T, 16, shift=-12, vel=.3, pan=.05, send=.45)
        a.arp('celeste', C[8:], 8, 74, [None, 0, 2, 3, 2, 0], vel=.2, pan=-.35, send=.6)
        a.pad('va', C, 16, 50, vel=.13, voices=(0, 2), send=.6); a.pad('vcs', C, 16, 50, vel=.16, voices=(0, 2)); a.pad('cb', C, 16, 26, vel=.12, voices=(0,), send=.1)
        a.pad('chf', C[8:], 24, 62, vel=.17, voices=(1, 2), send=.8); a.line('vcs', T[-11:], 28, shift=-12, vel=.28, pan=.2, send=.5)
        a.note('glk', 86, 16, 0, 3, .22, .4, .6); a.hit('bar_chimes-a.wav', 15, 1.2, .1, -.4, .6); a.note('crot', 98, 31, 2, 3, .14, .5, .7)
    else:
        a.line('vcs', T, 0, shift=-12, vel=.5, pan=-.15, send=.5); a.line('vc', T, 0, shift=-12, vel=.2, pan=-.1, send=.45)
        a.line('vcs', T, 16, shift=-12, vel=.52, pan=-.15, send=.5); a.line('vc', T, 16, shift=-12, vel=.2, pan=-.1, send=.45); a.line('hn', T, 16, shift=-12, vel=.14, pan=.2, send=.6)
        a.arp('pnod', C, 0, 38, [0, None, 2, None, 4, None], vel=.34, send=.6, dur=3, sway=.1)
        a.arp('pnod', C, 16, 38, [0, 2, 4, None, 5, None], vel=.4, send=.6, dur=3, sway=.1)
        a.line('box', T, 0, vel=.2, pan=.3, send=1.0, swell=1.1, gain=.6); a.line('box', T, 16, vel=.2, pan=-.3, send=1.0, swell=1.1, gain=.6)
        a.line('celeste', T, 16, vel=.16, pan=.35, send=1.0)
        a.pad('cb', C, 0, 26, vel=.14, voices=(0,), send=.1); a.pad('cb', C, 16, 26, vel=.16, voices=(0,), send=.1)
        a.pad('chm', C, 16, 50, vel=.14, voices=(0, 2), send=.8); a.pad('va', C[8:], 8, 50, vel=.1, voices=(0, 2)); a.pad('va', C, 16, 50, vel=.12)
        a.hit('tamtam-a.wav', 0, 0, .08, 0, .7); a.hit('tamtam-b.wav', 16, 0, .12, 0, .7)
    return a

def rabbit_pulse():
    a = Arr(84, 32, 0, 5); heart(a, 32); clock(a, 32, vel=.35)
    for b in range(0, 32, 4): a.note('cbt', 26, b, 0, 12, .35, 0, .4)
    for b in range(2, 32, 4): a.note('v1t', 86, b, 0, 6, .08, 0, .6)
    return a

def title(face):
    """Title: the lullaby alone at the piano with its music box, then the room fills in. 72 bpm, free."""
    a = Arr(72, 32, 0, 21, rubato=.11); T, C = THEME, CHORDS
    a.line('box', T, 0, vel=.55, send=.6); a.arp('pno', C[4:], 4, 38, [0, 2, 4, None, None, None], vel=.24, send=.5, dur=3, sway=.1)
    a.line('pno', T, 16, vel=.52, pan=.1, send=.5); a.line('box', T, 16, shift=12, vel=.26, pan=.25, send=.75)
    a.arp('pno', C, 16, 38, [0, 2, 4, 5, 4, 2], vel=.34, pan=-.1, send=.45, dur=1.5, sway=.1)
    a.pad('va', C, 16, 50, vel=.12, voices=(0, 2), send=.6); a.pad('vcs', C, 16, 50, vel=.16, voices=(0, 2)); a.pad('cb', C[8:], 24, 26, vel=.12, voices=(0,), send=.1)
    a.pad('chf', C[8:], 24, 62, vel=.18, voices=(1, 2), send=.8); a.line('vcs', T[18:], 24, shift=-12, vel=.3, pan=.2, send=.5)
    a.note('glk', 86, 16, 0, 3, .2, .4, .6); a.note('crot', 98, 31, 2, 3, .14, .5, .7)
    return a

def tea(face):
    """疯茶会: a waltz with hiccups. 132 bpm."""
    a = Arr(132, 48, face, 31); T, C = TEA, CHORDS
    for p in range(3):
        o = p * 16
        if face == 0:
            a.bass('cbp', C, o, 38, vel=.6); a.arp('vap', C, o, 53, [None, (0, 1), (0, 1)] if 0 else [None, 1, 1], step=1, vel=.4, pan=.2, dur=.5); a.arp('v1p', C, o, 57, [None, 2, 2], step=1, vel=.36, pan=-.25, dur=.5)
            a.line('cl' if p != 1 else 'fl', T, o, shift=0 if p != 1 else 12, vel=.55, pan=-.1, leg=.8, send=.3)
            a.line('xyl', T, o, shift=12, vel=.3 if p else .0001, pan=.35, send=.35)
            if p >= 1: a.line('celeste', T, o, shift=12, vel=.3, pan=-.35, send=.4); a.arp('harp', C, o, 62, [0, 2, 3, 5, 3, 2], vel=.26, pan=.3)
            if p == 2:
                a.line('v1s', T, o, shift=12, vel=.4, pan=-.2, send=.4); a.line('bsn', T, o, shift=-12, vel=.3, pan=.2, leg=.7)
                for b in range(16): a.hit('tambourine-hit-mf.wav', o + b, 1, .12, .4); a.hit('tambourine-hit-mf.wav', o + b, 2, .1, .4)
            for b in (3, 11): a.hit('triangle-opn-rr1.flac', o + b, 2, .14, .5, .5)
            a.hit('wood_block-hi.wav', o + 15, 1, .3, -.3); a.hit('wood_block-lo.wav', o + 15, 1.5, .3, -.3)
        else:
            a.bass('cbp', C, o, 26, vel=.6); a.arp('vcp', C, o, 41, [None, 1, None], step=1, vel=.4, pan=.2, dur=.5); a.arp('vcp', C, o, 41, [None, None, 2], step=1, vel=.36, pan=-.2, dur=.5)
            a.line('bsn', T, o, shift=-12, vel=.55, pan=.1, leg=.75, send=.35)
            a.pad('glass', C, o, 62, vel=.14, send=.8, voices=(0, 2))
            if p >= 1: a.line('hps', T, o, shift=-12, vel=.3, pan=-.3, send=.45); a.pad('cb', C, o, 26, vel=.3, voices=(0,))
            if p == 2: a.line('vc', T, o, shift=-12, vel=.4, pan=-.15, leg=.9); a.line('box', T, o, vel=.24, pan=.35, send=.9, swell=.5)
            for b in (7, 15): a.hit('vibraslap.wav', o + b, 2, .14, -.4, .5)
            a.hit('ratchet.wav', o + 3, 1.5, .08, .4, .5)
    return a

def tea_pulse():
    a = Arr(132, 48, 0, 6); heart(a, 48, beats=(0, 1.0)); clock(a, 48, vel=.35, sub_div=2)
    for b in range(0, 48, 4): a.note('cbt', 26, b, 0, 12, .32, 0, .4)
    for b in range(48): a.hit('castanets-rr1.wav', b, 2.5, .1, 0, .2)
    return a

def croquet(face):
    """槌球场: a court sarabande, polite and armed. 108 bpm."""
    a = Arr(108, 32, face, 41); T, C = THEME, CHORDS
    for p in range(2):
        o = p * 16
        if face == 0:
            a.arp('hps', C, o, 50, [0, 2, 3, 4, 3, 2], vel=.4, pan=-.2, send=.3, dur=.6)
            a.bass('vcp' if p == 0 else 'vcss', C, o, 38, beats=(0, 1), dur=1, vel=.5); a.arp('vas', C, o, 53, [None, 1, None], step=1, vel=.34, pan=.2, dur=.6); a.arp('v1s', C, o, 57, [None, 2, None], step=1, vel=.3, pan=-.2, dur=.6)
            a.line('ob', T, o, vel=.5, pan=.1, send=.4, leg=.95)
            if p: a.line('v1', T, o, shift=12, vel=.34, send=.5); a.line('fl', T, o, shift=12, vel=.3, pan=-.2, send=.5); a.pad('hn', C, o, 50, vel=.2, voices=(0, 2)); a.pad('cb', C, o, 26, vel=.34, voices=(0,))
            for b in range(0, 16, 4): a.note('timpp' if not p else 'timp', a.tones(C[b], 38)[0], o + b, 0, 2, .3 + .15 * p, 0, .4)
            for b in range(3, 16, 4):
                for k in range(3): a.hit('snare-rh-p.wav', o + b, 2 + k / 3, .08 + .04 * k, .25)
        else:
            a.line('vcs', T, o, shift=-12, vel=.5, pan=-.1, send=.5); a.pad('org', C, o, 50, vel=.2, send=.6); a.pad('cb', C, o, 26, vel=.2, voices=(0,), send=.1)
            a.arp('hps', C, o, 38, [4, None, 2, None, 0, None], vel=.3, pan=.25, send=.6, dur=1)
            a.arp('cbp', C, o, 26, [0, None, None], step=1, vel=.5, dur=1)
            if p: a.line('hn', T, o, shift=-12, vel=.3, pan=.2, send=.5); a.pad('chm', C, o, 38, vel=.2, voices=(0, 2), send=.8); a.line('box', T, o, vel=.26, pan=.35, send=.9, swell=.9)
            for b in range(0, 16, 8): a.note('timpp', a.tones(C[b], 38)[0], o + b, 0, 2, .35, 0, .5)
    if face: a.hit('tamtam-a.wav', 0, 0, .16, 0, .7)
    else: a.hit('piatti.wav', 16, 0, .1, 0, .6)
    return a

def croquet_pulse():
    a = Arr(108, 32, 0, 7); heart(a, 32, beats=(0, .55)); clock(a, 32, vel=.35)
    for b in range(0, 32, 4): a.note('cbt', 26, b, 0, 12, .35, 0, .4)
    for b in range(32):
        for k, g in ((1, .08), (2, .08), (2.5, .1)): a.hit('snare-lh-p.wav', b, k, g, 0, .2)
    return a

def trial(face):
    """谁偷了馅饼: the Queen's court. Harpsichord, organ, choir, timpani. 152 bpm, felt in one."""
    a = Arr(152, 48, face, 51); T, C = QUEEN, QCH
    for p in range(3):
        o = p * 16
        if face == 0:
            a.arp('hps', C, o, 50, [0, 2, 3, 4, 3, 2], vel=.42, pan=-.25, send=.3, dur=.5)
            a.arp('vcss', C, o, 38, [0, 0, 0], step=1, vel=.5, dur=.5, send=.25); a.arp('cbs', C, o, 26, [0, None, None], step=1, vel=.55, dur=.6)
            a.arp('vas', C, o, 53, [None, 1, 1], step=1, vel=.36, pan=.2, dur=.5); a.arp('v1s', C, o, 57, [None, 2, 2], step=1, vel=.3, pan=-.2, dur=.5)
            a.line('v1', T, o, vel=.42, send=.45, pan=-.1)
            if p >= 1: a.line('chf', T, o, vel=.34, send=.7); a.pad('hn', C, o, 50, vel=.24, voices=(0, 2)); a.line('ob', T, o, vel=.3, pan=.2)
            if p == 2: a.pad('orgd', C, o, 50, vel=.2, send=.6); a.line('tbn', T, o, shift=-12, vel=.3, pan=.25, send=.45); a.line('v1', T, o, shift=12, vel=.26, send=.5, pan=.1)
            for b in range(16):
                r = a.tones(C[b], 38)[0]; a.note('timp', r if r <= 45 else r - 12, o + b, 0, 1, .34 + .1 * p, 0, .35)
                if p and b % 2: a.note('timp', 45, o + b, 2, 1, .26, 0, .35)
                if p == 2:
                    for k, g in ((0, .14), (1.5, .08), (2, .1), (2.5, .1)): a.hit('snare-rh-mf.wav', o + b, k, g, .2, .25)
            a.hit('piatti.wav', o, 0, .1 + .05 * p, 0, .6); a.note('glk', 86, o + 7, 0, 3, .3, .3, .6); a.note('glk', 86, o + 15, 0, 3, .3, .3, .6)
        else:
            a.pad('org', C, o, 50, vel=.24, send=.6); a.pad('cb', C, o, 26, vel=.22, voices=(0,), send=.1)
            a.arp('vcss', C, o, 38, [0, 2, 1], step=1, vel=.46, dur=.5, pan=.15); a.arp('cbs', C, o, 26, [0, None, 0], step=1, vel=.5, dur=.6)
            a.line('chm', T, o, shift=-12, vel=.5, send=.7); a.line('hps', T, o, shift=-12, vel=.3, pan=-.3, send=.6)
            if p >= 1: a.line('tbn', T, o, shift=-12, vel=.32, pan=.2); a.arp('hps', C, o, 38, [4, 3, 2, 3, 0, 2], vel=.26, pan=.3, dur=.5, send=.5)
            if p == 2: a.line('vcs', T, o, shift=-12, vel=.34, pan=-.15); a.line('box', T, o, vel=.26, pan=.35, send=.9, swell=.45); a.pad('glass', C, o, 62, vel=.14, send=.8)
            for b in range(0, 16, 2): r = a.tones(C[b], 38)[0]; a.note('timp', r if r <= 45 else r - 12, o + b, 0, 1, .36, 0, .5)
            a.hit('tamtam-b.wav', o, 0, .16, 0, .7)
    return a

def trial_pulse():
    a = Arr(152, 48, 0, 8); heart(a, 48, beats=(0, 1.0)); clock(a, 48, vel=.35, sub_div=2)
    for b in range(0, 48, 4): a.note('cbt', 26, b, 0, 12, .35, 0, .4); a.note('v1t', 86, b + 2, 0, 6, .07, 0, .6)
    for b in range(48):
        for k, g in ((0, .1), (1, .07), (1.5, .07), (2, .09)): a.hit('snare-lh-p.wav', b, k, g, 0, .2)
    return a

CUES = {  # name: (builder, pulse builder, bpm, bars, chords)
    'title': (title, None, 72, 32, CHORDS), 'rabbit': (rabbit, rabbit_pulse, 84, 32, CHORDS), 'tea': (tea, tea_pulse, 132, 48, CHORDS),
    'croquet': (croquet, croquet_pulse, 108, 32, CHORDS), 'trial': (trial, trial_pulse, 152, 48, QCH),
}
MARGIN = .25
HALL = make_ir(3.4); CRYPT = make_ir(5.5, bright=3800, seed=9, predelay=.04, damp=.6)

def master(a, ir, target, lowpass=None, wet=.9, cut=.45):
    x = a.m.bounce(ir, wet); x = filt(x, 'high', 36); x = x - cut * filt(x, 'low', 170)  # low shelf: keep the bass, lose the mud
    if lowpass: x = filt(x, 'low', lowpass, 1)
    x = wrap_loop(x, a.len, MARGIN)
    x *= 10 ** ((target - lufs(x)) / 20)
    return limit(x)

def render(name):
    build, pulse, bpm, bars, chords = CUES[name]
    faces = [0] if name == 'title' else [0, 1]
    for f in faces:
        a = build(f); x = master(a, CRYPT if f else HALL, -19.5 if f else -19, lowpass=10000 if f else None, wet=.85 if f else 1.0, cut=.35 if f else .45)
        save(f'{OUT}/{name}-{"ab"[f]}.m4a', x, '112k'); print(name, 'ab'[f], round(a.len, 2), 's', round(lufs(x), 1), 'LUFS', flush=True)
    if pulse:
        a = pulse(); x = master(a, HALL, -24, wet=.5, cut=0); save(f'{OUT}/{name}-p.m4a', x, '56k', mono=True)
    A = Arr(bpm, bars, 0); B = Arr(bpm, bars, 1)
    return {'bpm': bpm, 'bars': bars, 'margin': MARGIN, 'len': round(A.len, 5), 'faces': len(faces), 'pulse': bool(pulse),
            'chords': [[[x % 12 for x in A.tones(c, 60)] for c in chords], [[x % 12 for x in B.tones(c, 60)] for c in chords]]}

if __name__ == '__main__':
    names = sys.argv[1:] or list(CUES); mf = f'{OUT}/score.json'
    man = json.load(open(mf)) if os.path.exists(mf) else {}
    for n in names: man[n] = render(n)
    json.dump(man, open(mf, 'w'), separators=(',', ':')); save_tuning()
