// Everything is synthesised: a music box above the glass, the same tune detuned and slowed beneath it.
let ctx, master, mirror = 0, timer, step = 0, muted = false;
const TUNE = [659, 784, 988, 784, 880, 659, 587, 494, 659, 784, 988, 1175, 1047, 880, 784, 0];
function note(freq, at, len, type, gain, dest = master) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(gain, at + .01); g.gain.exponentialRampToValueAtTime(.0001, at + len);
  o.connect(g).connect(dest); o.start(at); o.stop(at + len + .05); return o;
}
function tick() {
  const t = ctx.currentTime + .05, f = TUNE[step++ % TUNE.length];
  if (f) { if (mirror) { note(f / 4 * .97, t, 1.6, 'sawtooth', .05); note(f / 2 * 1.03, t, 1.2, 'triangle', .05); } else { note(f, t, .9, 'sine', .09); note(f * 2.01, t, .4, 'sine', .03); } }
  if (mirror && step % 4 === 0) note(55, t, 1.4, 'sine', .22);
  timer = setTimeout(tick, mirror ? 520 : 300);
}
export const audio = {
  start() { if (ctx) return; ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = .5; master.connect(ctx.destination); tick(); },
  setMirror(v) { mirror = v; },
  toggle() { muted = !muted; if (master) master.gain.value = muted ? 0 : .5; return muted; },
  sfx(name) {
    if (!ctx) return; const t = ctx.currentTime;
    if (name === 'step') note(520, t, .12, 'triangle', .12);
    if (name === 'tick') note(180, t, .08, 'square', .06);
    if (name === 'slide') { const o = note(1400, t, .35, 'sawtooth', .07); o.frequency.exponentialRampToValueAtTime(120, t + .3); }
    if (name === 'flip') { const o = note(90, t, 1, 'sine', .3); o.frequency.exponentialRampToValueAtTime(700, t + .45); o.frequency.exponentialRampToValueAtTime(60, t + .9); note(2400, t + .4, .5, 'sine', .05); }
    if (name === 'kill') { [1568, 2093, 2637].forEach((f, i) => note(f, t + i * .04, .5, 'sine', .08)); const o = note(300, t, .2, 'square', .1); o.frequency.exponentialRampToValueAtTime(40, t + .2); }
    if (name === 'death') { const o = note(220, t, 1.2, 'sawtooth', .22); o.frequency.exponentialRampToValueAtTime(30, t + 1.1); note(47, t, 1.4, 'square', .12); }
    if (name === 'win') [523, 659, 784, 1047, 1319].forEach((f, i) => note(f, t + i * .09, 1.2, 'sine', .1));
  },
};
