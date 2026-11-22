// 对白演出：章节背景、左右两位立绘、表情、旁白与残页插画、对白记录、自动与跳过。
import './scene.css';
import { NAMES } from './story.js';
import { SPRITES, BODY, sprite } from './cast.js';

const MIRROR = new Set(['b', 'shadow', 'hollow']);   // 玻璃下面的人：她们说话时，背景裂出镜渊
const JOLT = new Set(['shock', 'rage', 'alarm', 'fear', 'crack']);
const CPS = 26;                      // 每个字的毫秒数

const loaded = new Map();
const load = (src) => { if (!loaded.has(src)) loaded.set(src, new Promise((ok) => { const i = new Image(); i.onload = i.onerror = () => ok(); i.src = src; })); return loaded.get(src); };
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export function createScene(d) {
  d.innerHTML = `<div class="bg"><i class="day"></i><i class="abyss"></i><i class="crack"></i></div>
<div class="petals">${'<s></s>'.repeat(14)}</div>
<figure class="plate"><img alt=""></figure>
<div class="cast"><img class="l" alt=""><img class="r" alt=""></div>
<header><b></b><i></i></header>
<nav><button data-do="log">记录</button><button data-do="auto">自动</button><button data-do="skip">跳过</button></nav>
<div class="box"><b></b><p></p><i>▶</i></div>
<aside class="log"><header><h3>对白记录</h3><button data-do="close">返回</button></header><ol></ol></aside>`;
  d.querySelector('.abyss').style.backgroundImage = 'url(./art/bg/m.webp)';
  const $ = (q) => d.querySelector(q), slot = { l: $('.cast .l'), r: $('.cast .r') }, on = { l: null, r: null }, history = [];
  let run = null, auto = false;

  function put(side, who, mood) {
    const img = slot[side], src = sprite(who, mood), body = BODY[who] || who;
    if (on[side] !== body) { on[side] = body; img.dataset.who = body; img.src = src; img.classList.remove('in', 'jolt'); void img.offsetWidth; img.classList.add('in'); }
    else if (!img.src.endsWith(src.slice(1))) { load(src).then(() => { if (on[side] === body) img.src = src; }); }
    if (JOLT.has(mood)) { img.classList.remove('jolt'); void img.offsetWidth; img.classList.add('jolt'); }
  }
  function show(line) {
    const [who, text, mood] = line, body = BODY[who] || who, p = $('.box p');
    d.dataset.who = who;
    d.classList.toggle('tale', !SPRITES[body]);
    if (SPRITES[body]) {
      const side = body === 'a' ? 'l' : 'r';
      put(side, who, mood);
      slot.l.classList.toggle('on', side === 'l'); slot.r.classList.toggle('on', side === 'r');
      d.classList.toggle('split', MIRROR.has(on.r));
    }
    $('.box b').textContent = NAMES[who] || '';
    p.innerHTML = [...text].map((c, i) => `<span style="animation-delay:${i * CPS}ms">${esc(c)}</span>`).join('');
    p.classList.remove('all');
    history.push([NAMES[who] || '', text]); if (history.length > 300) history.shift();
    run.typed = performance.now() + text.length * CPS;
    clearTimeout(run.timer);
    if (auto) run.timer = setTimeout(next, text.length * (CPS + 70) + 1300);
  }
  function next() {
    if (!run) return;
    if (performance.now() < run.typed) { run.typed = 0; $('.box p').classList.add('all'); return; }
    if (++run.i >= run.lines.length) return end();
    show(run.lines[run.i]);
  }
  function end() {
    if (!run) return; const done = run.done; clearTimeout(run.timer); run = null;
    d.classList.add('out');
    setTimeout(() => { d.classList.remove('show', 'out', 'logging', 'split', 'tale', 'page'); on.l = on.r = null; slot.l.removeAttribute('src'); slot.r.removeAttribute('src'); slot.l.className = 'l'; slot.r.className = 'r'; done(); }, 420);
  }
  function openLog(open) {
    d.classList.toggle('logging', open);
    if (open) { const ol = $('.log ol'); ol.innerHTML = history.map(([n, t]) => `<li><b>${esc(n)}</b><p>${esc(t)}</p></li>`).join(''); ol.scrollTop = ol.scrollHeight; }
  }
  function setAuto(v) { auto = v; $('[data-do=auto]').classList.toggle('active', v); clearTimeout(run?.timer); if (v && run) run.timer = setTimeout(next, Math.max(600, run.typed - performance.now() + 1300)); }

  d.addEventListener('click', (e) => {
    const act = e.target.closest('[data-do]')?.dataset.do;
    if (act === 'log') return openLog(true);
    if (act === 'close') return openLog(false);
    if (act === 'auto') return setAuto(!auto);
    if (act === 'skip') return end();
    if (d.classList.contains('logging')) { if (!e.target.closest('.log')) openLog(false); return; }
    if (auto) setAuto(false);
    next();
  });
  addEventListener('keydown', (e) => {
    if (!run) return;
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); if (d.classList.contains('logging')) openLog(false); else next(); }
    else if (e.code === 'Escape') { e.preventDefault(); if (d.classList.contains('logging')) openLog(false); else end(); }
  }, true);

  // lines: [说话人, 台词, 表情?]。opts: ch 章节序号（选背景），title/sub 左上角的场景名，page 残页序号（整页插画）。
  async function play(lines, { ch = 0, title = '', sub = '', page = null } = {}) {
    if (!lines?.length) return;
    const first = lines.find(([w]) => SPRITES[BODY[w] || w]), cast = new Set(lines.map(([w]) => BODY[w] || w).filter((w) => SPRITES[w]));
    const hero = page == null && cast.size > 0;      // 有人说话的场景里，爱丽丝始终站在左边
    const need = [`./art/bg/${ch}.webp`];
    if (page != null) need.push(`./art/page/${page}.webp`);
    if (hero) need.push(sprite('a', lines.find(([w]) => w === 'a')?.[2]));
    if (first) need.push(sprite(first[0], first[2]));
    await Promise.race([Promise.all(need.map(load)), new Promise((ok) => setTimeout(ok, 2500))]);
    load('./art/bg/m.webp'); for (const [w, , m] of lines) { const s = sprite(w, m); if (s) load(s); }
    $('.bg .day').style.backgroundImage = `url(./art/bg/${ch}.webp)`;
    $('header b').textContent = title; $('header i').textContent = sub;
    d.classList.toggle('page', page != null);
    if (page != null) $('.plate img').src = `./art/page/${page}.webp`;
    d.classList.remove('out'); d.classList.add('show');
    if (hero) { put('l', 'a', lines.find(([w]) => w === 'a')?.[2]); }
    return new Promise((done) => { run = { lines, i: -1, done, typed: 0, timer: 0 }; next(); });
  }
  return { play, get active() { return !!run; } };
}
