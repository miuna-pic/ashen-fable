import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLevel, solve, movesFor, play, allAims, sq } from '../src/rules.js';
import { LEVELS } from '../src/levels.js';

for (const level of LEVELS) test(`${level.title} is solvable`, () => {
  const path = solve(parseLevel(level));
  assert.ok(path, 'no winning line');
  console.log(level.title, 'shortest', path.length, 'surface-only', solve(parseLevel(level), [0])?.length ?? 'impossible', path.map((m) => (m.face ? '里' : '表') + m.to).join(' '));
});
test('later levels cannot be won without the mirror body', () => {
  for (const level of LEVELS.slice(1)) assert.equal(solve(parseLevel(level), [0]), null, level.title);
});
test('mirror slide costs ink and surface capture refunds it', () => {
  const st = parseLevel({ ink: 1, map: [['......','......','......','......','......','......','.s....','A.....'], Array(8).fill('......')] });
  assert.equal(movesFor({ ...st, ink: 0 }, 1).length, 0);
  const r = play(st, 0, sq(1, 6)); assert.equal(r.st.ink, 2);
});
test('stepping onto a telegraphed square kills, and a corpse then blocks the line', () => {
  const level = { ink: 0, map: [['......','......','......','......','......','......','r.....','.A....'], Array(8).fill('......')] };
  const st = parseLevel(level);
  const dead = play(st, 0, sq(1, 6)); assert.equal(dead.st.result, 'dead');
  const again = parseLevel(level, [sq(1, 6)]);
  assert.ok(!allAims(again)[0].squares.includes(sq(2, 6)));
});
