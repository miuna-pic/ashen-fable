// 镜渊爱丽丝 — rules. Pure functions, no DOM: shared by the game, the hint solver and the tests.
// One Alice, two bodies. She stands on the same square of both faces of a glass board.
// Face 0 表 (仙境): she steps like a king. Face 1 里 (镜渊): she slides like a queen, paying ink.
export const W = 6, H = 8, MAX_INK = 3;
export const sq = (x, y) => y * W + x;
export const X = (s) => s % W, Y = (s) => Math.floor(s / W);
const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
const ORTH = [[1,0],[-1,0],[0,1],[0,-1]], DIAG = [[1,1],[1,-1],[-1,1],[-1,-1]], ALL = [...ORTH, ...DIAG];
const LEAP = [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]];

export const KINDS = {
  s: { key: 'soldier', name: '红心兵', face: 0, mover: 'step', aim: 'diag1' },
  r: { key: 'rook', name: '处刑人', face: 0, aim: 'orth' },
  Q: { key: 'queen', name: '红心女王', face: 0, aim: 'all', boss: true },
  h: { key: 'hollow', name: '空壳兵', face: 1, mover: 'step', aim: 'diag1' },
  n: { key: 'knight', name: '无头骑士', face: 1, mover: 'leap', aim: 'leap' },
  b: { key: 'cat', name: '柴郡猫', face: 1, aim: 'diag' },
  S: { key: 'shadow', name: '女王之影', face: 1, aim: 'ring', shadow: true },
};

export function parseLevel(level, corpses = []) {
  const st = { alice: 0, ink: level.ink ?? 1, enemies: [], holes: new Set(), goal: -1, corpses: [...corpses], boss: !!level.boss, result: null, turn: 1 };
  level.map.forEach((grid, face) => grid.forEach((line, y) => [...line].forEach((ch, x) => {
    const s = sq(x, y);
    if (ch === '#') st.holes.add(s);
    else if (ch === 'A') st.alice = s;
    else if (ch === 'C') st.goal = s;
    else if (KINDS[ch]) st.enemies.push({ id: st.enemies.length, kind: ch, face: KINDS[ch].face, at: s, alive: true });
  })));
  st.corpses = st.corpses.filter((c) => c !== st.alice && c !== st.goal);
  return st;
}

const clone = (st) => ({ ...st, enemies: st.enemies.map((e) => ({ ...e })), corpses: [...st.corpses] });
export const enemyAt = (st, face, s) => st.enemies.find((e) => e.alive && e.face === face && e.at === s);
const solid = (st, s) => st.holes.has(s) || st.corpses.includes(s);
const shadowAlive = (st) => st.enemies.some((e) => e.alive && KINDS[e.kind].shadow);

// Squares an enemy will strike at the start of its next phase. Lines stop at holes, corpses and
// pieces of its own face (the blocker's square is included: that piece is defended).
export function aimsOf(st, e) {
  const k = KINDS[e.kind], out = [], x0 = X(e.at), y0 = Y(e.at);
  const ray = (dirs, max) => { for (const [dx, dy] of dirs) for (let n = 1; n <= max; n++) {
    const x = x0 + dx * n, y = y0 + dy * n; if (!inside(x, y)) break; const s = sq(x, y);
    if (solid(st, s)) break; out.push(s); if (enemyAt(st, e.face, s)) break; } };
  if (k.aim === 'diag1') ray(DIAG, 1); else if (k.aim === 'ring') ray(ALL, 1);
  else if (k.aim === 'orth') ray(ORTH, 9); else if (k.aim === 'diag') ray(DIAG, 9); else if (k.aim === 'all') ray(shadowAlive(st) ? ALL : ORTH, 9); // a queen without her shadow goes half blind
  else for (const [dx, dy] of LEAP) { const x = x0 + dx, y = y0 + dy; if (inside(x, y) && !solid(st, sq(x, y))) out.push(sq(x, y)); }
  return out;
}
export const allAims = (st) => st.enemies.filter((e) => e.alive).map((e) => ({ id: e.id, face: e.face, squares: aimsOf(st, e) }));

// Alice's legal moves when the given face leads.
export function movesFor(st, face) {
  if (st.result) return [];
  const out = [], x0 = X(st.alice), y0 = Y(st.alice), max = face === 0 ? 1 : 9;
  if (face === 1 && st.ink < 1) return out;
  for (const [dx, dy] of ALL) for (let n = 1; n <= max; n++) {
    const x = x0 + dx * n, y = y0 + dy * n; if (!inside(x, y)) break; const s = sq(x, y);
    if (solid(st, s)) break;
    const mine = enemyAt(st, face, s), theirs = enemyAt(st, 1 - face, s);
    if (mine) { if (!theirs && !(KINDS[mine.kind].boss && shadowAlive(st))) out.push({ to: s, capture: mine.id }); break; }
    if (!theirs) out.push({ to: s, capture: null });
  }
  return out;
}

const dist = (a, b) => Math.max(Math.abs(X(a) - X(b)), Math.abs(Y(a) - Y(b))) * 10 + Math.abs(X(a) - X(b)) + Math.abs(Y(a) - Y(b));

// Returns the next state plus an event list the stage animates in order.
export function play(st0, face, to) {
  const mv = movesFor(st0, face).find((m) => m.to === to); if (!mv) return null;
  const st = clone(st0), ev = [], before = allAims(st0);
  ev.push({ t: 'move', face, from: st.alice, to });
  st.alice = to;
  if (face === 1) st.ink -= 1;
  if (mv.capture !== null) {
    const e = st.enemies[mv.capture]; e.alive = false; ev.push({ t: 'capture', id: e.id, face });
    if (face === 0) st.ink = Math.min(MAX_INK, st.ink + 1);
    if (KINDS[e.kind].boss) { st.result = 'win'; ev.push({ t: 'win' }); return { st, ev }; }
  }
  if (!st.boss && to === st.goal) { st.result = 'win'; ev.push({ t: 'win' }); return { st, ev }; }
  const killer = before.find((a) => st.enemies[a.id].alive && a.squares.includes(to));
  if (killer) { st.result = 'dead'; ev.push({ t: 'strike', id: killer.id, at: to }); return { st, ev }; }
  for (const e of st.enemies) {
    const k = KINDS[e.kind]; if (!e.alive || !k.mover) continue;
    let best = null;
    const options = [[0, 0], ...(k.mover === 'step' ? ORTH : LEAP)];
    options.forEach(([dx, dy], i) => {
      const x = X(e.at) + dx, y = Y(e.at) + dy; if (!inside(x, y)) return; const s = sq(x, y);
      if (i && (solid(st, s) || s === st.alice || s === st.goal || enemyAt(st, e.face, s))) return;
      const hits = aimsOf(st, { ...e, at: s }).includes(st.alice);
      const score = (hits ? 0 : 1000) + dist(s, st.alice) + (i ? 0 : .5);
      if (!best || score < best.score) best = { s, score };
    });
    if (best.s !== e.at) { ev.push({ t: 'shift', id: e.id, from: e.at, to: best.s }); e.at = best.s; }
  }
  st.turn += 1;
  return { st, ev };
}

const keyOf = (st) => st.alice + '|' + st.ink + '|' + st.enemies.map((e) => e.alive ? e.at : 'x').join(',');
// Breadth-first search for the shortest winning line. `faces` limits which bodies may lead.
export function solve(st, faces = [0, 1], cap = 200000) {
  const seen = new Map([[keyOf(st), null]]); let frontier = [st], n = 0;
  while (frontier.length) {
    const next = [];
    for (const cur of frontier) for (const face of faces) for (const m of movesFor(cur, face)) {
      const r = play(cur, face, m.to); if (r.st.result === 'dead') continue;
      const k = keyOf(r.st); if (seen.has(k)) continue;
      seen.set(k, { prev: cur, face, to: m.to });
      if (r.st.result === 'win') { const path = []; let c = r.st, kk = k; for (let p = seen.get(kk); p; p = seen.get(keyOf(p.prev))) { path.unshift({ face: p.face, to: p.to }); c = p.prev; } return path; }
      if (++n > cap) return null;
      next.push(r.st);
    }
    frontier = next;
  }
  return null;
}
