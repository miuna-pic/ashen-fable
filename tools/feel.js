// Dev tool: how each board is likely to feel in the hand, not just whether it can be solved.  usage: node tools/feel.js [id-substring]
//   par     shortest win            flips   times the shortest win changes body
//   waits   steps of the shortest win that walk back onto the square left one step earlier (marking time)
//   bits    sum over the shortest win of log2(legal moves / moves that keep the board winnable): how much must be seen
//   lost    share of reachable living positions that can no longer be won (alive but already beaten: the frustrating kind)
//   careful win rate of a player who never steps on a visible red square and otherwise wanders (cap 4 x par)
//   seeker  the same player, but preferring moves that end nearer the crown
import { LEVELS } from '../src/levels.js';
import { compile, movesX, playX, solveX, shownAims } from '../src/modifiers.js';
const key = (st) => [st.alice, st.ink, st.lead, st.left, st.mod?.bell ? (st.turn - 1) % st.mod.bell : 0, st.enemies.map((e) => e.alive ? e.at * 2 + e.face : 'x')].join('|');
const all = (st) => [0, 1].flatMap((f) => movesX(st, f).map((m) => ({ face: f, to: m.to })));
export function feel(level) {
  const start = compile(level, level.need || []), nodes = new Map([[key(start), { st: start, kids: [], win: false }]]);
  let frontier = [start];
  while (frontier.length && nodes.size < 400000) { const next = [];
    for (const cur of frontier) { const node = nodes.get(key(cur));
      for (const m of all(cur)) { const r = playX(cur, m.face, m.to).st;
        if (r.result === 'dead') { node.kids.push({ m, dead: true }); continue; }
        if (r.result === 'win') { node.kids.push({ m, won: true }); node.win = true; continue; }
        const k = key(r); if (!nodes.has(k)) { nodes.set(k, { st: r, kids: [], win: false }); next.push(r); } node.kids.push({ m, k });
      } }
    frontier = next; }
  for (let changed = true; changed;) { changed = false; for (const n of nodes.values()) if (!n.win && n.kids.some((c) => c.k && nodes.get(c.k).win)) { n.win = true; changed = true; } }
  const path = solveX(start) || [], dist = (s) => Math.max(Math.abs(s % 6 - start.goal % 6), Math.abs((s / 6 | 0) - (start.goal / 6 | 0)));
  let bits = 0, waits = 0, flips = 0, cur = start; const trail = [start.alice];
  for (const [i, m] of path.entries()) { const n = nodes.get(key(cur)), good = n.kids.filter((c) => c.won || (c.k && nodes.get(c.k).win)).length;
    bits += Math.log2(n.kids.length / Math.max(1, good)); if (i && m.face !== path[i - 1].face) flips++;
    cur = playX(cur, m.face, m.to).st; if (trail.length > 1 && cur.alice === trail[trail.length - 2]) waits++; trail.push(cur.alice); }
  const living = [...nodes.values()], lost = living.filter((n) => !n.win).length / living.length;
  let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const bot = (seek, n = 600) => { let win = 0;
    for (let i = 0; i < n; i++) { let st = start;
      for (let k = 0; k < 4 * (level.par || 10) && !st.result; k++) { const red = new Set(shownAims(st).flatMap((a) => a.squares)); let ms = all(st); const safe = ms.filter((m) => !red.has(m.to)); if (safe.length) ms = safe; if (!ms.length) break;
        if (seek && rnd() < .7) { const best = Math.min(...ms.map((m) => dist(m.to))); ms = ms.filter((m) => dist(m.to) === best); }
        const m = ms[Math.floor(rnd() * ms.length)]; st = playX(st, m.face, m.to).st; }
      if (st.result === 'win') win++; }
    return win / n; };
  return { id: level.id, ch: level.ch + 1, par: path.length, flips, waits, bits, lost, states: nodes.size, careful: bot(false), seeker: bot(true) };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('board       ch par flips waits  bits  lost%  states careful% seeker%');
  for (const level of LEVELS) { if (process.argv[2] && !level.id.includes(process.argv[2])) continue; const f = feel(level);
    console.log(f.id.padEnd(12), f.ch, String(f.par).padStart(3), String(f.flips).padStart(5), String(f.waits).padStart(5), f.bits.toFixed(1).padStart(6), (f.lost * 100).toFixed(0).padStart(5), String(f.states).padStart(8), (f.careful * 100).toFixed(1).padStart(7), (f.seeker * 100).toFixed(1).padStart(8)); }
}
