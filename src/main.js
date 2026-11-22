import './style.css';
import { at, chooseMove, col, coord, echoFor, movesFor, play, row, SIDES, SIZE, start, THRONE, TYPES } from './game.js';
import { createScene } from './scene.js';
import { chime } from './sound.js';
import { forest, halo } from './art.js';

const mark = `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 2v28M2 16h28M16 5 27 16 16 27 5 16Z" stroke="currentColor"/><path d="M16 9 21 16 16 23 11 16Z" fill="currentColor"/><circle cx="16" cy="16" r="13.5" stroke="currentColor" stroke-dasharray="1 4"/></svg>`;
const icons = {
  book: '<path d="M3 4h6a3 3 0 0 1 3 3v13a4 4 0 0 0-3-2H3zm18 0h-6a3 3 0 0 0-3 3v13a4 4 0 0 1 3-2h6z"/>',
  sound: '<path d="M4 9h4l5-5v16l-5-5H4zm12 0c2 1 2 5 0 6m2-9c4 3 4 9 0 12"/>',
  muted: '<path d="M4 9h4l5-5v16l-5-5H4zm12 1 5 5m0-5-5 5"/>',
  replay: '<path d="M4 13a8 8 0 1 1 2.4 5.6M4 13V6m0 7h7"/>',
  arrow: '<path d="M4 12h15m-5-5 5 5-5 5"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
};
const icon = (key) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">${icons[key]}</svg>`;
const figure = (kind) => `<svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.15" aria-hidden="true">${{
  crown:'<path d="m5 8 5 5 4-8 4 8 5-5-2 13H7zM8 18h12m-6-4v3"/>',
  wolf:'<path d="m5 5 6 4h6l6-4-1 10-8 8-8-8zm5 9 2 2m6-2-2 2m-4 3h4"/>',
  nun:'<path d="M14 4C8 9 7 15 5 23h18C21 15 20 9 14 4Zm-4 9h8m-6 3 2 3 2-3"/>',
}[kind]}</svg>`;

document.querySelector('#app').innerHTML = `
  <div class="page">
    <header class="masthead">
      <a class="brand" href="./" aria-label="灰烬寓言首页">${mark}<span>ASHEN <b>FABLE</b></span></a>
      <div class="mast-serial"><i></i> THE CINDER CHRONICLES <span>/</span> I <i></i></div>
      <div class="mast-actions">
        <button id="sound" class="icon-button" type="button" aria-label="开启声音" aria-pressed="false">${icon('muted')}</button>
        <button id="guide" class="guide-button" type="button">${icon('book')}<span>棋谱</span></button>
      </div>
    </header>

    <main class="sanctum">
      <div class="gloom" aria-hidden="true">${forest()}</div>
      <section class="prologue" aria-labelledby="title">
        <div class="chapter micro"><span></span> 序章 <i>/</i> PROLOGUE</div>
        <h1 id="title"><span>灰烬</span><span>寓言<span class="title-point">。</span></span></h1>
        <p class="subtitle">ASHEN FABLE</p>
        <div class="ornament" aria-hidden="true"><i></i><b>✦</b><i></i></div>
        <p class="lore">林中没有死去的路。<br>你走过的每一步，<br>都会回头咬你。</p>
        <div class="edition micro"><b>01</b><span>王座无人<br>THE HOLLOW THRONE</span></div>
      </section>

      <section class="arena" aria-labelledby="arena-title">
        <div class="arena-banner"><span aria-hidden="true">✧</span><h2 id="arena-title">无主祭坛<span>THE HOLLOW THRONE</span></h2><span aria-hidden="true">✧</span></div>
        <div class="stage" id="stage">
          <div class="halo" aria-hidden="true">${halo()}</div>
          <div id="renderer" aria-hidden="true"></div>
          <div id="board" class="board" role="group" aria-label="五乘五棋盘。方向键切换格子，回车选棋，Esc 取消。"></div>
          <span class="webgl-note" id="webgl-note" hidden>平面棋盘 · 此设备未启用 3D</span>
        </div>
        <div class="arena-footer">
          <div class="board-legend"><span><i></i>可落点</span><span><i></i>待落回声</span><span><i></i>预览回声</span></div>
          <p id="echo-caption">夺王，或守住中央王座一手。</p>
        </div>
      </section>

      <aside class="codex" aria-label="对弈状态">
        <section class="ledger">
          <div class="ledger-kicker micro"><i></i> TABLE OF WITNESSES <i></i></div>
          <div class="ledger-heading"><h2>对弈</h2><span id="turn-number">01 <i>/</i> 40</span></div>
          <div class="side-row" id="side-ash"><span class="side-glyph ash" aria-hidden="true">✷</span><div><strong>烛廷</strong><small>THE CANDLE COURT</small></div><span class="side-count" id="count-ash"></span></div>
          <div class="side-row" id="side-thorn"><span class="side-glyph thorn" aria-hidden="true">✧</span><div><strong>荆廷</strong><small>THE THORN COURT</small></div><span class="side-count" id="count-thorn"></span></div>
          <div class="instruction" aria-live="polite" aria-atomic="true"><div id="turn-state"></div><p id="tip"></p></div>
          <button id="confirm" class="confirm-button" type="button" hidden>落子 ${icon('arrow')}</button>
        </section>
        <section class="vow" aria-labelledby="vow-title">
          <span class="vow-mark" aria-hidden="true">✥</span>
          <div><div class="micro">THE ECHO LAW</div><h2 id="vow-title">离格即留咒</h2><p>你离开的格子，和身后的路，会在对手走完后崩塌。双方棋子皆会被吞没。</p></div>
        </section>
        <div class="game-actions">
          <button id="mode" type="button" aria-label="切换对弈模式"><span aria-hidden="true">◈</span><span id="mode-text">人偶对弈</span></button>
          <button id="reset" type="button">${icon('replay')}重开</button>
        </div>
      </aside>
    </main>

    <footer class="footnote"><span>✦ &nbsp; ASHEN FABLE</span><span>先问棋子。勿问神。</span><span>VOL. I <i>/</i> 森林遗本</span></footer>
  </div>
  <dialog id="rules" aria-labelledby="rules-title">
    <div class="dialog-inner">
      <button id="close-rules" type="button" class="icon-button close-button" aria-label="关闭棋谱">${icon('close')}</button>
      <div class="micro">THE CINDER CHRONICLES / I</div>
      <h2 id="rules-title">祭坛棋谱</h2><p class="rules-lead">先夺无名王，或守住中央王座。</p>
      <dl class="rule-pieces">
        ${Object.entries(TYPES).map(([key,{name,rule}]) => `<div>${figure(key)}<dt>${name}</dt><dd>${rule}</dd></div>`).join('')}
      </dl>
      <ol class="rule-list">
        <li><strong>落子。</strong>选己方棋子，选落点，再确认。不能越过其它棋子，落在敌棋格会吃掉它；吃王立即取胜。</li>
        <li><strong>留咒。</strong>落子会在出发格留下回声。它也会波及相邻的上下左右格，但避开你前进的方向。所选落点会显示回声范围。</li>
        <li><strong>应咒。</strong>对手先走一手，再结算回声；红格里的所有棋子不分敌我都会被移除。双王同亡为和。</li>
        <li><strong>守中。</strong>让任意己方棋子占住中央，并在对手走完且回声结算后仍在那里，即获胜。四十手未分胜负，或同一局面出现三次，皆为和局。</li>
      </ol>
      <p class="keyboard-hint">键盘：方向键选格，回车操作，Esc 取消。</p>
      <form method="dialog"><button class="confirm-button" type="submit">回到祭坛 ${icon('arrow')}</button></form>
    </div>
  </dialog>
  <dialog id="restart" aria-labelledby="restart-title">
    <div class="dialog-inner small-dialog">
      <div class="micro">ASHEN FABLE</div>
      <h2 id="restart-title">另起一局？</h2>
      <p class="rules-lead">当前进度不会保留。</p>
      <form method="dialog" class="dialog-actions"><button class="guide-button" value="cancel" autofocus>继续此局</button><button class="confirm-button" value="confirm">确认 ${icon('arrow')}</button></form>
    </div>
  </dialog>
`;

const get = (id) => document.getElementById(id);
const board = get('board'), stage = get('stage');
const rules = get('rules'), restart = get('restart');
const cells = [];
let state = start(), selected = null, preview = null, hover = null, focus = 22;
let mode = 'solo', muted = true, aiTimer = null, resetIntent = 'reset';
let scene;
const isAI = () => mode === 'solo' && state.side === 'thorn' && !state.result;

for (let index = 0; index < SIZE * SIZE; index++) {
  const cell = document.createElement('button');
  cell.type = 'button';
  cell.className = 'cell';
  cell.dataset.square = coord(index);
  cell.innerHTML = '<span class="fallback-piece"></span><span class="cell-marker" aria-hidden="true"></span>';
  cell.addEventListener('click', () => select(index));
  cell.addEventListener('focus', () => { focus = index; updateTabIndex(); });
  cell.addEventListener('pointerenter', (event) => { if (event.pointerType === 'mouse') aim(index); });
  cell.addEventListener('pointerleave', () => { if (hover === index) aim(null); });
  cells.push(cell);
  board.append(cell);
}

function useFlatBoard() {
  stage.classList.add('flat');
  get('webgl-note').hidden = false;
  for (const cell of cells) cell.removeAttribute('style');
}

try {
  scene = createScene(get('renderer'), (points) => {
    if (stage.classList.contains('flat')) return;
    points.forEach(({x, y, w, h}, index) => {
      const style = cells[index].style;
      style.left = x + 'px';
      style.top = y + 'px';
      style.width = w + 'px';
      style.height = h + 'px';
    });
  }, useFlatBoard);
} catch {
  useFlatBoard();
}
update();

function aim(index) {
  const next = index !== null && movesFor(state, at(state, selected)).includes(index) && preview === null ? index : null;
  if (next === hover) return;
  hover = next;
  paint();
}

function updateTabIndex() {
  cells.forEach((cell,index) => { cell.tabIndex = index === focus ? 0 : -1; });
}

function paint() {
  const destinations = movesFor(state, at(state, selected));
  const target = preview ?? hover;
  const forecast = target !== null ? echoFor(selected, target, state.side) : null;
  const pending = !state.result ? state.echo : null;
  cells.forEach((cell, index) => {
    const piece = at(state,index);
    cell.classList.toggle('legal', destinations.includes(index));
    cell.classList.toggle('cursed', pending?.tiles.includes(index) ?? false);
    cell.classList.toggle('forecast', forecast?.tiles.includes(index) ?? false);
    cell.classList.toggle('selected', selected === index);
    cell.classList.toggle('target', target === index);
    cell.classList.toggle('throne', index === THRONE);
    cell.classList.toggle('enemy', piece?.side === 'thorn');
    cell.classList.toggle('occupied', !!piece);
    cell.setAttribute('aria-label', [coord(index), piece && SIDES[piece.side] + TYPES[piece.kind].name, index === THRONE && '王座', destinations.includes(index) && '可落点', pending?.tiles.includes(index) && '待落回声', forecast?.tiles.includes(index) && '预览回声'].filter(Boolean).join('，'));
    cell.setAttribute('aria-pressed', String(selected === index || preview === index));
    const label = cell.firstElementChild;
    if (label.dataset.kind !== piece?.kind) {
      label.dataset.kind = piece?.kind ?? '';
      label.innerHTML = piece ? figure(piece.kind) : '';
    }
  });
  const description = forecast ? '预览回声 · ' + forecast.tiles.map(coord).join(' / ')
    : pending ? '待落回声 · ' + pending.tiles.map(coord).join(' / ')
    : '夺王，或守住中央王座一手。';
  get('echo-caption').textContent = description;
  scene?.setState(state, { destinations, selected, target, pending, forecast });
}

function update() {
  updateTabIndex();
  paint();
  const ai = isAI();
  const win = state.result;
  const pending = win ? null : state.echo;
  const whose = SIDES[state.side];
  get('turn-number').innerHTML = `${String(Math.min(state.turn,40)).padStart(2,'0')} <i>/</i> 40`;
  get('confirm').hidden = preview === null || !!win || ai;
  get('mode-text').textContent = mode === 'solo' ? '人偶对弈' : '双人同屏';
  for (const side of Object.keys(SIDES)) {
    const pieces = state.pieces.filter((piece) => piece.side === side);
    get('count-' + side).innerHTML = [0,1,2].map((index) => `<b class="${index < pieces.length ? 'alive' : ''}"></b>`).join('');
    get('count-' + side).setAttribute('aria-label', '剩余棋子 ' + pieces.length);
    get('side-' + side).classList.toggle('active', state.side === side && !win);
  }

  const selectedPiece = at(state, selected);
  const throne = at(state, THRONE);
  const reason = { capture:'无名王被擒。', echo:'无名王被回声吞没。', throne:'中央王座已守过一轮。', limit:'四十手已尽，无人守住王座。', crowns:'双王被同一道回声吞没。', trapped:'对手已无合法落点。', repeat:'同一局面已出现三次。' };
  get('turn-state').textContent = win ? (win.winner ? SIDES[win.winner] + '获胜' : '和局')
    : ai ? '荆廷思索中' : whose + '行棋';
  let tip;
  if (win) tip = reason[win.reason];
  else if (ai) tip = '林中的人偶正在寻找下一步。';
  else if (preview !== null) {
    const threatened = pending?.tiles.includes(preview);
    tip = coord(preview) + (threatened ? ' · 红格即将受咒，再点一次确认。' : ' · 再点一次或按落子确认。');
  } else if (selectedPiece) tip = TYPES[selectedPiece.kind].name + ' · ' + TYPES[selectedPiece.kind].rule + '。';
  else if (throne?.side && throne.side !== state.side) tip = '对手正在守中；本手必须打断它。';
  else if (pending) tip = '红格在本手结束时吞没棋子；先选己方棋子。';
  else tip = '选一枚己方棋子，查看可走的格子。';
  if (!win && state.last?.fallen.length && preview === null && !selectedPiece) tip += ' 上道回声收走 ' + state.last.fallen.length + ' 枚棋子。';
  get('tip').textContent = tip;
}

function select(index) {
  if (isAI() || state.result) return;
  focus = index;
  const piece = at(state,index);
  if (piece?.side === state.side) {
    selected = selected === index ? null : index;
    preview = hover = null;
    if (!muted) chime('pick');
  } else if (movesFor(state, at(state, selected)).includes(index)) {
    if (preview === index) { commit(); return; }
    preview = index;
    hover = null;
    if (!muted) chime('preview');
  } else {
    selected = preview = hover = null;
  }
  update();
}

function commit() {
  if (isAI() || preview === null) return;
  makeMove(selected, preview);
}

function makeMove(from,to) {
  const next = play(state,from,to);
  if (next === state) return;
  state = next;
  selected = preview = hover = null;
  if (!muted) chime(state.result ? 'end' : state.last.fallen.length ? 'curse' : 'drop');
  update();
  if (isAI()) {
    aiTimer = window.setTimeout(() => {
      aiTimer = null;
      if (!isAI()) return;
      const action = chooseMove(state);
      if (action) makeMove(action.from, action.to);
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 60 : 660);
  }
}

function reset() {
  window.clearTimeout(aiTimer);
  aiTimer = null;
  state = start();
  selected = preview = hover = null;
  focus = 22;
  scene?.reset();
  update();
}

function requestReset(intent) {
  resetIntent = intent;
  if (state.turn > 1 && !state.result) {
    restart.returnValue = 'cancel';
    restart.showModal();
  } else performReset();
}
function performReset() {
  if (resetIntent === 'mode') mode = mode === 'solo' ? 'local' : 'solo';
  reset();
}

board.addEventListener('keydown', (event) => {
  const offset = { ArrowLeft: [-1,0], ArrowRight: [1,0], ArrowUp: [0,-1], ArrowDown: [0,1] }[event.key];
  if (!offset) return;
  event.preventDefault();
  const x = Math.max(0, Math.min(4,col(focus) + offset[0]));
  const y = Math.max(0, Math.min(4,row(focus) + offset[1]));
  cells[x + y*SIZE].focus();
});
stage.addEventListener('click', (event) => {
  if (!event.detail || !scene || isAI() || state.result) return;
  const hit = scene.hitPieceAt(event.clientX,event.clientY);
  if (hit === null) return;
  const piece = at(state,hit);
  if (!piece || (piece.side !== state.side && !movesFor(state,at(state,selected)).includes(hit))) return;
  if (event.target.closest('.cell') === cells[hit] || event.target.closest('.legal')) return;
  event.stopPropagation();
  cells[hit].focus({ preventScroll:true });
  select(hit);
}, { capture:true });
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || rules.open || restart.open) return;
  if (preview !== null) preview = hover = null;
  else selected = hover = null;
  update();
});
get('sound').addEventListener('click', () => {
  muted = !muted;
  get('sound').innerHTML = icon(muted ? 'muted' : 'sound');
  get('sound').setAttribute('aria-label', muted ? '开启声音' : '关闭声音');
  get('sound').setAttribute('aria-pressed', String(!muted));
  if (!muted) chime('preview');
});
get('guide').addEventListener('click', () => rules.showModal());
get('close-rules').addEventListener('click', () => rules.close());
get('confirm').addEventListener('click', () => { commit(); cells[focus].focus({ preventScroll: true }); });
get('reset').addEventListener('click', () => requestReset('reset'));
get('mode').addEventListener('click', () => requestReset('mode'));
restart.addEventListener('close', () => { if (restart.returnValue === 'confirm') performReset(); });
