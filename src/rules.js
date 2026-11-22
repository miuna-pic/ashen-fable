// 《余烬童话 · 安徒生篇》规则引擎：纯函数，无渲染依赖。
// 核心：光即规则。只有火柴照亮的格子里，敌人才能被击中、镜片才无法踏入、人鱼的脚才不疼。

export const N = 7;
export const MATCHES = 10;
export const VOICE = 10;
export const QUEEN_HP = 3;
export const LIGHT_TTL = 3;
export const VISIONS = ['暖炉', '烤鹅', '圣诞树', '祖母'];

export const DIRS8 = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
const ORTHO = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const KNIGHT = [[1, -2], [2, -1], [2, 1], [1, 2], [-1, 2], [-2, 1], [-2, -1], [-1, -2]];
const HEROINES = ['match', 'mermaid', 'karen'];

export const X = (i) => i % N;
export const Y = (i) => Math.floor(i / N);
export const idx = (x, y) => y * N + x;
export const inside = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
const dist = (a, b) => Math.abs(X(a) - X(b)) + Math.abs(Y(a) - Y(b));
const cheb = (a, b) => Math.max(Math.abs(X(a) - X(b)), Math.abs(Y(a) - Y(b)));
export const isHeroine = (p) => HEROINES.includes(p.kind);

export function start() {
  const ice = Array(N * N).fill(false);
  for (let x = 0; x < N; x++) ice[idx(x, 0)] = true;
  for (const x of [2, 3, 4]) ice[idx(x, 1)] = true;
  return {
    ice,
    lights: [],
    pieces: [
      { id: 'queen', kind: 'queen', at: idx(3, 0) },
      { id: 'shard1', kind: 'shard', at: idx(1, 1) },
      { id: 'shard2', kind: 'shard', at: idx(5, 1) },
      { id: 'match', kind: 'match', at: idx(3, 6) },
      { id: 'mermaid', kind: 'mermaid', at: idx(1, 6) },
      { id: 'karen', kind: 'karen', at: idx(5, 5) },
    ],
    matches: MATCHES,
    voice: VOICE,
    karenDir: [-1, -1],
    queenHp: QUEEN_HP,
    spawnWait: 0,
    spawned: 2,
    turn: 1,
    result: null,
  };
}

const clone = (s) => ({
  ...s,
  ice: s.ice.slice(),
  lights: s.lights.map((l) => ({ ...l })),
  pieces: s.pieces.map((p) => ({ ...p })),
  karenDir: s.karenDir.slice(),
});

export const pieceAt = (s, i) => s.pieces.find((p) => p.at === i);
export const piece = (s, id) => s.pieces.find((p) => p.id === id);
export const isLit = (s, i) => s.lights.some((l) => (l.foam ? cheb(l.at, i) <= 1 : dist(l.at, i) <= l.r));
export const litTiles = (s) => Array.from({ length: N * N }, (_, i) => i).filter((i) => isLit(s, i));

/** 镜片下一步可能落下的格子（暗处才危险）。 */
export function threats(s) {
  const out = new Set();
  for (const p of s.pieces) {
    if (p.kind !== 'shard') continue;
    for (const [dx, dy] of KNIGHT) {
      const x = X(p.at) + dx, y = Y(p.at) + dy;
      if (inside(x, y) && !isLit(s, idx(x, y))) out.add(idx(x, y));
    }
  }
  return [...out];
}

/** 下一个敌方回合将结冰的格子（确定性，可预告）。 */
export function frostNext(s) {
  const girl = piece(s, 'match');
  const count = QUEEN_HP + 1 - s.queenHp;
  const cand = [];
  for (let i = 0; i < N * N; i++) {
    if (s.ice[i] || isLit(s, i) || pieceAt(s, i)) continue;
    const touching = ORTHO.some(([dx, dy]) => inside(X(i) + dx, Y(i) + dy) && s.ice[idx(X(i) + dx, Y(i) + dy)]);
    if (touching) cand.push(i);
  }
  const target = girl ? girl.at : idx(3, 6);
  cand.sort((a, b) => dist(a, target) - dist(b, target) || a - b);
  return cand.slice(0, count);
}

function reflect(at, dir) {
  let [dx, dy] = dir;
  if (!inside(X(at) + dx, Y(at))) dx = -dx;
  if (!inside(X(at), Y(at) + dy)) dy = -dy;
  return [dx, dy];
}

/** 红舞鞋的舞步预演：不改状态，返回路径与结局。 */
export function dancePath(s, dir = s.karenDir, steps = 2) {
  const karen = piece(s, 'karen');
  if (!karen) return null;
  let at = karen.at, d = dir.slice(), guard = 40;
  const path = [];
  let end = { type: 'rest' };
  while (steps > 0 && guard-- > 0) {
    d = reflect(at, d);
    const next = idx(X(at) + d[0], Y(at) + d[1]);
    const there = pieceAt(s, next);
    const other = there && there.id !== 'karen' ? there : null; // 反弹回自己刚离开的格子不算撞人
    if (other) {
      if (isHeroine(other)) end = { type: 'bump', id: other.id, at: next };
      else if (isLit(s, next)) { end = { type: 'strike', id: other.id, at: next }; path.push(next); at = next; }
      else end = { type: 'mirror', id: other.id, at: next };
      if (end.type !== 'strike') d = [-d[0], -d[1]];
      break;
    }
    path.push(next);
    at = next;
    if (!s.ice[next]) steps--;
  }
  return { path, dir: d, end, at };
}

/** 某位女主角当前的全部合法行动。 */
export function actionsFor(s, id) {
  const p = piece(s, id);
  if (!p || s.result || !isHeroine(p)) return [];
  const out = [];
  if (p.kind === 'match') {
    if (s.matches > 0) out.push({ id, type: 'strike', to: p.at });
    for (const [dx, dy] of DIRS8) {
      const x = X(p.at) + dx, y = Y(p.at) + dy;
      if (!inside(x, y)) continue;
      const to = idx(x, y);
      if (!pieceAt(s, to) && !s.ice[to]) out.push({ id, type: 'move', to });
    }
  } else if (p.kind === 'mermaid') {
    for (const [dx, dy] of DIRS8) {
      let cost = 0;
      for (let n = 1; n < N; n++) {
        const x = X(p.at) + dx * n, y = Y(p.at) + dy * n;
        if (!inside(x, y)) break;
        const to = idx(x, y);
        cost += isLit(s, to) ? 0 : s.ice[to] ? 2 : 1;
        if (cost > s.voice) break;
        const other = pieceAt(s, to);
        if (other) {
          if (!isHeroine(other) && isLit(s, to)) out.push({ id, type: 'move', to, cost, hit: other.id });
          break;
        }
        out.push({ id, type: 'move', to, cost });
      }
    }
  } else {
    for (const [dx, dy] of DIRS8) {
      const x = X(p.at) + dx, y = Y(p.at) + dy;
      if (!inside(x, y)) continue;
      const other = pieceAt(s, idx(x, y));
      if (!other || !isHeroine(other)) out.push({ id, type: 'dance', to: idx(x, y), dir: [dx, dy] });
    }
  }
  return out;
}

export const allActions = (s) => HEROINES.flatMap((id) => actionsFor(s, id));

function remove(s, id) { s.pieces = s.pieces.filter((p) => p.id !== id); }

function melt(s, ev) {
  const tiles = [];
  for (let i = 0; i < N * N; i++) if (s.ice[i] && isLit(s, i)) { s.ice[i] = false; tiles.push(i); }
  if (tiles.length) ev.push({ t: 'melt', tiles });
}

function foam(s, at, ev) {
  if (!piece(s, 'mermaid')) return;
  remove(s, 'mermaid');
  s.voice = 0;
  s.lights.push({ at, foam: true });
  ev.push({ t: 'foam', at });
  melt(s, ev);
}

function hitQueen(s, by, ev) {
  const queen = piece(s, 'queen');
  const from = queen.at;
  s.queenHp--;
  if (s.queenHp <= 0) {
    remove(s, 'queen');
    for (const p of s.pieces.filter((q) => q.kind === 'shard')) remove(s, p.id);
    s.result = { winner: 'ember', reason: 'queen' };
    ev.push({ t: 'queenHit', by, from, hp: 0 });
    return;
  }
  const girl = piece(s, 'match');
  const free = (i) => !pieceAt(s, i) && i !== from;
  const all = Array.from({ length: N * N }, (_, i) => i);
  const pool = [
    all.filter((i) => free(i) && s.ice[i] && !isLit(s, i)),
    all.filter((i) => free(i) && !isLit(s, i)),
    all.filter(free),
  ].find((list) => list.length);
  const anchor = girl ? girl.at : from;
  pool.sort((a, b) => dist(b, anchor) - dist(a, anchor) || dist(b, from) - dist(a, from) || a - b);
  queen.at = pool[0];
  const burst = [];
  for (const [dx, dy] of [[0, 0], ...DIRS8]) {
    const x = X(queen.at) + dx, y = Y(queen.at) + dy;
    if (!inside(x, y)) continue;
    const i = idx(x, y);
    if (!s.ice[i] && !isLit(s, i) && (!pieceAt(s, i) || i === queen.at)) { s.ice[i] = true; burst.push(i); }
  }
  s.spawnWait = 0;
  ev.push({ t: 'queenHit', by, from, to: queen.at, hp: s.queenHp, burst });
}

function strikeEnemy(s, by, targetId, ev) {
  const target = piece(s, targetId);
  if (target.kind === 'queen') hitQueen(s, by, ev);
  else { remove(s, targetId); ev.push({ t: 'shatter', id: targetId, at: target.at, by }); }
}

function dance(s, ev, chosen) {
  const karen = piece(s, 'karen');
  if (!karen || s.result) return;
  const plan = dancePath(s, s.karenDir);
  const from = karen.at;
  s.karenDir = plan.dir;
  ev.push({ t: 'dance', from, path: plan.path, end: plan.end.type, chosen: !!chosen });
  if (plan.end.type === 'strike') strikeEnemy(s, 'karen', plan.end.id, ev);
  karen.at = plan.at;
  if (plan.end.type === 'bump') {
    if (plan.end.id === 'match') {
      s.matches = Math.max(0, s.matches - 1);
      ev.push({ t: 'bump', id: 'match', at: plan.end.at });
    } else if (plan.end.id === 'mermaid' && piece(s, 'mermaid')) {
      s.voice = Math.max(0, s.voice - 2);
      ev.push({ t: 'bump', id: 'mermaid', at: plan.end.at });
      if (s.voice === 0) foam(s, plan.end.at, ev);
    }
  }
}

function enemyTurn(s, ev) {
  const queen = piece(s, 'queen');
  const girl = piece(s, 'match');
  const shards = s.pieces.filter((p) => p.kind === 'shard');
  const want = 2 + (QUEEN_HP - s.queenHp);
  const forecast = frostNext(s); // 结冰位置在镜片行动前就定下，和棋盘上的预告一致
  let best = null;
  for (const sh of shards) {
    for (const [dx, dy] of KNIGHT) {
      const x = X(sh.at) + dx, y = Y(sh.at) + dy;
      if (!inside(x, y)) continue;
      const to = idx(x, y);
      if (isLit(s, to)) continue;
      const other = pieceAt(s, to);
      if (other && (!isHeroine(other) || other.kind === 'karen')) continue; // 镜片抓不住停不下来的人
      let score = 0;
      if (other) score = other.kind === 'match' ? 1000 : 60;
      else {
        score -= dist(to, girl.at);
        for (const [ax, ay] of KNIGHT) {
          const tx = X(to) + ax, ty = Y(to) + ay;
          if (!inside(tx, ty)) continue;
          const seen = pieceAt(s, idx(tx, ty));
          if (seen && isHeroine(seen) && seen.kind !== 'karen') score += seen.kind === 'match' ? 7 : 3;
          else if (cheb(idx(tx, ty), girl.at) === 1) score += 0.5;
        }
        if (dist(to, girl.at) <= 2 && s.matches > 0) score -= 2.5;
        if (sh.last === to) score -= 3;
      }
      if (!best || score > best.score) best = { sh, to, score, other };
    }
  }
  const canSpawn = shards.length < want && s.spawnWait <= 0;
  if (best?.other || !canSpawn) {
    if (best) {
      const from = best.sh.at;
      if (best.other) {
        remove(s, best.other.id);
        ev.push({ t: 'shardMove', id: best.sh.id, from, to: best.to, kills: best.other.id });
        if (best.other.kind === 'match') s.result = { winner: 'queen', reason: 'girl' };
      } else ev.push({ t: 'shardMove', id: best.sh.id, from, to: best.to });
      best.sh.last = from;
      best.sh.at = best.to;
    }
  } else {
    const spots = DIRS8.map(([dx, dy]) => [X(queen.at) + dx, Y(queen.at) + dy])
      .filter(([x, y]) => inside(x, y)).map(([x, y]) => idx(x, y))
      .filter((i) => !pieceAt(s, i) && !isLit(s, i))
      .sort((a, b) => dist(a, girl.at) - dist(b, girl.at) || a - b);
    if (spots.length) {
      const id = 'shard' + (++s.spawned);
      s.pieces.push({ id, kind: 'shard', at: spots[0] });
      s.spawnWait = 3;
      ev.push({ t: 'spawn', id, at: spots[0] });
    }
  }
  s.spawnWait--;
  if (s.result) return;

  const frozen = forecast.filter((i) => !pieceAt(s, i) && !isLit(s, i));
  if (frozen.length) { for (const i of frozen) s.ice[i] = true; ev.push({ t: 'freeze', tiles: frozen }); }

  const out = [];
  for (const l of s.lights) if (!l.foam && --l.ttl <= 0) out.push(l.at);
  s.lights = s.lights.filter((l) => l.foam || l.ttl > 0);
  if (out.length) ev.push({ t: 'lightOut', tiles: out });
  if (s.matches === 0 && !s.lights.some((l) => !l.foam)) s.result = { winner: 'queen', reason: 'night' };
}

/** 执行一步玩家行动并跑完敌方回合。返回新状态和事件序列（供演出）。 */
export function play(state, action) {
  const legal = actionsFor(state, action.id).find((a) => a.type === action.type && a.to === action.to);
  if (!legal) return { state, events: [] };
  const s = clone(state);
  const ev = [];
  const p = piece(s, action.id);

  if (legal.type === 'strike') {
    s.matches--;
    const last = s.matches === 0;
    const vision = VISIONS[last ? 3 : (MATCHES - s.matches - 1) % 3];
    s.lights.push({ at: p.at, r: last ? 3 : 2, ttl: last ? LIGHT_TTL + 1 : LIGHT_TTL });
    ev.push({ t: 'strike', at: p.at, r: last ? 3 : 2, vision, left: s.matches });
    melt(s, ev);
  } else if (legal.type === 'move') {
    const from = p.at;
    if (p.kind === 'mermaid') s.voice -= legal.cost;
    ev.push({ t: 'move', id: p.id, from, to: legal.to, cost: legal.cost ?? 0 });
    if (legal.hit) strikeEnemy(s, p.id, legal.hit, ev);
    p.at = legal.to;
    if (p.kind === 'mermaid' && s.voice <= 0 && !s.result) foam(s, p.at, ev);
  } else {
    s.karenDir = legal.dir.slice();
    dance(s, ev, true);
  }

  if (legal.type !== 'dance') dance(s, ev, false);
  if (!s.result) enemyTurn(s, ev);
  if (!s.result && !allActions(s).length) s.result = { winner: 'queen', reason: 'frozen' };
  if (!s.result) s.turn++;
  if (s.result) ev.push({ t: 'result', ...s.result });
  return { state: s, events: ev };
}
