import '@fontsource/noto-serif-sc/chinese-simplified-500.css';
import '@fontsource/noto-serif-sc/chinese-simplified-900.css';
import '@fontsource/noto-serif-sc/latin-900.css';
import './style.css';
import { createStage } from './stage.js';
import { audio } from './audio.js';
import { parseLevel, movesFor, play, allAims, solve, enemyAt, MAX_INK } from './rules.js';
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
  <button id="flip"><b>翻面</b><i>FLIP · 空格</i></button>
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
  stage.paint(st, face, movesFor(st, face), allAims(st), hint);
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
  st = parseLevel(level, graves[i]); stage.load(st); hud();
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
$('#stage').addEventListener('pointerup', (e) => {
  if (locked || stage.busy) return; const s = stage.pick(e.clientX, e.clientY); if (s < 0) return;
  if (movesFor(st, face).some((m) => m.to === s)) return move(s);
  const e1 = enemyAt(st, face, s), e2 = enemyAt(st, 1 - face, s);
  if (e1 || e2) toast((e1 ? '' : '〔玻璃另一面〕') + RULES[(e1 || e2).kind]);
  else if (st.corpses.includes(s)) toast('爱丽丝的遗骸 · 挡路，也挡斧线');
  else if (s !== st.alice) toast(face ? (st.ink ? '她只走直线和斜线，且不能穿过镜面的棋子' : '没有墨了') : '你一次只能走一格');
});
$('#flip').onclick = flip;
addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); flip(); } });
$('#retry').onclick = () => { if (!locked) enter(index, false); };
$('#clean').onclick = () => { if (!locked) { graves[index] = []; enter(index, false); toast('遗骸被清走了'); } };
$('#mute').onclick = () => { $('#mute').classList.toggle('off', audio.toggle()); };
$('#hint').onclick = () => {
  if (locked) return; const path = solve(st, [0, 1], 25000);
  if (!path) return toast('白兔：这一局已经走死了，重来吧。');
  if (path[0].face !== face) { toast('白兔：先翻面。'); $('#flip').classList.remove('nudge'); void $('#flip').offsetWidth; $('#flip').classList.add('nudge'); return; }
  hint = path[0].to; toast(`白兔：最快还要 ${path.length} 步。`); hud();
};
$('#begin').onclick = async () => { audio.start(); $('#title').classList.add('gone'); await enter(new URLSearchParams(location.search).get('level') | 0); };
st = parseLevel(LEVELS[0]); stage.load(st); hud();
if (import.meta.env.DEV) window.__game = { get st() { return st; }, get idle() { return !locked && !stage.busy; }, get face() { return face; }, enter, flip, move };
