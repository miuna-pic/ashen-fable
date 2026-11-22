import '@fontsource/noto-serif-sc/chinese-simplified-500.css';
import '@fontsource/noto-serif-sc/chinese-simplified-900.css';
import '@fontsource/noto-serif-sc/latin-900.css';
import './style.css';
import './campaign.css';
import { createStage } from './stage.js';
import { audio } from './audio.js';
import { enemyAt, MAX_INK, W } from './rules.js';
import { compile, movesX, playX, solveX, shownAims, strike, bellIn, causeOf } from './modifiers.js';
import { LEVELS, CHAPTERS } from './levels.js';
import { STORY, AFTER, ENDING, PAGES, DEATH, COACH, NAMES, ART, GLYPH, RULES } from './story.js';

const app = document.querySelector('#app');
app.innerHTML = `
<canvas id="stage"></canvas>
<header class="hud top"><div class="chapter"><b id="no"></b><h2 id="name"></h2><i id="sub"></i></div>
  <div class="count"><i>ALICE No.</i><b id="count"></b><span>个爱丽丝</span></div></header>
<div id="chips"></div>
<div id="coach"><b></b><p></p></div>
<div id="toast"></div>
<footer class="hud bottom">
  <div class="ink"><span>墨</span><div id="ink"></div><small id="lead"></small></div>
  <button id="flip"><b>翻面</b><i>FLIP<span class="key"> · 空格</span></i></button>
  <div class="tools"><button id="atlas">棋谱</button><button id="hint">白兔</button><button id="retry">重来</button><button id="clean">清尸</button><button id="mute">声</button></div>
</footer>
<div id="banner"><b></b><i></i></div>
<div id="cutin"><img alt=""><b></b></div>
<div id="dialog"><img alt=""><em></em><div><b></b><p></p><i>轻触继续 ▶</i></div></div>
<section id="map"><header><h2>棋谱</h2><p id="tally"></p><button id="closemap">返回棋盘</button></header><div id="squares"></div></section>
<section id="title"><div class="art" style="background-image:url(./art/key.webp)"></div><div class="veil"></div>
  <h1><span>镜渊</span><span>爱丽丝</span></h1><p class="en">ALICE<br>IN THE<br>MIRROR ABYSS</p>
  <p class="tag">一枚棋子，两具身体。<br>她在玻璃上面走，她在玻璃下面走。</p>
  <button id="begin">坠 入</button><small>黑暗童话棋 · 八格战役</small></section>`;
const $ = (s) => document.querySelector(s);
const stage = createStage($('#stage'));
const save = { deaths: 0, done: {}, endings: {}, ...JSON.parse(localStorage.getItem('mirror-alice') || '{}') };
const persist = () => {
  // 别的标签页可能存过更新的进度：合并后再写。
  const old = JSON.parse(localStorage.getItem('mirror-alice') || '{}');
  for (const [k, v] of Object.entries(old.done || {})) save.done[k] = Math.min(v, save.done[k] ?? v);
  Object.assign(save.endings, old.endings); save.deaths = Math.max(save.deaths, old.deaths || 0);
  localStorage.setItem('mirror-alice', JSON.stringify(save));
};
let index = 0, face = 0, st = null, hint = null, locked = true, step = -1, moves = 0, playing = false;
const graves = LEVELS.map(() => []);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const P = (name) => name.charCodeAt(0) - 97 + (8 - +name[1]) * 6;
const open = (i) => i === 0 || LEVELS[i - 1].id in save.done || new URLSearchParams(location.search).has('all');
const noOf = (level) => { const ch = CHAPTERS[level.ch], mates = LEVELS.filter((l) => l.ch === level.ch); return `${ch.no} · ${mates.indexOf(level) + 1}/${mates.length}`; };

// 教学：当前这一步允许什么。step < 0 表示没有教学或已放手。
const coachStep = () => (step >= 0 ? COACH[LEVELS[index].id]?.[step] : null);
function allowed() {
  const all = movesX(st, face), c = coachStep();
  if (!c || c.free) return all;
  if (c.flip !== undefined) return [];
  const only = c.only.map(P); return all.filter((m) => only.includes(m.to));
}
function say(who, text) { const c = $('#coach'); if (!text) return c.classList.remove('show'); c.dataset.who = who; c.querySelector('b').textContent = NAMES[who]; c.querySelector('p').textContent = text; c.classList.remove('show'); void c.offsetWidth; c.classList.add('show'); }
function coach() {
  const c = coachStep(); $('#flip').classList.remove('nudge');
  if (!c) return;
  say(c.who, c.say);
  if (c.flip !== undefined) { void $('#flip').offsetWidth; $('#flip').classList.add('nudge'); }
  if (c.free) step = -1;
}

function hud() {
  const level = LEVELS[index], mod = level.mod || {};
  $('#no').textContent = noOf(level); $('#name').textContent = level.title; $('#sub').textContent = level.sub;
  $('#count').textContent = 1865 + save.deaths;
  $('#ink').innerHTML = Array.from({ length: MAX_INK }, (_, i) => `<i class="${i < st.ink ? 'on' : ''}"></i>`).join('');
  $('#lead').textContent = mod.solo ? '一步一格 · 走到敌人的格子上就是吃子' : face ? (st.ink ? '镜中的她领路 · 一滑到底，耗一滴墨' : '墨尽了。她动不了，翻回去') : '你领路 · 一步一格，吃子得墨';
  document.body.classList.toggle('mirror', !!face);
  $('#clean').style.display = graves[index].length ? '' : 'none';
  $('#flip').style.display = mod.solo ? 'none' : ''; $('#flip').classList.toggle('held', !!mod.wilful);
  $('#hint').classList.toggle('off', !!level.exam);
  const chips = [];
  if (mod.limit) chips.push(`<span class="${st.left <= 1 ? 'hot' : ''}"><i>口试</i>还剩 <b>${st.left}</b> 步</span>`);
  if (mod.bell) chips.push(`<span class="${bellIn(st) === 1 ? 'hot' : ''}"><i>子夜钟</i>再 <b>${bellIn(st)}</b> 步，棋子落到另一面</span>`);
  if (mod.wilful) chips.push(`<span><i>无名之林</i>下一步：<b>${st.lead ? '镜中的她' : '你'}</b></span>`);
  if (mod.dark !== undefined) chips.push(`<button id="match" ${st.matches && !st.lit ? '' : 'disabled'}><i>火柴</i>${st.lit ? `还亮 <b>${st.lit}</b> 步` : `划一根 · 剩 <b>${st.matches}</b>`}</button>`);
  $('#chips').innerHTML = chips.join('');
  document.body.classList.toggle('dark', mod.dark !== undefined && !st.lit);
  const can = allowed(), aims = shownAims(st), hot = new Set(aims.flatMap((a) => a.squares));
  audio.setDanger(can.length ? can.filter((m) => hot.has(m.to)).length / can.length : 0);
  stage.paint(st, face, can, aims, hint); layout();
}
function banner(big, small, ms = 1500) { const b = $('#banner'); b.querySelector('b').textContent = big; b.querySelector('i').textContent = small; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); return wait(ms); }
function toast(text) { const t = $('#toast'); t.textContent = text; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show'); }
function cutin(f) { const c = $('#cutin'); c.querySelector('img').src = `./art/${f ? 'alice_b' : 'alice_a'}.webp`; c.querySelector('b').textContent = f ? '镜 噬' : '吃 子'; c.classList.remove('show'); void c.offsetWidth; c.classList.add('show'); }
// 剧情里的 {n} 是这一个爱丽丝的编号，和左上角的计数一致。
const han = (n) => [...String(n)].map((c, i, a) => (c === '0' ? (a.slice(i).some((x) => x !== '0') && a[i - 1] !== '0' ? '零' : '') : '一二三四五六七八九'[c - 1] + ['', '十', '百', '千', '万'][a.length - 1 - i])).join('');
function talk(lines) {
  if (!lines?.length) return Promise.resolve();
  lines = lines.map(([w, t]) => [w, t.replace(/\{n\}/g, han(1865 + save.deaths))]);
  say();
  return new Promise((done) => {
    const d = $('#dialog'); let i = -1;
    const next = () => { if (++i >= lines.length) { d.classList.remove('show'); d.onclick = null; return done(); }
      const [who, text] = lines[i], img = d.querySelector('img'); d.dataset.who = who; d.classList.toggle('plain', !ART[who]);
      if (ART[who]) img.src = `./art/${ART[who]}.webp`; d.querySelector('em').textContent = GLYPH[who] || '';
      d.querySelector('b').textContent = NAMES[who]; d.querySelector('b').style.display = NAMES[who] ? '' : 'none'; d.querySelector('p').textContent = text; };
    d.classList.add('show'); d.onclick = next; next();
  });
}
async function enter(i, story = true) {
  locked = true; playing = true; index = i; hint = null; moves = 0; const level = LEVELS[i];
  if (face) { face = 0; audio.setMirror(0); await stage.flip(0); }
  st = compile(level, graves[i]); stage.load(st); audio.level({ id: level.id, boss: level.ch === 7 }, level.ch);
  if (story) { step = COACH[level.id] ? 0 : -1; say(); hud(); await banner(level.title, noOf(level) + ' · ' + level.sub, 1700); await talk(STORY[level.id]); }
  hud(); coach(); locked = false;
}
async function turn(to) {
  if (to === face) return; face = to; audio.setMirror(face); audio.sfx('flip');
  document.body.classList.toggle('mirror', !!face); stage.paint(st, face, [], shownAims(st), null);
  await stage.flip(face);
}
async function flip() {
  if (locked || stage.busy) return; const mod = LEVELS[index].mod || {}, c = coachStep();
  if (mod.solo) return;
  if (mod.wilful) return toast('这片林子里，轮到谁走不由你定。');
  if (c && !c.free && c.flip !== 1 - face) return toast('先照她说的做。');
  locked = true; hint = null; await turn(1 - face);
  if (c && c.flip === face) step++;
  locked = false; hud(); coach();
}
async function move(to) {
  if (!allowed().some((m) => m.to === to)) return;
  const st0 = st, r = playX(st, face, to), c = coachStep(); locked = true; hint = null; moves++;
  stage.paint(st, face, [], shownAims(st), null);
  await stage.animate(r.ev, { sfx: audio.sfx, cutin });
  st = r.st;
  const level = LEVELS[index];
  if (st.result === 'dead') {
    const cause = causeOf(st0, st, r.ev), late = cause?.kind === 'timeout';
    save.deaths++; persist(); if (!late && !level.exam && !graves[index].includes(to)) graves[index].push(to);
    await banner(late ? '不及格' : '斩 首', late ? '步数用完了' : `第 ${1864 + save.deaths} 个爱丽丝留在了这一格`, 1600);
    const taught = c?.die; if (step >= 0) step = taught ? step + 1 : COACH[level.id].length - 1;
    await enter(index, false);
    if (cause && !taught) say(late ? 'cat' : 'b', late ? DEATH.timeout[save.deaths % 2] : (cause.face !== face && cause.kind !== 'Q' ? DEATH.far : '') + DEATH[cause.kind][save.deaths % 2]);
    return;
  }
  if (st.result === 'win') return won();
  if (r.ev.some((e) => e.t === 'bell')) { audio.sfx('flip'); stage.load(st); await banner('铛', `第 ${st.rang} 响 · 棋子落到了玻璃的另一面`, 1100); }
  if (r.ev.some((e) => e.t === 'sulk')) toast('镜中的她没有墨，不肯动。这一步还是你走。');
  if (level.mod?.wilful) await turn(st.lead);
  if (c && !c.free) step++;
  locked = false; hud(); coach();
}
async function won() {
  const level = LEVELS[index], best = save.done[level.id]; say(); playing = false;
  save.done[level.id] = best ? Math.min(best, moves) : moves; persist();
  const last = LEVELS[index + 1]?.ch !== level.ch;
  if (index + 1 === LEVELS.length) {
    save.endings[st.ending] = true; persist();
    await banner(st.ending === 'exit' ? '破 镜' : '将 死', st.ending === 'exit' ? 'THROUGH THE LOOKING-GLASS' : 'CHECKMATE', 1800);
    await talk(ENDING[st.ending]); await talk([['n', PAGES[level.ch]]]);
    await banner(st.ending === 'exit' ? '完' : '升 变', st.ending === 'exit' ? `真结局 · 没有第 ${1866 + save.deaths} 个` : '结局一 · 女王万岁——再坠一次，试试不戴王冠', 2400);
    $('#begin').textContent = '再 坠 一 次'; return showMap();
  }
  await banner(level.exam ? '及 格' : '升 变', moves <= level.par ? `${moves} 步 · 最短走法` : `${moves} 步 · 最短 ${level.par} 步`, 1300);
  if (last) { await talk(AFTER[level.ch]); await banner('残页 ' + '一二三四五六七八'[level.ch], '收进了棋谱', 1100); await talk([['n', PAGES[level.ch]]]); }
  return enter(index + 1);
}

function showMap() {
  const got = Object.keys(save.done).length;
  $('#tally').textContent = `第 ${1865 + save.deaths} 个爱丽丝 · ${got}/${LEVELS.length} 局 · 结局 ${Object.keys(save.endings).length}/2`;
  $('#squares').innerHTML = CHAPTERS.map((ch, c) => {
    const boards = LEVELS.map((l, i) => [l, i]).filter(([l]) => l.ch === c), cleared = boards.every(([l]) => l.id in save.done);
    return `<article class="${open(boards[0][1]) ? '' : 'shut'}"><h3><i>${ch.no}</i>${ch.title}</h3><small>${ch.sub}</small><p class="rule">${ch.rule}</p><div>${boards.map(([l, i]) => {
      const best = save.done[l.id]; return `<button data-i="${i}" ${open(i) ? '' : 'disabled'} class="${best ? 'done' : ''} ${l.exam ? 'exam' : ''}"><b>${l.title}</b><i>${best ? (best <= l.par ? '★ ' : '') + best + ' 步' : open(i) ? (l.exam ? '口试' : '未走') : '锁'}</i></button>`; }).join('')}</div>${cleared ? `<blockquote>${PAGES[c]}</blockquote>` : ''}</article>`;
  }).join('');
  $('#closemap').style.display = playing ? '' : 'none';
  $('#title').classList.add('gone'); $('#map').classList.add('show');
}
$('#squares').addEventListener('click', (e) => { const b = e.target.closest('button[data-i]'); if (!b || b.disabled) return; $('#map').classList.remove('show'); enter(+b.dataset.i); });
$('#closemap').onclick = () => $('#map').classList.remove('show');
$('#atlas').onclick = () => { if (!locked) showMap(); };
$('#chips').addEventListener('click', (e) => { if (locked || !e.target.closest('#match')) return; if (strike(st)) { audio.sfx('kill'); toast('火柴亮了。两步之内，红格看得见。'); hud(); } });

// The square a pointer means. A figure under the finger wins when it can be taken (or nothing else can be done there);
// a touch that just misses a legal square snaps to it; anything else is the square on the glass.
function aim(e) {
  const moves = allowed(), legal = (s) => moves.some((m) => m.to === s);
  const ground = stage.pick(e.clientX, e.clientY), body = stage.pickPiece(e.clientX, e.clientY, face);
  if (body >= 0 && (legal(body) || !legal(ground))) return body;
  // a square the rules allow but the coach does not is meant as itself, never snapped onto the scripted one
  if (ground >= 0 && (legal(ground) || movesX(st, face).some((m) => m.to === ground) || ground === st.alice || st.corpses.includes(ground) || enemyAt(st, face, ground) || enemyAt(st, 1 - face, ground))) return ground;
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
  if (allowed().some((m) => m.to === s)) return move(s);
  if (coachStep() && movesX(st, face).some((m) => m.to === s)) return toast('先照她说的做。');
  const e1 = enemyAt(st, face, s), e2 = enemyAt(st, 1 - face, s);
  if (e1 || e2) toast((e1 ? '' : '〔玻璃另一面〕') + RULES[(e1 || e2).kind]);
  else if (st.corpses.includes(s)) toast('爱丽丝的遗骸 · 挡路，也挡斧线');
  else if (s !== st.alice) toast(face ? (st.ink ? '她只走直线和斜线，且不能穿过镜面的棋子' : '没有墨了') : '你一次只能走一格');
}
// Press shows which square the finger means, sliding re-aims, lifting commits; a second finger or a system gesture cancels.
const canvas = $('#stage'); let held = null;
const show = (e) => {
  const s = locked || stage.busy ? -1 : aim(e), m = s >= 0 && allowed().find((x) => x.to === s);
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
$('#retry').onclick = () => { if (!locked) { const keep = step; enter(index, false).then(() => { if (keep >= 0) { step = COACH[LEVELS[index].id].length - 1; coach(); } }); } };
$('#clean').onclick = () => { if (!locked) { graves[index] = []; const keep = step; enter(index, false).then(() => { if (keep >= 0) { step = COACH[LEVELS[index].id].length - 1; coach(); } }); toast('遗骸被清走了'); } };
$('#mute').onclick = () => { $('#mute').classList.toggle('off', audio.toggle()); };
$('#mute').classList.toggle('off', audio.muted);
$('#hint').onclick = async () => {
  if (locked) return;
  if (LEVELS[index].exam) return toast('柴郡猫：口试不许问兔子。');
  if (coachStep()) return toast('白兔：先听她把话说完。');
  toast('白兔在算……'); locked = true; await wait(40); const path = solveX(st); locked = false;
  if (!path) return toast(graves[index].length || !LEVELS[index].need ? '白兔：这一局已经走死了，重来吧。' : '白兔：活着是过不去的。……你明白我的意思。');
  if (path[0].face !== face) { toast('白兔：先翻面。'); $('#flip').classList.remove('nudge'); void $('#flip').offsetWidth; $('#flip').classList.add('nudge'); return; }
  hint = path[0].to; toast(`白兔：最快还要 ${path.length} 步。`); hud();
};
$('#begin').onclick = async () => {
  audio.start(); const q = new URLSearchParams(location.search), n = q.get('level');
  if (n !== null && LEVELS[n | 0]) { $('#title').classList.add('gone'); return enter(n | 0); }
  if (Object.keys(save.done).length) return showMap();
  $('#title').classList.add('gone'); await enter(0);
};
st = compile(LEVELS[0]); stage.load(st); hud();
if (import.meta.env.DEV) window.__game = { stage, get tapped() { return tapped; }, get st() { return st; }, get idle() { return !locked && !stage.busy; }, get face() { return face; }, get step() { return step; }, save, enter, flip, move, showMap };
