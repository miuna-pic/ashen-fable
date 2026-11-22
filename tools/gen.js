// Dev tool: random-searches piece placements on top of a fixed template and keeps boards that pass `accept`.
// Used from ad-hoc scripts: import { search, show } from './tools/gen.js'
import { allAims } from '../src/rules.js';
import { compile, solveX, movesX, playX } from '../src/modifiers.js';
const E = () => Array.from({ length: 8 }, () => '......');
export const blank = () => [E(), E()];
export const fmt = (p) => p ? p.length + ' ' + p.map((m) => (m.face ? '里' : '表') + String.fromCharCode(97 + m.to % 6) + (8 - Math.floor(m.to / 6))).join(' ') : 'X';
export function show(level) { const [a, b] = level.map; for (let y = 0; y < 8; y++) console.log('  ' + a[y] + '   ' + b[y]); console.log('  map: ' + JSON.stringify(level.map) + ',' + (level.mod ? ' mod: ' + JSON.stringify(level.mod) : '') + ' ink: ' + level.ink); }
export function botRate(level, n = 1500) { let win = 0, seed = 9; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  for (let i = 0; i < n; i++) { let st = compile(level); for (let k = 0; k < 40 && !st.result; k++) { const all = [0, 1].flatMap((f) => movesX(st, f).map((m) => [f, m.to])); if (!all.length) break; const [f, to] = all[Math.floor(rnd() * all.length)]; st = playX(st, f, to).st; } if (st.result === 'win') win++; } return win / n; }
// Squares where a death can actually happen from the start position within `depth` moves.
export function deathSquares(level, depth = 6) { const out = new Set(); let frontier = [compile(level)]; const seen = new Set();
  for (let d = 0; d < depth; d++) { const next = []; for (const st of frontier) for (const f of [0, 1]) for (const m of movesX(st, f)) { const r = playX(st, f, m.to); if (r.st.result === 'dead') { if (r.st.cause !== 'timeout') out.add(m.to); continue; } if (r.st.result) continue; const k = r.st.alice + '|' + r.st.ink + '|' + r.st.enemies.map((e) => e.alive ? e.at : 'x'); if (seen.has(k)) continue; seen.add(k); next.push(r.st); } frontier = next; if (frontier.length > 20000) break; }
  return [...out]; }
// spec: { map (template, optional), kinds: 'ssrb', ink, mod, boss, rows: {ch: [ymin,ymax]}, holes, corpses, samples, seed, accept(level, st, path) -> score|false }
export function search(spec) {
  let seed = spec.seed || 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32; const found = [];
  for (let i = 0; i < (spec.samples || 3000); i++) {
    if (spec.until && Date.now() > spec.until) break;
    const g = (spec.map || blank()).map((f) => f.map((r) => [...r]));
    const free = (x, y) => g[0][y][x] === '.' && g[1][y][x] === '.';
    const put = (ch, face, [y0, y1] = [0, 5], [x0, x1] = [0, 5]) => { for (let t = 0; t < 60; t++) { const x = x0 + Math.floor(rnd() * (x1 - x0 + 1)), y = y0 + Math.floor(rnd() * (y1 - y0 + 1)); if (free(x, y)) { g[face][y][x] = ch; return; } } };
    const has = (ch) => g.some((f) => f.some((r) => r.includes(ch)));
    if (!has('A')) put('A', 0, spec.rows?.A || [7, 7]); if (!has('C') && !has('Q')) put(spec.boss ? 'Q' : 'C', 0, spec.rows?.C || [0, 0]);
    if (spec.mod?.exit && !has('C')) put('C', 0, spec.rows?.C || [0, 0]);
    for (let h = 0; h < (spec.holes || 0); h++) put('#', 0, [1, 6]);
    for (let h = 0; h < (spec.corpses || 0); h++) put('x', 0, [1, 6]);
    for (const ch of spec.kinds || '') put(ch, 'hnbS'.includes(ch) ? 1 : 0, spec.rows?.[ch] || [0, 5], spec.cols?.[ch]);
    const level = { ink: spec.ink ?? 1, boss: spec.boss, mod: spec.mod, map: g.map((f) => f.map((r) => r.join(''))) };
    const st = compile(level);
    if (allAims(st).some((a) => a.squares.includes(st.alice))) continue;
    const path = solveX(st, { cap: spec.cap || 60000 }); if (!path && !spec.raw) continue;
    const score = spec.accept ? spec.accept(level, st, path) : path.length; if (score === false || score === undefined) continue;
    found.push({ score, path, level });
  }
  found.sort((a, b) => b.score - a.score);
  const seenLen = new Set(); let shown = 0;
  for (const f of found) { if (shown >= (spec.top || 4)) break; console.log('score', f.score, '|', fmt(f.path)); show(f.level); shown++; }
  console.log('kept', found.length); return found;
}

// Every winning move sequence of at most `limit` moves.
export function wins(st, limit) { if (st.result) return st.result === 'win' ? 1 : 0; if (!limit) return 0; let n = 0;
  for (const f of [0, 1]) for (const m of movesX(st, f)) n += wins(playX(st, f, m.to).st, limit - 1); return n; }
export const under = (st, from, to) => { const dx = Math.sign(to % 6 - from % 6), dy = Math.sign(Math.floor(to / 6) - Math.floor(from / 6)); let x = from % 6 + dx, y = Math.floor(from / 6) + dy;
  while (y * 6 + x !== to) { if (st.enemies.some((e) => e.alive && e.face === 0 && e.at === y * 6 + x)) return true; x += dx; y += dy; } return false; };
// Replays a path and reports what it used.
export function traits(level, path) { let st = compile(level); const t = { mirror: 0, capS: 0, capM: 0, under: 0 };
  for (const m of path) { if (m.face) { t.mirror++; if (under(st, st.alice, m.to)) t.under++; } const r = playX(st, m.face, m.to); if (r.ev.some((e) => e.t === 'capture')) m.face ? t.capM++ : t.capS++; st = r.st; } return t; }
