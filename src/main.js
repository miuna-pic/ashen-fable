import '@fontsource/noto-serif-sc/chinese-simplified-500.css';
import '@fontsource/noto-serif-sc/chinese-simplified-900.css';
import '@fontsource/noto-serif-sc/latin-900.css';
import './style.css';
import { createStage } from './stage.js';
import { audio } from './audio.js';
import { parseLevel, movesFor, play, allAims, solve, enemyAt, MAX_INK, W } from './rules.js';
import { LEVELS } from './levels.js';
import { STORY, NAMES, ART, RULES } from './story.js';

const app = document.querySelector('#app');
app.innerHTML = `
<canvas id="stage"></canvas>
<header class="hud top"><div class="chapter"><b id="no"></b><h2 id="name"></h2><i id="sub"></i></div>
  <div class="count"><i>ALICE No.</i><b id="count"></b><span>个爱丽丝</span></div></header>
<div id="toast"></div>
<footer class="hud bottom">
  <div class="ink"><span>墨</span><div id="ink"></div><small id="lead"></small></div>
  <button id="flip"><b>翻面</b><i>FLIP<span class="key"> · 空格</span></i></button>
  <div class="tools"><button id="hint">白兔</button><button id="retry">重来</button><button id="clean">清尸</button><button id="mute">声</button></div>
</footer>
<div id="banner"><b></b><i></i></div>
<div id="cutin"><img alt=""><b></b></div>
<div id="dialog"><img alt=""><div><b></b><p></p><i>轻触继续 ▶</i></div></div>
<section id="title"><div class="art" style="background-image:url(./art/key.webp)"></div><div class="veil"></div>
  <h1><span>镜渊</span><span>爱丽丝</span></h1><p class="en">ALICE<br>IN THE<br>MIRROR ABYSS</p>
  <p class="tag">一枚棋子，两具身体。<br>她在玻璃上面走，她在玻璃下面走。</p>
  <button id="begin">坠 入</button><small>黑暗童话棋 · 爱丽丝线提案试玩</small></section>`;
const $ = (s) => document.querySelector(s);
const stage = createStage($('#stage'));
const save = JSON.parse(localStorage.getItem('mirror-alice') || '{}');
let deaths = save.deaths || 0, index = 0, face = 0, st = null, hint = null, locked = true;
const graves = LEVELS.map(() => []);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function hud() {
  const level = LEVELS[index];
  $('#no').textContent = level.no; $('#name').textContent = level.title; $('#sub').textContent = level.sub;
  $('#count').textContent = 1865 + deaths;
  $('#ink').innerHTML = Array.from({ length: MAX_INK }, (_, i) => `<i class="${i < st.ink ? 'on' : ''}"></i>`).join('');
  $('#lead').textContent = face ? (st.ink ? '镜中的她领路 · 一滑到底，耗一滴墨' : '墨尽了。她动不了，翻回去') : '你领路 · 一步一格，吃子得墨';
  document.body.classList.toggle('mirror', !!face);
  $('#clean').style.display = graves[index].length ? '' : 'none';
  const moves = movesFor(st, face), aims = allAims(st), hot = new Set(aims.flatMap((a) => a.squares));
  audio.setDanger(moves.length ? moves.filter((m) => hot.has(m.to)).length / moves.length : 0);
  stage.paint(st, face, moves, aims, hint); layout();
}
function banner(big, small, ms = 1500) { const b = $('#banner'); b.querySelector('b').textContent = big; b.querySelector('i').textContent = small; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); return wait(ms); }
function toast(text) { const t = $('#toast'); t.textContent = text; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show'); }
function cutin(f) { const c = $('#cutin'); c.querySelector('img').src = `./art/${f ? 'alice_b' : 'alice_a'}.webp`; c.querySelector('b').textContent = f ? '镜 噬' : '吃 子'; c.classList.remove('show'); void c.offsetWidth; c.classList.add('show'); }
function talk(lines) {
  return new Promise((done) => {
    const d = $('#dialog'); let i = -1;
    const next = () => { if (++i >= lines.length) { d.classList.remove('show'); d.onclick = null; return done(); }
      const [who, text] = lines[i]; d.dataset.who = who; d.querySelector('img').src = `./art/${ART[who]}.webp`; d.querySelector('b').textContent = NAMES[who]; d.querySelector('p').textContent = text; };
    d.classList.add('show'); d.onclick = next; next();
  });
}
async function enter(i, story = true) {
  locked = true; index = i; hint = null; const level = LEVELS[i];
  if (face) { face = 0; audio.setMirror(0); await stage.flip(0); }
  st = parseLevel(level, graves[i]); stage.load(st); audio.level(level, i); hud();
  if (story) { await banner(level.title, level.no + ' · ' + level.sub, 1700); await talk(STORY[level.id]); }
  locked = false;
}
async function flip() {
  if (locked || stage.busy) return; locked = true; face = 1 - face; hint = null; audio.setMirror(face); audio.sfx('flip');
  document.body.classList.toggle('mirror', !!face); stage.paint(st, face, [], allAims(st), null);
  await stage.flip(face); locked = false; hud();
}
async function move(to) {
  const r = play(st, face, to); if (!r) return; locked = true; hint = null;
  stage.paint(st, face, [], allAims(st), null);
  await stage.animate(r.ev, { sfx: audio.sfx, cutin });
  st = r.st;
  if (st.result === 'dead') {
    deaths++; localStorage.setItem('mirror-alice', JSON.stringify({ deaths })); if (!graves[index].includes(to)) graves[index].push(to);
    await banner('斩 首', `第 ${1864 + deaths} 个爱丽丝留在了这一格`, 1600); return enter(index, false);
  }
  if (st.result === 'win') {
    if (index + 1 < LEVELS.length) { await banner('升 变', '下一格', 1300); return enter(index + 1); }
    await banner('将 死', 'CHECKMATE', 1800); await talk(STORY.ending); $('#title').classList.remove('gone'); $('#begin').textContent = '再 坠 一 次'; return;
  }
  locked = false; hud();
}
// The square a pointer means. A figure under the finger wins when it can be taken (or nothing else can be done there);
// a touch that just misses a legal square snaps to it; anything else is the square on the glass.
function aim(e) {
  const moves = movesFor(st, face), legal = (s) => moves.some((m) => m.to === s);
  const ground = stage.pick(e.clientX, e.clientY), body = stage.pickPiece(e.clientX, e.clientY, face);
  if (body >= 0 && (legal(body) || !legal(ground))) return body;
  if (ground >= 0 && (legal(ground) || ground === st.alice || st.corpses.includes(ground) || enemyAt(st, face, ground) || enemyAt(st, 1 - face, ground))) return ground;
  if (e.pointerType === 'mouse') return ground;
  // within 0.8 of a square's own on-screen width (near rows are drawn wider than far ones), the closest such square wins
  let near = ground, best = .8;
  for (const m of moves) {
    const p = stage.project(m.to), q = stage.project(m.to % W ? m.to - 1 : m.to + 1);
    const d = Math.hypot(p.x - e.clientX, p.y - e.clientY) / Math.hypot(p.x - q.x, p.y - q.y);
    if (d < best) { best = d; near = m.to; }
  }
  return near;
}
let tapped = -1;
function tap(s) {
  tapped = s;
  if (movesFor(st, face).some((m) => m.to === s)) return move(s);
  const e1 = enemyAt(st, face, s), e2 = enemyAt(st, 1 - face, s);
  if (e1 || e2) toast((e1 ? '' : '〔玻璃另一面〕') + RULES[(e1 || e2).kind]);
  else if (st.corpses.includes(s)) toast('爱丽丝的遗骸 · 挡路，也挡斧线');
  else if (s !== st.alice) toast(face ? (st.ink ? '她只走直线和斜线，且不能穿过镜面的棋子' : '没有墨了') : '你一次只能走一格');
}
// Press shows which square the finger means, sliding re-aims, lifting commits; a second finger or a system gesture cancels.
const canvas = $('#stage'); let held = null;
const show = (e) => {
  const s = locked || stage.busy ? -1 : aim(e), m = s >= 0 && movesFor(st, face).find((x) => x.to === s);
  stage.cursor(s, face, m ? (m.capture !== null ? '#ff3355' : face ? '#ffffff' : '#ffd774') : face ? '#7a5560' : '#8d93b8'); return s;
};
const drop = () => { held = null; stage.cursor(-1); };
canvas.addEventListener('pointerdown', (e) => {
  if (!e.isPrimary) return drop(); if (e.pointerType === 'mouse' && e.button) return;
  held = e.pointerId; try { canvas.setPointerCapture(e.pointerId); } catch {} show(e);
});
canvas.addEventListener('pointermove', (e) => { if (e.pointerId === held) show(e); });
canvas.addEventListener('pointerup', (e) => { if (e.pointerId !== held) return; const s = show(e); drop(); if (s >= 0) tap(s); });
canvas.addEventListener('pointercancel', drop);
// A finger that lands anywhere else (a HUD button, a second finger) calls the move off.
window.addEventListener('pointerdown', (e) => { if (held !== null && e.pointerId !== held) drop(); }, true);
for (const type of ['contextmenu', 'gesturestart', 'dblclick']) addEventListener(type, (e) => e.preventDefault());

// Tell the stage which parts of the screen the HUD leaves free: either the band between the top and bottom rows,
// or the column between the left and right corners. The stage frames the board in whichever shows bigger squares.
function layout() {
  const w = innerWidth, h = innerHeight, pad = Math.min(w, h) * .02 + 4;
  const rects = ['.chapter', '.count', '.ink', '#flip', '.tools'].map((q) => $(q).getBoundingClientRect()).filter((r) => r.width);
  const band = { l: pad, r: pad, t: pad, b: pad }, column = { l: pad, r: pad, t: pad, b: pad };
  for (const r of rects) {
    const mid = (r.left + r.right) / 2, top = (r.top + r.bottom) / 2 < h / 2;
    if (top) band.t = Math.max(band.t, r.bottom + pad); else band.b = Math.max(band.b, h - r.top + pad);
    if (mid < w * .36) column.l = Math.max(column.l, r.right + pad); else if (mid > w * .64) column.r = Math.max(column.r, w - r.left + pad);
    else if (top) column.t = Math.max(column.t, r.bottom + pad); else column.b = Math.max(column.b, h - r.top + pad);
  }
  const centred = { ...column, l: Math.max(column.l, column.r), r: Math.max(column.l, column.r) };
  stage.setSafe([band, centred, { ...column, weight: .85 }]);
  app.style.setProperty('--toast', `${band.b}px`);
}
addEventListener('resize', layout); addEventListener('orientationchange', () => setTimeout(layout, 300));
document.fonts?.ready.then(layout);
$('#flip').onclick = flip;
addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); flip(); } });
$('#retry').onclick = () => { if (!locked) enter(index, false); };
$('#clean').onclick = () => { if (!locked) { graves[index] = []; enter(index, false); toast('遗骸被清走了'); } };
$('#mute').onclick = () => { $('#mute').classList.toggle('off', audio.toggle()); };
$('#mute').classList.toggle('off', audio.muted);
$('#hint').onclick = () => {
  if (locked) return; const path = solve(st, [0, 1], 25000);
  if (!path) return toast('白兔：这一局已经走死了，重来吧。');
  if (path[0].face !== face) { toast('白兔：先翻面。'); $('#flip').classList.remove('nudge'); void $('#flip').offsetWidth; $('#flip').classList.add('nudge'); return; }
  hint = path[0].to; toast(`白兔：最快还要 ${path.length} 步。`); hud();
};
$('#begin').onclick = async () => { audio.start(); $('#title').classList.add('gone'); const n = new URLSearchParams(location.search).get('level') | 0; await enter(n >= 0 && n < LEVELS.length ? n : 0); };
st = parseLevel(LEVELS[0]); stage.load(st); hud();
if (import.meta.env.DEV) window.__game = { stage, get tapped() { return tapped; }, get st() { return st; }, get idle() { return !locked && !stage.busy; }, get face() { return face; }, enter, flip, move };
