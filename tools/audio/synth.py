"""Offline sampler + mixer used to render the score. Samples come from free libraries (see README.md)."""
import os, re, glob, functools
import numpy as np, soundfile as sf
from scipy.signal import fftconvolve, butter, sosfilt, resample_poly

SR = 48000
LIBS = os.environ.get('AUDIO_LIBS', os.path.expanduser('~/audiolab/libs'))
SSO = f'{LIBS}/sso/Sonatina Symphonic Orchestra/Samples'
VCSL = f'{LIBS}/VCSL'
NOTE = {'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11}

def midi(name):
    """'d5' / 'c#4' / 'eb3' -> midi number (c4 = 60)."""
    if name.isdigit(): return int(name)
    m = re.fullmatch(r'([a-g])([#b]?)(-?\d)', name.lower())
    return NOTE[m[1]] + (1 if m[2] == '#' else -1 if m[2] == 'b' else 0) + 12 * (int(m[3]) + 1)

@functools.lru_cache(maxsize=None)
def load(path):
    x, sr = sf.read(path, dtype='float32', always_2d=True)
    if x.shape[1] == 1: x = np.repeat(x, 2, axis=1)
    if sr != SR: x = resample_poly(x, SR, sr, axis=0).astype('float32')
    # trim leading silence so attacks land on the beat
    env = np.abs(x).max(axis=1); pk = env.max() or 1
    start = int(np.argmax(env > pk * .02)); start = max(0, start - 96)
    return x[start:]

_TUNE_FILE = os.path.join(LIBS, 'tuning.json')
try: _TUNE = __import__('json').load(open(_TUNE_FILE))
except Exception: _TUNE = {}

def measure_cents(path, note, harmonics=5):
    """How far (in cents, within +-150) a sample really is from the pitch its file name claims.
    The libraries' file names are only nominal: whole articulations sit a semitone off, and single notes drift 10-60 cents."""
    key = os.path.relpath(path, LIBS)
    if key not in _TUNE:
        x = load(path)[:, 0]; a = int(.12 * SR); x = x[a:a + int(1.0 * SR)] if len(x) > a + SR // 2 else x
        n = 1 << 19; S = np.abs(np.fft.rfft(x * np.hanning(len(x)), n)); S = np.convolve(S, np.ones(5) / 5, 'same'); bw = SR / n
        f = 440 * 2 ** ((note - 69) / 12); best = (0, 0.0)
        for c in np.arange(-150, 151, 2):
            g = f * 2 ** (c / 1200); e = sum(S[int(round(g * h / bw))] / h for h in range(1, harmonics + 1) if g * h < 14000)
            if e > best[0]: best = (e, float(c))
        _TUNE[key] = best[1]
    return _TUNE[key]

def save_tuning(): __import__('json').dump(_TUNE, open(_TUNE_FILE, 'w'))

class Inst:
    """A pitched multisample: files matched by glob, pitch parsed from the file name by `rx` (group 1)."""
    def __init__(self, pattern, rx=r'-([a-gA-G]#?\d)', gain=1.0, attack=.004, release=.25, sustain=False, tune=0.0, norm=True, vib=None, harmonics=5, octave=0, lowpass=None):
        self.zones = {}
        for f in sorted(glob.glob(pattern)):
            m = re.search(rx, os.path.basename(f))
            if m: self.zones.setdefault(midi(m[1]) + 12 * octave, []).append(f)
        assert self.zones, pattern
        self.keys = sorted(self.zones); self.gain, self.attack, self.release, self.sustain, self.tune, self.norm, self.vib = gain, attack, release, sustain, tune, norm, vib
        self.rr = 0; self.harmonics = harmonics; self.lowpass = lowpass
    def render(self, note, dur, vel=.8, detune=0.0):
        k = min(self.keys, key=lambda z: (abs(z - note), z)); files = self.zones[k]; self.rr += 1
        f = files[self.rr % len(files)]; x = load(f)
        ratio = 2 ** ((note - k + self.tune + detune - measure_cents(f, k, self.harmonics) / 100) / 12)
        n = int((dur + self.release) * SR) if self.sustain else int(min(len(x) / ratio, (max(dur, .05) + self.release + 6) * SR))
        pos = np.arange(n) * ratio
        if self.vib:  # delayed vibrato for solo lines: (depth semitones, rate Hz, delay s)
            d, r, dl = self.vib; t = np.arange(n) / SR
            pos = np.cumsum(ratio * 2 ** (d * np.clip((t - dl) / .5, 0, 1) * np.sin(2 * np.pi * r * t) / 12))
        if self.sustain and pos[-1] >= len(x) - 2:  # sample shorter than the note: ping-pong the stable middle
            a, b = int(len(x) * .35), int(len(x) * .8); span = b - a
            over = pos > b; q = (pos[over] - b) % (2 * span); pos[over] = b - np.where(q < span, q, 2 * span - q)
        pos = np.clip(pos, 0, len(x) - 1.001); i = pos.astype(np.int64); fr = (pos - i)[:, None].astype('float32')
        y = x[i] * (1 - fr) + x[i + 1] * fr
        if self.norm: y = y / (np.abs(x[:SR]).max() + 1e-6)
        if self.lowpass: y = filt(y, 'low', self.lowpass, 1)
        t = np.arange(n) / SR
        env = np.minimum(1, t / max(self.attack, 1e-4)) ** 1.5
        rel = np.clip((t - dur) / self.release, 0, 1); env = env * (1 - rel) ** 2 if self.sustain else env * np.exp(-np.clip(t - dur, 0, None) / (self.release * .5))
        return y * env[:, None] * self.gain * vel

class Piano:
    """Salamander Grand: 16 velocity layers sampled in minor thirds, played with the pedal down (notes ring)."""
    def __init__(self, gain=1.0, lowpass=None, ring=4.0):
        self.dir = f'{LIBS}/SalamanderGrandPiano/Samples'; self.gain, self.lowpass, self.ring = gain, lowpass, ring
        self.keys = sorted({midi(os.path.basename(f).split('v')[0]) for f in glob.glob(f'{self.dir}/[A-G]*v1.flac')})
    def render(self, note, dur, vel=.6, detune=0.0):
        k = min(self.keys, key=lambda z: (abs(z - note), z)); name = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][k % 12] + str(k // 12 - 1)
        layer = int(np.clip(round(1 + vel * 13), 1, 16)); x = load(f'{self.dir}/{name}v{layer}.flac')
        ratio = 2 ** ((note - k) / 12); n = int(min(len(x) / ratio - 2, (dur + self.ring) * SR))
        pos = np.arange(n) * ratio; i = pos.astype(np.int64); fr = (pos - i)[:, None].astype('float32'); y = x[i] * (1 - fr) + x[i + 1] * fr
        t = np.arange(n) / SR; y = y * np.exp(-np.clip(t - dur, 0, None) / (self.ring * .35))[:, None]
        if self.lowpass: y = filt(y, 'low', self.lowpass, 1)
        return y * self.gain * 2.2

class Layer:
    """Several voices played as one instrument: [(inst, semitone shift, gain)]."""
    def __init__(self, *parts): self.parts = parts
    def render(self, note, dur, vel=.8, detune=0.0):
        ys = [p.render(note + sh, dur, vel, detune) * g for p, sh, g in self.parts]; n = max(map(len, ys)); y = np.zeros((n, 2), 'float32')
        for q in ys: y[:len(q)] += q
        return y

class Synth:
    """A pitched voice computed by fn(freq, dur, vel) -> mono or stereo array."""
    def __init__(self, fn, gain=1.0): self.fn, self.gain = fn, gain
    def render(self, note, dur, vel=.8, detune=0.0):
        y = self.fn(440 * 2 ** ((note - 69 + detune) / 12), dur, vel)
        return (np.repeat(y[:, None], 2, 1) if y.ndim == 1 else y) * self.gain * vel

def music_box(f, dur, vel):
    """Comb tine: clamped bar partials (1, 6.27, 17.5) into a small wooden box."""
    n = int(SR * 3.2); t = np.arange(n) / SR; d = 1.1 + 500 / f
    y = np.sin(2 * np.pi * f * t) * np.exp(-t / d) + .5 * np.sin(2 * np.pi * 2.005 * f * t) * np.exp(-t / (d * .45))
    for r, a, dd in ((6.27, .22 * vel, .09), (17.5, .07 * vel, .03)):
        if f * r < 18000: y += a * np.sin(2 * np.pi * f * r * t + 1) * np.exp(-t / dd)
    y += .05 * np.random.default_rng(int(f)).standard_normal(n) * np.exp(-t / .004)
    return (y * np.minimum(1, t / .0015) * .5).astype('float32')

def glass(f, dur, vel):
    """Bowed glass / singing bowl: slow swell, beating partials."""
    n = int(SR * (dur + 2.5)); t = np.arange(n) / SR; y = np.zeros(n)
    for r, a in ((1, 1), (1.0015, .7), (2, .16), (2.004, .1), (3, .04)): y += a * np.sin(2 * np.pi * f * r * t + r * 7)
    env = np.minimum(1, t / (.35 + dur * .3)) ** 2 * np.exp(-np.clip(t - dur, 0, None) / .9)
    return (y * env * (1 + .08 * np.sin(2 * np.pi * 3.1 * t)) * .3).astype('float32')

def sub(f, dur, vel):
    n = int(SR * (dur + .6)); t = np.arange(n) / SR
    y = np.sin(2 * np.pi * f * t) + .3 * np.sin(4 * np.pi * f * t)
    return (np.tanh(y * 1.5) * np.minimum(1, t / .05) * np.exp(-np.clip(t - dur, 0, None) / .25) * .5).astype('float32')

def filt(x, kind, hz, order=2):
    return sosfilt(butter(order, hz, kind, fs=SR, output='sos'), x, axis=0).astype('float32')

def make_ir(seconds=3.2, bright=6500, seed=7, predelay=.018, damp=1.0):
    """Synthetic hall: decorrelated stereo noise with frequency-dependent decay and a few early reflections."""
    rng = np.random.default_rng(seed); n = int(seconds * SR); t = np.arange(n) / SR
    ir = np.zeros((n, 2), 'float32')
    for lo, hi, rt in ((40, 250, 1.15), (250, 1000, 1.0), (1000, 3000, .75), (3000, bright, .5), (bright, 14000, .28 * damp)):
        b = rng.standard_normal((n, 2)).astype('float32'); b = filt(filt(b, 'high', lo), 'low', hi)
        ir += b * np.exp(-6.9 * t / (seconds * rt))[:, None]
    ir *= np.minimum(1, t / .03)[:, None] ** .5
    for _ in range(14):
        k = int(rng.uniform(.004, .07) * SR); ir[k, rng.integers(2)] += rng.uniform(.3, .9) * rng.choice([-1, 1])
    ir = np.concatenate([np.zeros((int(predelay * SR), 2), 'float32'), ir])
    return ir / np.sqrt((ir ** 2).sum())

class Mix:
    """Timeline in seconds. add() places a rendered note on a bus with pan and reverb send."""
    def __init__(self, seconds, seed=1):
        self.n = int(seconds * SR); self.dry = np.zeros((self.n, 2), 'float32'); self.wet = np.zeros((self.n, 2), 'float32'); self.rng = np.random.default_rng(seed)
    def put(self, y, t, pan=0.0, send=.3, gain=1.0):
        i = int(t * SR)
        if i < 0: y = y[-i:]; i = 0
        if i >= self.n: return
        y = y[: self.n - i]; l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        y = np.stack([y[:, 0] * l, y[:, 1] * r], 1) * 1.414 * gain
        self.dry[i:i + len(y)] += y; self.wet[i:i + len(y)] += y * send
    def add(self, inst, note, t, dur, vel=.8, pan=0.0, send=.3, human=.008, detune=0.0, gain=1.0):
        t += self.rng.normal(0, human) if human else 0; vel *= 1 + self.rng.normal(0, .06) if human else 1
        self.put(inst.render(note, dur, vel, detune + (self.rng.normal(0, .03) if human else 0)), t, pan, send, gain)
    def bounce(self, ir, wet=1.0):
        w = filt(self.wet, 'high', 220)  # keep the low end out of the hall
        return self.dry + np.stack([fftconvolve(w[:, c], ir[:, c])[: self.n] for c in (0, 1)], 1).astype('float32') * wet

def reverse_swell(y, length):
    """Reversed note that sucks into its own attack: returns audio whose END is the note onset."""
    z = y[: int(length * SR)][::-1].copy(); z *= np.linspace(0, 1, len(z))[:, None] ** 2; return z

def lufs(x):
    """Rough integrated loudness (K-weighting approximated by a high shelf + 60 Hz high-pass)."""
    y = filt(x, 'high', 60); y = y + .58 * filt(y, 'high', 1500, 1)
    return -0.691 + 10 * np.log10((y ** 2).mean(axis=0).sum() + 1e-12)

def limit(x, ceiling=.89):
    """Look-ahead peak limiter."""
    pk = np.abs(x).max(axis=1); win = int(.005 * SR)
    from scipy.ndimage import maximum_filter1d, uniform_filter1d
    env = uniform_filter1d(maximum_filter1d(pk, win * 2 + 1), win * 2 + 1)
    return x * np.minimum(1, ceiling / np.maximum(env, 1e-6))[:, None]

def wrap_loop(x, loop_s, margin=.25):
    """Fold the tail after loop_s back onto the start, then add `margin` s of wrapped audio on both sides.
    The game loops [margin, margin+loop_s]; the margins keep the seam continuous even if a decoder shifts the file by a few ms."""
    L = int(round(loop_s * SR)); y = x[:L].copy(); tail = x[L:]
    while len(tail): k = min(L, len(tail)); y[:k] += tail[:k]; tail = tail[k:]
    m = int(margin * SR); return np.concatenate([y[-m:], y, y[:m]])

def save(path, x, bitrate='128k', mono=False):
    os.makedirs(os.path.dirname(path), exist_ok=True); wav = path.rsplit('.', 1)[0] + '.wav'
    sf.write(wav, x.mean(axis=1) if mono else x, SR, subtype='PCM_24')
    if not path.endswith('.wav'):
        os.system(f'ffmpeg -v error -y -i "{wav}" -c:a aac -b:a {bitrate} -movflags +faststart "{path}"'); os.remove(wav)
