// 全部声音现场合成：钟、落子、撕页、八音盒。
let ctx = null, master = null, on = true, timer = null, night = false;

export function unlock() {
  if (ctx) { ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = on ? 0.5 : 0; master.connect(ctx.destination);
  const loop = () => { if (on) musicBox(); timer = setTimeout(loop, 900 + Math.random() * 1700); };
  if (!timer) loop();
}
export function setOn(value) { on = value; if (master) master.gain.value = on ? 0.5 : 0; }
export function setNight(value) { night = value; }

function tone(freq, dur, type = 'sine', gain = 0.2, when = 0) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + when;
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, from, to, gain = 0.3) {
  if (!ctx) return;
  const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), t = ctx.currentTime;
  s.buffer = buf; f.type = 'bandpass'; f.Q.value = 1.2;
  f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.value = gain; s.connect(f).connect(g).connect(master); s.start();
}
function musicBox() {
  const scale = night ? [220, 233.1, 277.2, 329.6, 349.2, 440] : [523.3, 587.3, 659.3, 784, 880, 1046.5];
  const f = scale[Math.floor(Math.random() * scale.length)];
  tone(f, 1.6, 'sine', 0.05); tone(f * 2.01, 0.9, 'sine', 0.018);
}
export const step = (hours) => { for (let i = 0; i < hours; i++) tone(1400 - i * 120, 0.07, 'square', 0.04, i * 0.09); noise(0.08, 900, 300, 0.12); };
export const tear = () => { noise(0.45, 4200, 500, 0.4); tone(92, 0.4, 'sawtooth', 0.12); };
export const shove = () => { noise(0.2, 300, 90, 0.5); tone(70, 0.25, 'sine', 0.3); };
export function bell() {
  const base = night ? 98 : 130.8;
  [[1, 3.6, 0.3], [2, 2.6, 0.16], [2.76, 2.0, 0.12], [5.4, 1.2, 0.07], [8.93, 0.7, 0.04]].forEach(([m, d, g]) => tone(base * m, d, 'sine', g));
  noise(0.12, 2600, 700, 0.25);
}
export const fanfare = () => [0, 0.18, 0.36, 0.62].forEach((t, i) => tone([392, 466.2, 587.3, 784][i], 1.4, 'triangle', 0.12, t));
