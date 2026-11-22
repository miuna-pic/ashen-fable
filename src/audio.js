// The score is one lullaby recorded three ways per chapter: `a` above the glass, `b` its melodic inversion below it,
// `p` a danger layer. All three stems run bar-locked; flipping the board only moves the listener through the glass.
// Stems and one-shots are rendered offline from sampled instruments by tools/audio (see tools/audio/README.md).
const BASE = (import.meta.env?.BASE_URL ?? './') + 'audio/';
const SFX = ['step', 'slide', 'tick', 'flip', 'kill', 'death', 'win', 'ui', 'dialog', 'banner', 'warn'];
const CUE_OF = { 'rabbit-hole': 'rabbit', tea: 'tea', croquet: 'croquet', trial: 'trial' };
const ROTATION = ['rabbit', 'tea', 'croquet'];
const VOL = { music: .8, sfx: .9 };
const store = typeof localStorage === 'undefined' ? null : localStorage;

let ctx, master, music, fx, score = null, cue = null, wanted = 'title', token = 0;
let mirror = 0, danger = 0, muted = store?.getItem('mirror-alice-mute') === '1', wired = false, arp = 0, lastBar = -1, quietUntil = 0;
const shots = {};

/** Which cue a level plays: its own, the boss cue for a boss level, otherwise a rotation of the three field cues. */
export function cueFor(level, index = 0) {
  if (!level) return 'title';
  return CUE_OF[level.id] || (level.boss ? 'trial' : ROTATION[index % ROTATION.length]);
}
/** The pitch (midi) a footstep rings: the n-th tone of the chord the score is on, climbing. Mirror steps descend an octave lower. */
export function stepNote(pcs, n, face) {
  const root = 62 + ((pcs[0] - 2 + 18) % 12) - 6; // the chord root nearest D4
  const tones = pcs.map((p) => root + ((p - pcs[0] + 12) % 12)).sort((x, y) => x - y); tones.push(tones[0] + 12);
  const k = n % tones.length;
  return face ? tones[tones.length - 1 - k] : tones[k] + 12;
}

const get = async (file) => {
  const data = await (await fetch(BASE + file)).arrayBuffer();
  return new Promise((ok, no) => ctx.decodeAudioData(data, ok, no));
};
const ramp = (param, v, s) => { const t = ctx.currentTime; param.cancelScheduledValues(t); param.setValueAtTime(param.value, t); param.linearRampToValueAtTime(v, t + s); };

function mix(s = .9) {
  if (!cue) return;
  const { a, b, p } = cue.stems;
  // The face you are on is clear; the other one leaks through the glass, dull and far away.
  for (const [stem, on] of [[a, !mirror], [b, !!mirror]]) {
    if (!stem) continue;
    ramp(stem.gain.gain, on || !b ? 1 : .2, s);
    stem.tone.frequency.cancelScheduledValues(ctx.currentTime); stem.tone.frequency.setTargetAtTime(on || !b ? 20000 : 420, ctx.currentTime, s / 3);
  }
  if (p) ramp(p.gain.gain, danger * 1.1, 1.6);
}
function stopCue(c, fade = 1.4) {
  if (!c) return;
  ramp(c.out.gain, 0, fade);
  setTimeout(() => { for (const k in c.stems) { try { c.stems[k].src.stop(); } catch { /* never started */ } c.stems[k].src.disconnect(); } c.out.disconnect(); }, fade * 1000 + 100);
}
async function playCue(name) {
  wanted = name; if (!ctx || cue?.name === name) return;
  const mine = ++token; stopCue(cue); cue = null;
  try {
    score ||= await (await fetch(BASE + 'score.json')).json();
    const meta = score[name], keys = ['a', ...(meta.faces > 1 ? ['b'] : []), ...(meta.pulse ? ['p'] : [])];
    const bufs = await Promise.all(keys.map((k) => get(`${name}-${k}.m4a`)));
    if (mine !== token) return;
    const out = ctx.createGain(), at = ctx.currentTime + .08, stems = {};
    out.gain.value = 0; out.connect(music);
    keys.forEach((k, i) => {
      const src = ctx.createBufferSource(), tone = ctx.createBiquadFilter(), gain = ctx.createGain();
      // every file is the loop wrapped onto itself with `margin` seconds spare on both sides, so the seam is sample-exact
      src.buffer = bufs[i]; src.loop = true; src.loopStart = meta.margin; src.loopEnd = meta.margin + meta.len;
      tone.type = 'lowpass'; tone.frequency.value = 20000; tone.Q.value = .5; gain.gain.value = k === 'a' ? 1 : 0;
      src.connect(tone).connect(gain).connect(out); src.start(at, meta.margin); stems[k] = { src, tone, gain };
    });
    cue = { name, meta, stems, out, at }; ramp(out.gain, 1, name === 'title' ? .4 : 1.2); mix(.05); arp = 0; lastBar = -1;
  } catch (e) { console.warn('[audio] cue failed', name, e); }
}
// Where the score is right now: bar index and seconds until the next semiquaver.
function clock() {
  if (!cue) return null;
  const m = cue.meta, beat = 60 / m.bpm, pos = ((ctx.currentTime - cue.at) % m.len + m.len) % m.len, grid = beat / 4;
  return { bar: Math.floor(pos / (beat * 3)) % m.chords[0].length, wait: (grid - (pos % grid)) % grid };
}
function shot(name, { rate = 1, gain = 1, when = 0, pan = 0 } = {}) {
  const buf = shots[name]; if (!buf) return;
  const src = ctx.createBufferSource(), g = ctx.createGain(); src.buffer = buf; src.playbackRate.value = rate; g.gain.value = gain;
  if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; src.connect(g).connect(p).connect(fx); } else src.connect(g).connect(fx);
  src.start(ctx.currentTime + when);
}
// Music steps back for the big moments, then returns.
function duck(to, hold, back = 1.5) {
  const t = ctx.currentTime, g = music.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(VOL.music * to, t + .12); g.setValueAtTime(VOL.music * to, t + hold); g.linearRampToValueAtTime(VOL.music, t + hold + back);
}
// Footsteps play the score: each one rings the next tone of the chord the music is on, on the next semiquaver.
function footstep(slide) {
  const c = clock(), pcs = c ? cue.meta.chords[mirror ? 1 : 0][c.bar] : [2, 5, 9];
  if (c && c.bar !== lastBar) { lastBar = c.bar; arp = 0; }
  const when = c && c.wait < .09 ? c.wait : 0, note = stepNote(pcs, arp++, mirror);
  if (slide) { shot('slide', { rate: 2 ** ((((pcs[0] - 2 + 18) % 12) - 6) / 12), gain: .9, when }); shot('step', { rate: 2 ** ((note - 74) / 12), gain: .35, when: when + .28, pan: -.2 }); }
  else shot('step', { rate: 2 ** ((note - 74) / 12), gain: .8, when, pan: .15 });
}
// Interface sounds are wired from here so the game code does not have to know about them.
function wire() {
  if (wired || typeof document === 'undefined') return; wired = true;
  const $ = (s) => document.querySelector(s), watch = (el, opts, fn) => el && new MutationObserver(fn).observe(el, opts);
  document.addEventListener('click', (e) => { const b = e.target.closest?.('button'); if (b && b.id !== 'flip' && b.id !== 'begin') audio.sfx('ui'); }, true);
  watch($('#dialog p'), { childList: true, characterData: true, subtree: true }, () => audio.sfx('dialog'));
  let shown = false;
  watch($('#banner'), { attributes: true, attributeFilter: ['class'] }, () => { const on = $('#banner').classList.contains('show'); if (on && !shown) audio.sfx('banner'); shown = on; if (on) setTimeout(() => { shown = false; }, 300); });
  watch($('#title'), { attributes: true, attributeFilter: ['class'] }, () => { if (!$('#title').classList.contains('gone')) playCue('title'); });
  $('#mute')?.classList.toggle('off', muted);
  document.addEventListener('visibilitychange', () => { if (ctx) document.hidden ? ctx.suspend() : ctx.resume(); });
}

export const audio = {
  /** Call from a user gesture. Safe to call again. */
  start() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    const limit = ctx.createDynamicsCompressor(); limit.threshold.value = -6; limit.knee.value = 6; limit.ratio.value = 8; limit.attack.value = .003; limit.release.value = .2;
    master = ctx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(limit).connect(ctx.destination);
    music = ctx.createGain(); music.gain.value = VOL.music; music.connect(master);
    fx = ctx.createGain(); fx.gain.value = VOL.sfx; fx.connect(master);
    for (const n of SFX) get(`sfx/${n}.m4a`).then((b) => { shots[n] = b; }, () => {});
    wire(); playCue(wanted);
  },
  /** Chapter music. `level` is a LEVELS entry (or null for the title screen). */
  level(level, index) { playCue(cueFor(level, index)); },
  setMirror(v) { mirror = v ? 1 : 0; if (ctx) mix(); },
  /** 0..1: how much of what Alice can do next gets her killed. Brings in the heartbeat and the clock. */
  setDanger(v) { const d = Math.max(0, Math.min(1, v)); if (d === danger) return; if (ctx && d > .6 && danger <= .6) audio.sfx('warn'); danger = d; if (ctx) mix(); },
  toggle() { muted = !muted; store?.setItem('mirror-alice-mute', muted ? '1' : '0'); if (master) ramp(master.gain, muted ? 0 : 1, .15); return muted; },
  get muted() { return muted; },
  sfx(name) {
    if (!ctx || ctx.state !== 'running') return;
    if (name === 'step') return footstep(false);
    if (name === 'slide') return footstep(true);
    if (name === 'banner' && ctx.currentTime < quietUntil) return;
    if (name === 'flip') duck(.55, .5, 1.2);
    if (name === 'kill') duck(.7, .3, .8);
    if (name === 'death') { duck(.12, 2.6, 2.5); quietUntil = ctx.currentTime + 3; }
    if (name === 'win') { duck(.1, 5, 2.5); quietUntil = ctx.currentTime + 6; }
    shot(name, { gain: name === 'ui' || name === 'dialog' ? .6 : 1 });
  },
  /** For the sound test and for tests: what is playing. */
  get state() { return { cue: cue?.name ?? null, wanted, mirror, danger, muted, running: ctx?.state === 'running', clock: ctx && cue ? clock() : null }; },
};
// The title theme starts on the first touch anywhere, before the player has pressed anything.
if (typeof window !== 'undefined') {
  const unlock = () => { audio.start(); if (ctx?.state === 'running') ['pointerdown', 'keydown', 'touchend'].forEach((e) => removeEventListener(e, unlock, true)); };
  ['pointerdown', 'keydown', 'touchend'].forEach((e) => addEventListener(e, unlock, true));
  if (import.meta.env?.DEV) window.__audio = audio;
}
