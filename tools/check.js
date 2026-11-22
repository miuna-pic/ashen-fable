// Dev tool: prints the solver's verdict on every campaign board.  usage: node tools/check.js [id-substring]
import { LEVELS } from '../src/levels.js';
import { compile, solveX, movesX, playX } from '../src/modifiers.js';
const fmt = (p) => p ? p.length + ' ' + p.map((m) => (m.face ? '里' : '表') + String.fromCharCode(97 + m.to % 6) + (8 - Math.floor(m.to / 6))).join(' ') : 'X';
function bot(level, n = 2000) { let win = 0, seed = 9; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  for (let i = 0; i < n; i++) { let st = compile(level); for (let k = 0; k < 40 && !st.result; k++) { const all = [0, 1].flatMap((f) => movesX(st, f).map((m) => [f, m.to])); if (!all.length) break; const [f, to] = all[Math.floor(rnd() * all.length)]; st = playX(st, f, to).st; } if (st.result === 'win') win++; } return (win / n * 100).toFixed(1) + '%'; }
for (const level of LEVELS) { if (process.argv[2] && !level.id.includes(process.argv[2])) continue;
  const st = compile(level);
  console.log(level.id.padEnd(14), fmt(solveX(st)), '| 表only', solveX(st, { faces: [0] })?.length ?? 'X', '| 里only', solveX(st, { faces: [1] })?.length ?? 'X', '| nocap', solveX(st, { ok: (s, f, m) => m.capture === null })?.length ?? 'X', level.mod?.exit ? '| exit ' + fmt(solveX(st, { ending: 'exit' })) + ' crown ' + fmt(solveX(st, { ending: 'crown' })) : '', '| bot', bot(level)); }
