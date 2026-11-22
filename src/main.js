import './style.css';
import { start, play, movesFor, chooseMove, formOf, isHeroine, other, FORMS, SIDES, HEROINES, HOURS, LAST_BELL, FIRST_ENDING, CENTER } from './game.js';
import { createScene } from './scene.js';
import * as sound from './sound.js';

const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const HUMAN = 'crimson';
const NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
const ENDINGS = {
  hood: '后来，森林里再没有狼。只剩一个披着红斗篷、吃得很饱的女孩。',
  cinder: '后来，午夜的钟再也没有响过。她折断了指针，舞会永不散场。',
  snow: '后来，没有王子来。她在玻璃里睁着眼，把苹果一口一口吃完。',
  rapunzel: '后来，高塔没有门，也不需要门。爬上来的人，都成了她的发饰。',
  gretel: '后来，糖果屋又亮起了灯。炉子很暖，她在等迷路的孩子。',
  briar: '后来，整个王国陪她一起睡着了。只有她，在所有人的梦里走来走去。',
};

let state = start();
let scene = null;
let selected = -1;
let busy = false;
let solo = true;
let soundOn = true;
let playing = false;

const art = (kind, night) => `./art/${kind}_${night ? 'night' : 'day'}.webp`;

// ── HUD ──
function drawDial() {
  const total = state.clock;
  let s = '<circle r="54" class="d-ring"/><circle r="47" class="d-face"/>';
  for (let i = 0; i < HOURS; i++) {
    const a = (i / HOURS) * Math.PI * 2, x = Math.sin(a) * 40, y = -Math.cos(a) * 40;
    s += `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${i === 0 ? 4.2 : 2.6}" class="d-pip${i > 0 && i <= total ? ' lit' : ''}${i === 0 ? ' twelve' : ''}"/>`;
  }
  s += `<g style="transform:rotate(${(total / HOURS) * 360}deg)" class="d-hand"><path d="M0 8 L3.2 -8 L0 -38 L-3.2 -8 Z"/></g><circle r="4" class="d-hub"/>`;
  $('dial').innerHTML = s;
}

function renderHud() {
  document.body.classList.toggle('night', state.night);
  drawDial();
  $('phase').textContent = state.night ? '子夜' : '白昼';
  const left = HOURS - state.clock;
  $('toll').innerHTML = state.winner ? '钟停了' : `再走 <b>${NUM[left]}</b> 格，钟响`;
  $('bells').innerHTML = Array.from({ length: LAST_BELL }, (_, i) => `<i class="${i < state.bells ? 'rung' : ''}${i + 1 < FIRST_ENDING ? ' prologue' : ''}"></i>`).join('')
    + `<em>${state.bells + 1 < FIRST_ENDING ? '序章：下一响只翻面' : state.bells + 1 >= LAST_BELL ? '最后一响：书页将燃尽' : `第${NUM[state.bells + 1]}响可写结局`}</em>`;
  const t = $('turn');
  if (state.winner) t.textContent = '终';
  else t.innerHTML = `<i class="${state.turn}"></i>${SIDES[state.turn]}${solo ? (state.turn === HUMAN ? ' · 轮到你' : ' · 书灵落子中') : ' · 落子'}`;
  t.dataset.side = state.turn;
}

function renderCard() {
  const card = $('card');
  const piece = selected >= 0 ? state.cells[selected] : null;
  if (!piece) {
    card.className = 'card empty';
    card.innerHTML = `<p class="hint"><b>点一位角色。</b>她每走一格，钟就走一个时辰；钟响时站在中央「终」格的女主角，写下结局。</p>`;
    return;
  }
  const now = formOf(piece, state.night), next = formOf(piece, !state.night);
  const hero = isHeroine(piece);
  card.className = `card ${piece.side}`;
  card.innerHTML = `
    ${hero ? `<img class="portrait" src="${art(piece.kind, state.night)}" alt="${now.name}">` : '<div class="portrait doll">偶</div>'}
    <div class="info">
      <span class="tag">${SIDES[piece.side]} · ${state.night ? '子夜' : '白昼'}</span>
      <h3>${now.name}</h3>
      <em>${now.epithet}</em>
      <p class="rule${now.sealed ? ' sealed' : ''}">${now.rule}</p>
      ${hero ? `<div class="after">${`<img src="${art(piece.kind, !state.night)}" alt="">`}<div><span>钟响之后 →</span><b>${next.name}</b><small>${next.rule}</small></div></div>` : ''}
    </div>`;
}

function refreshMarks() {
  const piece = selected >= 0 ? state.cells[selected] : null;
  scene.select(piece?.id);
  if (!piece || state.winner) return scene.mark([]);
  const mine = piece.side === state.turn && (!solo || state.turn === HUMAN) && !busy;
  scene.mark(movesFor(state, selected).map((m) => ({
    to: m.to, hours: m.hours,
    kind: !mine ? 'threat' : m.capture ? 'capture' : m.push !== undefined ? 'push' : 'move',
    bell: mine && state.clock + m.hours >= HOURS,
  })));
}

function select(cell) {
  selected = cell;
  renderCard();
  refreshMarks();
}

const log = (text) => { const el = $('log'); el.textContent = text; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); };

// ── 演出 ──
async function bellCutIn(ev) {
  const el = $('bell');
  el.querySelector('b').textContent = ev.night ? '子夜' : '黎明';
  el.querySelector('span').textContent = `第${NUM[ev.bells]}响 · ${ev.night ? '童话翻面' : '噩梦翻面'}`;
  el.className = ev.night ? 'go to-night' : 'go to-day';
  sound.setNight(ev.night); sound.bell();
  await wait(520);
  document.body.classList.toggle('night', ev.night);
  await scene.bell(ev.night);
  await wait(250);
  el.className = '';
}

async function perform(prev, next) {
  let total = prev.bells * HOURS + prev.clock;
  const night = prev.night;
  for (const ev of next.events) {
    if (ev.type === 'move') {
      const mover = next.cells[ev.to] || prev.cells[ev.from];
      const name = formOf(mover, night).name;
      const push = next.events.find((e) => e.type === 'push');
      const cap = next.events.find((e) => e.type === 'capture');
      total += ev.hours;
      sound.step(ev.hours);
      if (push) { setTimeout(() => { scene.push(push); sound.shove(); }, 200); }
      await scene.move(ev, total);
      if (cap) { scene.capture(cap); sound.tear(); log(`${name} 撕碎了 ${formOf(cap.piece, night).name}`); await wait(260); }
      else if (push) log(`${name} 撞开了 ${formOf(prev.cells[ev.to], night).name}`);
      else log(`${name} 走了${NUM[ev.hours]}格 · 钟走${NUM[ev.hours]}个时辰`);
    } else if (ev.type === 'bell') {
      await bellCutIn(ev);
    } else if (ev.type === 'pass') {
      total += 1;
      log(`${SIDES[ev.side]}无路可走，只能听钟走过一个时辰`);
      await scene.tick(total);
      await wait(500);
    }
  }
}

async function commit(move) {
  busy = true;
  select(-1);
  const prev = state;
  const next = play(prev, move);
  await perform(prev, next);
  state = next;
  scene.sync(state);
  renderHud();
  busy = false;
  if (state.winner) return showEnding();
  if (solo && state.turn !== HUMAN) {
    busy = true;
    await wait(420);
    const reply = chooseMove(state, 4);
    busy = false;
    if (reply && playing) return commit(reply);
  }
  renderCard();
}

function showEnding() {
  playing = false;
  const w = state.winner;
  const el = $('ending');
  let kind = state.author;
  if (!kind && w !== 'draw') kind = state.cells.find((p) => p && p.side === w && isHeroine(p))?.kind;
  const lost = solo && w !== HUMAN && w !== 'draw';
  $('end-art').src = kind ? art(kind, state.night) : art('snow', true);
  $('end-tag').textContent = w === 'draw' ? '无人执笔' : `${SIDES[w]} · ${lost ? '你输了' : solo ? '你赢了' : '获胜'}`;
  if (state.reason === 'ending') {
    $('end-title').textContent = `${formOf({ kind }, state.night).name}写下了结局`;
    $('end-line').textContent = ENDINGS[kind];
    scene.celebrate(CENTER);
  } else if (state.reason === 'erased') {
    $('end-title').textContent = '对面的书页被撕尽了';
    $('end-line').textContent = '再没有人记得那些故事曾经存在过。';
  } else {
    $('end-title').textContent = w === 'draw' ? '书页燃尽，没有结局' : '第六响，书页燃尽';
    $('end-line').textContent = w === 'draw' ? '故事停在半句话上。也许这才是最好的结局。' : '灰烬里，活下来的人多的那一方，被当作了结局。';
  }
  el.dataset.side = w;
  sound.fanfare();
  setTimeout(() => { el.hidden = false; }, 900);
}

function restart() {
  state = start();
  selected = -1; busy = false; playing = true;
  $('ending').hidden = true;
  sound.setNight(false);
  scene.setNightInstant(false);
  scene.sync(state);
  renderHud(); renderCard(); refreshMarks();
  log('第一页。绯之卷先行。');
}

function onPick(cell) {
  if (!playing || busy || cell < 0) { if (!busy && playing) select(-1); return; }
  const myTurn = !solo || state.turn === HUMAN;
  if (selected >= 0 && myTurn && state.cells[selected]?.side === state.turn) {
    const move = movesFor(state, selected).find((m) => m.to === cell);
    if (move) return commit(move);
  }
  select(state.cells[cell] && cell !== selected ? cell : -1);
}

function buildRoster() {
  $('roster').innerHTML = HEROINES.map((kind) => {
    const [d, n] = FORMS[kind];
    const side = ['hood', 'cinder', 'snow'].includes(kind) ? 'crimson' : 'gold';
    return `<article class="${side}">
      <figure class="day"><img loading="lazy" src="${art(kind, false)}" alt="${d.name}"><figcaption><span>白昼</span><b>${d.name}</b><small>${d.rule}</small></figcaption></figure>
      <figure class="night"><img loading="lazy" src="${art(kind, true)}" alt="${n.name}"><figcaption><span>子夜</span><b>${n.name}</b><small>${n.rule}</small></figcaption></figure>
      <em>${SIDES[side]}</em></article>`;
  }).join('');
}

async function boot() {
  buildRoster();
  renderHud(); renderCard();
  scene = await createScene($('gl'), { onPick });
  scene.sync(state);
  document.body.classList.add('ready');
  $('btn-start').onclick = () => {
    sound.unlock();
    $('title').classList.add('gone');
    playing = true;
    log('第一页。绯之卷先行。');
  };
  $('btn-rules').onclick = () => $('rules').showModal();
  $('rules').addEventListener('click', (e) => { if (e.target === $('rules')) $('rules').close(); });
  $('btn-restart').onclick = restart;
  $('btn-again').onclick = restart;
  $('btn-mode').onclick = () => { solo = !solo; $('btn-mode').textContent = solo ? '对手：书灵' : '对手：同屏'; restart(); };
  $('btn-sound').onclick = () => { soundOn = !soundOn; sound.setOn(soundOn); $('btn-sound').textContent = soundOn ? '声音：开' : '声音：关'; };
  if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) {
    window.__game = { get state() { return state; }, set state(v) { state = v; scene.setNightInstant(v.night); scene.sync(v); renderHud(); renderCard(); }, pick: onPick, showEnding, hint: () => chooseMove(state, 3), get busy() { return busy; } };
  }
}
boot();
