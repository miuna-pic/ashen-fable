// 全程序合成：风声、八音盒、火柴、冰裂。无音频文件。
let ctx = null, master = null, muted = false, timer = null;

function noise(seconds) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf; return src;
}
function tone(freq, { at = 0, dur = 0.6, type = 'sine', gain = 0.15, slide = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
}
function hiss({ dur = 0.3, freq = 3000, q = 1, gain = 0.2, at = 0, type = 'bandpass', sweep = 1 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + at, n = noise(dur + 0.1), f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = type; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(freq * sweep, t + dur); f.Q.value = q;
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  n.connect(f).connect(g).connect(master); n.start(t); n.stop(t + dur + 0.1);
}

const SCALE = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25];
function musicBox() {
  let step = 0, last = 4;
  timer = setInterval(() => {
    if (!ctx || muted) return;
    const beat = step++ % 6;
    if (beat === 0) tone(SCALE[0] / 2 * (step % 24 < 12 ? 1 : 0.89), { dur: 2.4, gain: 0.05, type: 'triangle' });
    if (beat === 5 && Math.random() < 0.5) return;
    last = Math.max(0, Math.min(SCALE.length - 1, last + Math.round((Math.random() - 0.5) * 4)));
    tone(SCALE[last] * 2, { dur: 1.6, gain: 0.035 }); tone(SCALE[last] * 4.01, { dur: 0.5, gain: 0.012 });
  }, 520);
}

export const sound = {
  start() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
    const wind = noise(4); wind.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 0.6;
    const g = ctx.createGain(); g.gain.value = 0.05;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.13; lg.gain.value = 240; lfo.connect(lg).connect(f.frequency); lfo.start();
    wind.connect(f).connect(g).connect(master); wind.start();
    musicBox();
  },
  toggle() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.8; return muted; },
  select() { tone(880, { dur: 0.18, gain: 0.05 }); },
  step() { tone(520, { dur: 0.22, gain: 0.07, type: 'triangle' }); },
  swim() { hiss({ dur: 0.5, freq: 900, sweep: 2.4, gain: 0.12, q: 2 }); tone(660, { dur: 0.5, gain: 0.04, slide: 1.5 }); },
  dance() { [0, 0.11, 0.22].forEach((at, k) => tone(700 + k * 120, { at, dur: 0.12, gain: 0.07, type: 'square' })); },
  strike() { hiss({ dur: 0.16, freq: 5200, gain: 0.3, sweep: 0.6 }); hiss({ at: 0.14, dur: 0.9, freq: 1400, gain: 0.16, q: 0.5, sweep: 0.5 }); tone(196, { at: 0.14, dur: 1.4, gain: 0.08, type: 'triangle' }); tone(392, { at: 0.2, dur: 1.2, gain: 0.05 }); },
  out() { hiss({ dur: 0.5, freq: 2500, gain: 0.08, sweep: 0.2 }); },
  freeze() { hiss({ dur: 0.35, freq: 6500, gain: 0.09, q: 6, sweep: 1.3 }); tone(1900, { dur: 0.25, gain: 0.03 }); },
  shard() { tone(1500, { dur: 0.3, gain: 0.05, slide: 0.7, type: 'triangle' }); },
  shatter() { hiss({ dur: 0.5, freq: 4200, gain: 0.3, q: 0.8, sweep: 0.4 }); [1568, 2093, 2637].forEach((f, k) => tone(f, { at: k * 0.04, dur: 0.5, gain: 0.05 })); },
  clink() { tone(2400, { dur: 0.25, gain: 0.07 }); },
  hurt() { tone(160, { dur: 0.45, gain: 0.2, slide: 0.5, type: 'sawtooth' }); },
  queen() { hiss({ dur: 1.1, freq: 3000, gain: 0.35, q: 0.4, sweep: 0.2 }); tone(98, { dur: 1.6, gain: 0.25, slide: 0.5, type: 'sawtooth' }); [523, 659, 784, 1046].forEach((f, k) => tone(f, { at: 0.1 + k * 0.07, dur: 1, gain: 0.05 })); },
  foam() { hiss({ dur: 1.6, freq: 700, gain: 0.16, sweep: 4, q: 1.2 }); [659, 784, 988, 1319].forEach((f, k) => tone(f, { at: k * 0.16, dur: 1.4, gain: 0.05 })); },
  win() { [523, 659, 784, 1046, 1319].forEach((f, k) => tone(f, { at: k * 0.18, dur: 2, gain: 0.07 })); },
  lose() { [392, 330, 262, 196].forEach((f, k) => tone(f, { at: k * 0.3, dur: 1.8, gain: 0.08, type: 'triangle' })); },
};
