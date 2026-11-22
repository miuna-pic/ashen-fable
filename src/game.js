// 《子夜十二响》规则核心：纯函数，无 DOM。
export const SIZE = 5;
export const CENTER = 12;
export const HOURS = 12;
export const LAST_BELL = 6;
export const FIRST_ENDING = 2;
export const SIDES = { crimson: '绯之卷', gold: '金之卷' };
export const HEROINES = ['hood', 'cinder', 'snow', 'rapunzel', 'gretel', 'briar'];

const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ALL = [...ORTH, ...DIAG];
const LEAP = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];

// 每位角色两副面孔：[白昼, 子夜]。sealed = 不能动、不能被吃、只能被推开。
export const FORMS = {
  hood: [
    { name: '小红帽', epithet: '提篮的孩子', rule: '任意方向走一格', dirs: ALL, range: 1, value: 3 },
    { name: '噬狼', epithet: '她穿上了狼的皮', rule: '任意方向直冲一至三格', dirs: ALL, range: 3, value: 10 },
  ],
  cinder: [
    { name: '辛德瑞拉', epithet: '舞会上的公主', rule: '沿斜线旋舞一至三格', dirs: DIAG, range: 3, value: 6 },
    { name: '灰姑娘', epithet: '魔法失效之后', rule: '任意方向走一格', dirs: ALL, range: 1, value: 3 },
  ],
  snow: [
    { name: '白雪', epithet: '捧着毒苹果', rule: '沿直线走一至两格', dirs: ORTH, range: 2, value: 5 },
    { name: '玻璃棺', epithet: '她终于咬了下去', rule: '封印：不能移动，不能被吃，只能被推开', dirs: [], range: 0, value: 4, sealed: true },
  ],
  rapunzel: [
    { name: '莴苣姑娘', epithet: '高塔上的长发', rule: '沿直线垂发一至三格', dirs: ORTH, range: 3, value: 7 },
    { name: '发魔女', epithet: '头发学会了绞杀', rule: '沿斜线绞行一至三格', dirs: DIAG, range: 3, value: 6 },
  ],
  gretel: [
    { name: '格蕾特', epithet: '撒面包屑的妹妹', rule: '任意方向走一格', dirs: ALL, range: 1, value: 3 },
    { name: '炉火魔女', epithet: '她把女巫推进烤炉，然后戴上了帽子', rule: '日字跳跃，可越过棋子', dirs: LEAP, range: 1, value: 6, leap: true },
  ],
  briar: [
    { name: '睡美人', epithet: '荆棘里的百年', rule: '封印：不能移动，不能被吃，只能被推开', dirs: [], range: 0, value: 4, sealed: true },
    { name: '梦游公主', epithet: '她在梦里起身', rule: '任意方向滑行一至两格', dirs: ALL, range: 2, value: 7 },
  ],
  doll: [
    { name: '纸偶', epithet: '撕下的书页', rule: '沿直线走一格；不能书写结局', dirs: ORTH, range: 1, value: 1.5 },
    { name: '纸偶', epithet: '撕下的书页', rule: '沿直线走一格；不能书写结局', dirs: ORTH, range: 1, value: 1.5 },
  ],
};

export const other = (side) => (side === 'crimson' ? 'gold' : 'crimson');
export const col = (i) => i % SIZE;
export const row = (i) => Math.floor(i / SIZE);
export const square = (x, y) => y * SIZE + x;
export const inBoard = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;
export const isHeroine = (piece) => piece.kind !== 'doll';
export const formOf = (piece, night) => FORMS[piece.kind][night ? 1 : 0];

export function start() {
  const cells = Array(SIZE * SIZE).fill(null);
  const put = (x, y, side, kind, n = '') => { cells[square(x, y)] = { id: side + '-' + kind + n, side, kind }; };
  put(0, 0, 'gold', 'doll', 1); put(1, 0, 'gold', 'gretel'); put(2, 0, 'gold', 'briar'); put(3, 0, 'gold', 'rapunzel'); put(4, 0, 'gold', 'doll', 2);
  put(0, 4, 'crimson', 'doll', 1); put(1, 4, 'crimson', 'cinder'); put(2, 4, 'crimson', 'snow'); put(3, 4, 'crimson', 'hood'); put(4, 4, 'crimson', 'doll', 2);
  return { cells, turn: 'crimson', clock: 0, night: false, bells: 0, winner: null, reason: null, ply: 0 };
}

// 合法落点：{ to, hours, capture?, push? }
export function movesFor(state, from) {
  const piece = state.cells[from];
  if (!piece || state.winner) return [];
  const form = formOf(piece, state.night);
  const out = [];
  const x0 = col(from), y0 = row(from);
  for (const [dx, dy] of form.dirs) {
    for (let n = 1; n <= form.range; n++) {
      const x = x0 + dx * n, y = y0 + dy * n;
      if (!inBoard(x, y)) break;
      const to = square(x, y);
      const hit = state.cells[to];
      const hours = Math.max(Math.abs(x - x0), Math.abs(y - y0));
      if (!hit) { out.push({ from, to, hours }); continue; }
      if (hit.side !== piece.side) {
        if (formOf(hit, state.night).sealed) {
          const px = x + Math.sign(dx), py = y + Math.sign(dy);
          if (inBoard(px, py) && !state.cells[square(px, py)]) out.push({ from, to, hours, push: square(px, py) });
        } else out.push({ from, to, hours, capture: true });
      }
      break;
    }
  }
  return out;
}

export function actions(state, side = state.turn) {
  const out = [];
  if (state.winner) return out;
  for (let i = 0; i < state.cells.length; i++) {
    if (state.cells[i]?.side === side) out.push(...movesFor(state, i));
  }
  return out;
}

const heroines = (state, side) => state.cells.filter((p) => p && p.side === side && isHeroine(p)).length;
const dolls = (state, side) => state.cells.filter((p) => p && p.side === side && !isHeroine(p)).length;

function tick(state, hours, events) {
  state.clock += hours;
  if (state.clock < HOURS) return;
  state.clock -= HOURS;
  state.night = !state.night;
  state.bells += 1;
  events.push({ type: 'bell', night: state.night, bells: state.bells });
  const author = state.cells[CENTER];
  if (author && isHeroine(author) && state.bells >= FIRST_ENDING) {
    state.winner = author.side; state.reason = 'ending'; state.author = author.kind;
  } else if (state.bells >= LAST_BELL) {
    const diff = heroines(state, 'crimson') - heroines(state, 'gold') || dolls(state, 'crimson') - dolls(state, 'gold');
    state.winner = diff > 0 ? 'crimson' : diff < 0 ? 'gold' : 'draw';
    state.reason = 'burnt';
  }
}

// 走一步，返回新局面；events 供演出使用。
export function play(state, move) {
  const legal = movesFor(state, move.from).find((m) => m.to === move.to);
  const piece = state.cells[move.from];
  if (!legal || !piece || piece.side !== state.turn) throw new Error('非法着法');
  const next = { ...state, cells: state.cells.slice(), ply: state.ply + 1 };
  const events = [];
  if (legal.push !== undefined) {
    next.cells[legal.push] = next.cells[legal.to];
    events.push({ type: 'push', id: next.cells[legal.push].id, from: legal.to, to: legal.push });
  } else if (legal.capture) {
    events.push({ type: 'capture', piece: next.cells[legal.to], at: legal.to });
  }
  next.cells[legal.to] = piece;
  next.cells[legal.from] = null;
  events.unshift({ type: 'move', id: piece.id, from: legal.from, to: legal.to, hours: legal.hours });
  if (!heroines(next, other(piece.side))) {
    next.winner = piece.side; next.reason = 'erased';
  } else {
    tick(next, legal.hours, events);
    next.turn = other(state.turn);
    // 无路可走的一方只能听钟走过一个时辰
    let guard = 0;
    while (!next.winner && !actions(next).length && guard++ < 80) {
      events.push({ type: 'pass', side: next.turn });
      tick(next, 1, events);
      next.turn = other(next.turn);
    }
  }
  next.events = events;
  return next;
}

// ───── 对手 ─────
const DIST = Array.from({ length: 25 }, (_, i) => Math.max(Math.abs(col(i) - 2), Math.abs(row(i) - 2)));

function evaluate(state, side) {
  let score = 0;
  const urgency = state.clock / HOURS;
  for (let i = 0; i < 25; i++) {
    const p = state.cells[i];
    if (!p) continue;
    const forms = FORMS[p.kind];
    const now = forms[state.night ? 1 : 0].value, later = forms[state.night ? 0 : 1].value;
    let v = now * (1 - urgency * 0.5) + later * (urgency * 0.5);
    if (isHeroine(p)) {
      v += 7 + (2 - DIST[i]) * (0.4 + urgency * 1.2);
      if (i === CENTER) v += 2 + urgency * 6;
    } else v += (2 - DIST[i]) * 0.15;
    score += p.side === side ? v : -v;
  }
  return score;
}

const order = (m) => (m.capture ? 4 : 0) + (m.to === CENTER ? 2 : 0) + (m.push !== undefined ? 1 : 0);

// 负极大值搜索，返回值以 state.turn 一方为正
function search(state, depth, alpha, beta) {
  if (state.winner) return state.winner === 'draw' ? 0 : (state.winner === state.turn ? 1 : -1) * (9000 + depth);
  if (depth <= 0) return evaluate(state, state.turn);
  let best = -Infinity;
  for (const move of actions(state).sort((a, b) => order(b) - order(a))) {
    const next = play(state, move);
    const value = next.turn === state.turn ? search(next, depth - 1, alpha, beta) : -search(next, depth - 1, -beta, -alpha);
    if (value > best) best = value;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

export function chooseMove(state, depth = 4, random = Math.random) {
  let best = null, bestValue = -Infinity;
  for (const move of actions(state)) {
    const next = play(state, move);
    const value = (next.turn === state.turn ? search(next, depth - 1, -Infinity, Infinity) : -search(next, depth - 1, -Infinity, Infinity)) + random() * 0.3;
    if (value > bestValue) { bestValue = value; best = move; }
  }
  return best;
}
