// Dev tool: random-searches enemy placements and keeps the ones the solver rates as real puzzles.
// usage: node tools/levelgen.js "<kinds>" <ink> <samples> [boss] [holes]
import { parseLevel, solve, allAims, W, H } from '../src/rules.js';
const [kinds, ink, samples, boss, holes] = [process.argv[2], +process.argv[3], +process.argv[4], process.argv[5] === 'boss', +(process.argv[6] || 0)];
let seed = +(process.env.SEED || 7); const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const found = [];
for (let i = 0; i < samples; i++) {
  const g = [0, 1].map(() => Array.from({ length: H }, () => Array(W).fill('.')));
  const free = (x, y) => g[0][y][x] === '.' && g[1][y][x] === '.';
  const put = (ch, face, ymin, ymax) => { for (let t = 0; t < 50; t++) { const x = Math.floor(rnd() * W), y = ymin + Math.floor(rnd() * (ymax - ymin + 1)); if (free(x, y)) { g[face][y][x] = ch; return; } } };
  put('A', 0, 7, 7); if (boss) put('Q', 0, 0, 0); else put('C', 0, 0, 0);
  for (let h = 0; h < holes; h++) put('#', 0, 2, 5);
  for (const ch of kinds) put(ch, 'hnbS'.includes(ch) ? 1 : 0, ch === 'S' ? 0 : 0, ch === 'S' ? 2 : 5);
  const level = { ink, boss, map: g.map((f) => f.map((r) => r.join(''))) };
  const st = parseLevel(level);
  if (allAims(st).some((a) => a.squares.includes(st.alice))) continue;
  const path = solve(st, [0, 1], 40000); if (!path || path.length < +(process.env.MIN || 7)) continue;
  const mirror = path.filter((m) => m.face).length; if (mirror < 2 || mirror > path.length - 3) continue;
  if (solve(st, [0], 40000)) continue;
  found.push({ len: path.length, mirror, level });
}
found.sort((a, b) => b.len - a.len);
for (const f of found.slice(0, 4)) console.log(f.len, f.mirror, JSON.stringify(f.level.map));
console.log('kept', found.length);
