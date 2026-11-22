import './style.css';
import * as R from './rules.js';
import { createScene } from './scene.js';
import { sound } from './sound.js';

const $ = (q) => document.querySelector(q);
const view = createScene($('#stage'));

const CAST = {
  match: { name: '卖火柴的小女孩', short: '火柴女孩', price: '火柴烧完，夜就结束', tone: 'fire',
    hint: '走一步，或原地<b>划火柴</b>：照亮周围两格，持续三回合。光里敌人会受伤，镜片进不来。' },
  mermaid: { name: '小人鱼', short: '小人鱼', price: '每一步都踩在刀尖上', tone: 'sea',
    hint: '直线走任意格。暗处每格耗 1 声（冰面 2），<b>光里不疼</b>。声尽化为泡沫，留下一圈永不熄灭的光。' },
  karen: { name: '红舞鞋的凯伦', short: '红舞鞋', price: '停不下来', tone: 'red',
    hint: '给她一个方向，她立刻跳两格——之后<b>每回合自己接着跳</b>，撞墙反弹，冰上滑行。只踏碎光中的敌人；镜片抓不住她。' },
};
const IDLE = '点选一位女孩。每回合只能动一人——而红舞鞋每回合都会自己跳（红点是她的下一步）。';

let state = R.start();
let history = [];
let selected = null;
let busy = false;
let hoverDir = null;
let seenRules = false;

// —— HUD ——
const cards = $('#cards');
for (const id of Object.keys(CAST)) {
  const el = document.createElement('button');
  el.className = `card ${CAST[id].tone}`; el.dataset.id = id;
  el.innerHTML = `<i style="background-image:url(./art/${id}.webp)"></i><div><h4><span class="full">${CAST[id].name}</span><span class="short">${CAST[id].short}</span></h4><em>${CAST[id].price}</em><span class="gauge"></span></div>`;
  el.addEventListener('click', () => select(selected === id ? null : id));
  cards.append(el);
}
$('#sticks').innerHTML = '<i></i>'.repeat(R.MATCHES);
$('#hearts').innerHTML = '<i></i>'.repeat(R.QUEEN_HP);

function gauge(id) {
  if (!R.piece(state, id)) return id === 'mermaid' ? '已化为泡沫' : '已被镜子带走';
  if (id === 'match') return `火柴 ${state.matches} / ${R.MATCHES}`;
  if (id === 'mermaid') return `声 ${state.voice} / ${R.VOICE}`;
  const [dx, dy] = state.karenDir;
  return `舞向 ${'↖↑↗←·→↙↓↘'[(dy + 1) * 3 + dx + 1]} · 每回合两格`;
}

function refresh() {
  $('#turn').textContent = `第 ${state.turn} 回合`;
  $('#match-count').textContent = state.matches;
  [...$('#sticks').children].forEach((el, k) => el.classList.toggle('burnt', k >= state.matches));
  [...$('#hearts').children].forEach((el, k) => el.classList.toggle('broken', k >= state.queenHp));
  for (const el of cards.children) {
    const id = el.dataset.id, alive = !!R.piece(state, id);
    el.classList.toggle('on', selected === id); el.classList.toggle('gone', !alive); el.disabled = !alive;
    el.querySelector('.gauge').textContent = gauge(id);
  }
  $('#hint').innerHTML = selected ? CAST[selected].hint : IDLE;
  $('#btn-strike').hidden = !(selected === 'match' && state.matches > 0) || busy;
  $('#btn-undo').disabled = !history.length || busy;
  const acts = selected && !busy ? R.actionsFor(state, selected) : [];
  let path = [];
  if (!busy && !state.result) {
    const dir = selected === 'karen' ? hoverDir : state.karenDir;
    if (dir) path = R.dancePath(state, dir)?.path ?? [];
  }
  view.setMarks({
    actions: acts,
    selected: selected && !busy ? R.piece(state, selected)?.at : null,
    threat: busy || state.result ? [] : R.threats(state),
    frost: busy || state.result ? [] : R.frostNext(state),
    path,
  });
}

function select(id) {
  if (busy || state.result) return;
  if (id && !R.piece(state, id)) return;
  selected = id; hoverDir = null;
  if (id) sound.select();
  refresh();
}

// —— 演出 ——
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function float(tile, text, tone = 'fire') {
  const { x, y } = view.project(tile);
  const el = document.createElement('span');
  el.className = `float ${tone}`; el.textContent = text; el.style.left = x + 'px'; el.style.top = y + 'px';
  $('#floats').append(el); setTimeout(() => el.remove(), 1500);
}
async function cutin(who, kicker, title, sub, hold = 1050) {
  const el = $('#cutin');
  el.className = who; el.querySelector('.face').style.backgroundImage = `url(./art/${who}.webp)`;
  el.querySelector('small').textContent = kicker; el.querySelector('strong').textContent = title; el.querySelector('em').textContent = sub;
  el.hidden = false; void el.offsetWidth; el.classList.add('show');
  await sleep(hold);
  el.classList.remove('show'); await sleep(220); el.hidden = true;
}

const VISION_LINE = { 暖炉: '铁炉里的火烧得那么旺。', 烤鹅: '烤鹅背上插着刀叉，向她走来。', 圣诞树: '一千支蜡烛，升成了星星。', 祖母: '「奶奶，带我走吧。」' };

async function perform(events, before) {
  const board = { ice: before.ice.slice(), lights: before.lights.map((l) => ({ ...l })), pieces: [] };
  const paint = () => view.setBoard(board);
  for (const e of events) {
    if (e.t === 'move') {
      if (e.id === 'mermaid') { sound.swim(); if (e.cost) float(e.from, `−${e.cost} 声`, 'sea'); await view.moveUnit(e.id, [e.to], { ms: 340, hop: 0.12 }); }
      else { sound.step(); await view.moveUnit(e.id, [e.to]); }
    } else if (e.t === 'strike') {
      sound.strike();
      board.lights.push({ at: e.at, r: e.r, ttl: 3 }); paint();
      view.burst(e.at, '#ffb347', 60, 1.1);
      await cutin('match', `第 ${R.MATCHES - e.left} 根火柴 · 幻象`, `「${e.vision}」`, VISION_LINE[e.vision], e.vision === '祖母' ? 1700 : 1000);
    } else if (e.t === 'melt') {
      for (const i of e.tiles) { board.ice[i] = false; view.burst(i, '#bfeeff', 8, 0.5); }
      paint(); await view.wait(160);
    } else if (e.t === 'dance') {
      if (e.path.length) { sound.dance(); await view.moveUnit('karen', e.path, { ms: 170, hop: 0.22, spin: true }); }
      if (e.end === 'mirror') { sound.clink(); float(e.path.at(-1) ?? e.from, '暗处踏不碎', 'ice'); await view.wait(200); }
    } else if (e.t === 'bump') {
      sound.hurt(); view.kick(0.2);
      float(e.at, e.id === 'match' ? '−1 火柴' : '−2 声', 'red'); await view.nudge(e.id, e.at);
    } else if (e.t === 'shatter') {
      sound.shatter(); view.kick(0.25); float(e.at, '碎', 'fire'); await view.removeUnit(e.id);
    } else if (e.t === 'queenHit') {
      sound.queen(); view.kick(0.7); view.burst(e.from, '#ffffff', 120, 1.8); view.burst(e.from, '#ff3050', 60, 1.4);
      await cutin(e.by, e.hp ? `雪后之心 · 余 ${e.hp}` : '雪后之心 · 尽碎', e.hp ? '碎心' : '镜厅崩塌', e.hp ? '她换了一个王座。冰走得更快了。' : '天要亮了。', 1300);
      if (e.hp) {
        await view.removeUnit('queen', '#dff4ff');
        for (const i of e.burst) board.ice[i] = true; paint();
        await view.spawnUnit({ id: 'queen', kind: 'queen', at: e.to });
      } else {
        for (const p of before.pieces.concat(state.pieces)) if (p.kind === 'shard') view.removeUnit(p.id);
        await view.removeUnit('queen', '#ffffff');
      }
    } else if (e.t === 'foam') {
      sound.foam(); view.burst(e.at, '#8fffe0', 120, 1.5);
      await view.removeUnit('mermaid', '#d8fff5');
      board.lights.push({ at: e.at, foam: true }); paint();
      await cutin('mermaid', '声音已尽', '化为泡沫', '她没有变成风的女儿。她变成了光。', 1500);
    } else if (e.t === 'shardMove') {
      sound.shard(); await view.moveUnit(e.id, [e.to], { ms: 330, hop: 0.9 });
      if (e.kills) { sound.hurt(); view.kick(0.5); float(e.to, '被镜子带走', 'ice'); await view.removeUnit(e.kills, '#ff3050'); }
    } else if (e.t === 'spawn') {
      sound.freeze(); await view.spawnUnit({ id: e.id, kind: 'shard', at: e.at });
    } else if (e.t === 'freeze') {
      sound.freeze(); for (const i of e.tiles) board.ice[i] = true; paint(); await view.wait(220);
    } else if (e.t === 'lightOut') {
      sound.out();
      for (const at of e.tiles) { const k = board.lights.findIndex((l) => !l.foam && l.at === at); if (k >= 0) board.lights.splice(k, 1); float(at, '熄灭', 'ice'); }
      paint(); await view.wait(200);
    }
  }
}

async function act(action) {
  if (busy) return;
  const before = state;
  const { state: next, events } = R.play(state, action);
  if (!events.length) return;
  history.push(before); busy = true; selected = null; hoverDir = null;
  state = next; refresh();
  await perform(events, before);
  view.sync(state); busy = false; refresh();
  if (state.result) finish();
}

const ENDS = {
  queen: ['EPILOGUE', '天亮了', '镜厅碎成一场雪。新年的太阳升起来，照在还站着的人身上。'],
  girl: ['BAD END', '她被镜子带走了', '没有火光的地方，镜片落在她身上。雪后的镜厅里，又多了一面小小的镜子。'],
  night: ['BAD END', '最后一根火柴熄灭了', '新年的清晨，人们在墙角找到她。她嘴角带着微笑。谁也不知道，她曾经看见过多么美丽的东西。'],
  frozen: ['BAD END', '长夜封冻', '再没有人能迈出一步。'],
};
async function finish() {
  const win = state.result.winner === 'ember';
  await sleep(500); win ? sound.win() : sound.lose();
  const [kicker, title, text] = ENDS[state.result.reason];
  $('#result').className = win ? 'win' : 'lose';
  $('#result-kicker').textContent = kicker; $('#result-title').textContent = title; $('#result-text').textContent = text;
  const alive = Object.keys(CAST).filter((id) => R.piece(state, id)).map((id) => CAST[id].short);
  $('#result-stats').textContent = `${state.turn} 回合 · 用去 ${R.MATCHES - state.matches} 根火柴 · 留下的人：${alive.join('、') || '无'}`;
  $('#result').hidden = false;
}

function restart() {
  state = R.start(); history = []; selected = null; busy = false;
  $('#result').hidden = true; view.sync(state); refresh();
}

// —— 输入 ——
const stage = $('#stage');
let down = null;
stage.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
stage.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 14 || busy || state.result) return;
  const hit = view.pick(e.clientX, e.clientY);
  // 点到立牌的身体（不透明处）就是点她站的格子，而不是射线落在她身后的那格
  const body = hit.unit ? R.piece(state, hit.unit) : null;
  const tile = body ? body.at : hit.tile;
  if (selected && tile != null && body?.id !== selected) {
    const a = R.actionsFor(state, selected).find((x) => x.to === tile);
    if (a) return act(a);
  }
  const onTile = tile != null ? R.pieceAt(state, tile) : null;
  const id = onTile && R.isHeroine(onTile) ? onTile.id : null;
  select(id && id !== selected ? id : null);
});
stage.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse' || busy) return;
  const { tile } = view.pick(e.clientX, e.clientY);
  const a = selected && tile != null ? R.actionsFor(state, selected).find((x) => x.to === tile) : null;
  stage.style.cursor = a ? 'pointer' : '';
  const dir = a?.type === 'dance' ? a.dir : null;
  if (String(dir) !== String(hoverDir)) { hoverDir = dir; refresh(); }
});
$('#btn-strike').addEventListener('click', () => act({ id: 'match', type: 'strike', to: R.piece(state, 'match').at }));
$('#btn-undo').addEventListener('click', () => { if (busy || !history.length) return; state = history.pop(); selected = null; $('#result').hidden = true; view.sync(state); refresh(); });
$('#btn-restart').addEventListener('click', () => { if (!busy) restart(); });
$('#btn-again').addEventListener('click', restart);
$('#btn-rules').addEventListener('click', () => { $('#rules').hidden = false; });
$('#btn-close').addEventListener('click', () => { $('#rules').hidden = true; });
$('#rules').addEventListener('click', (e) => { if (e.target.id === 'rules') $('#rules').hidden = true; });
$('#btn-sound').addEventListener('click', (e) => e.currentTarget.classList.toggle('off', sound.toggle()));
$('#btn-start').addEventListener('click', () => {
  sound.start(); sound.strike();
  $('#title').classList.add('leave'); $('#hud').hidden = false;
  setTimeout(() => { $('#title').hidden = true; if (!seenRules) { seenRules = true; $('#rules').hidden = false; } }, 900);
});
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { $('#rules').hidden = true; select(null); }
  if (e.key === '1') select('match'); if (e.key === '2') select('mermaid'); if (e.key === '3') select('karen');
});

view.sync(state); refresh();
if (new URLSearchParams(location.search).has('play')) { $('#title').hidden = true; $('#hud').hidden = false; }
window.__ember = { get state() { return state; }, act, R, view };
