import test from 'node:test';
import assert from 'node:assert/strict';
import { start, play, movesFor, actions, chooseMove, square, CENTER } from '../src/game.js';

const empty = (extra = {}) => ({ cells: Array(25).fill(null), turn: 'crimson', clock: 0, night: false, bells: 1, winner: null, reason: null, ply: 0, ...extra });
const put = (s, x, y, side, kind) => { s.cells[square(x, y)] = { id: side + kind, side, kind }; return s; };

test('开局：白昼，绯之卷先行，睡美人被封印', () => {
  const s = start();
  assert.equal(s.turn, 'crimson');
  assert.equal(s.night, false);
  assert.equal(movesFor(s, square(2, 0)).length, 0);
  assert.ok(actions(s).length > 0);
});

test('步数即时间：走几格，钟走几个时辰', () => {
  const s = put(put(empty(), 0, 4, 'crimson', 'rapunzel'), 4, 0, 'gold', 'gretel');
  const n = play(s, { from: square(0, 4), to: square(0, 1) });
  assert.equal(n.clock, 3);
  assert.equal(n.turn, 'gold');
});

test('钟响：昼夜翻转，走法随之改变', () => {
  const s = put(put(empty({ clock: 11 }), 0, 4, 'crimson', 'hood'), 4, 0, 'gold', 'gretel');
  const n = play(s, { from: square(0, 4), to: square(0, 3) });
  assert.equal(n.night, true);
  assert.equal(n.bells, 2);
  assert.equal(n.clock, 0);
  assert.ok(movesFor({ ...n, turn: 'crimson' }, square(0, 3)).some((m) => m.hours === 3), '噬狼能冲三格');
});

test('钟响时站在终格的女主角写下结局', () => {
  const s = put(put(empty({ clock: 11 }), 2, 3, 'crimson', 'snow'), 4, 0, 'gold', 'gretel');
  const n = play(s, { from: square(2, 3), to: CENTER });
  assert.equal(n.winner, 'crimson');
  assert.equal(n.reason, 'ending');
  assert.equal(n.author, 'snow');
});

test('第一响是序章，不写结局；纸偶永远不能写结局', () => {
  const a = put(put(empty({ clock: 11, bells: 0 }), 2, 3, 'crimson', 'snow'), 4, 0, 'gold', 'gretel');
  assert.equal(play(a, { from: square(2, 3), to: CENTER }).winner, null);
  const b = put(put(put(empty({ clock: 11 }), 2, 3, 'crimson', 'doll'), 0, 4, 'crimson', 'hood'), 4, 0, 'gold', 'gretel');
  assert.equal(play(b, { from: square(2, 3), to: CENTER }).winner, null);
});

test('封印：玻璃棺吃不掉，只能被撞开；身后有东西就撞不动', () => {
  const s = put(put(put(empty({ night: true, turn: 'gold' }), 2, 2, 'crimson', 'snow'), 2, 0, 'gold', 'briar'), 0, 0, 'crimson', 'hood');
  const m = movesFor(s, square(2, 0)).find((x) => x.to === CENTER);
  assert.equal(m.push, square(2, 3));
  assert.equal(m.capture, undefined);
  const n = play(s, m);
  assert.equal(n.cells[square(2, 3)].kind, 'snow');
  assert.equal(n.cells[CENTER].kind, 'briar');
  put(s, 2, 3, 'crimson', 'doll');
  assert.equal(movesFor(s, square(2, 0)).some((x) => x.to === CENTER), false);
});

test('吃光对方女主角即胜', () => {
  const s = put(put(empty(), 0, 4, 'crimson', 'rapunzel'), 0, 2, 'gold', 'gretel');
  const n = play(s, { from: square(0, 4), to: square(0, 2) });
  assert.equal(n.winner, 'crimson');
  assert.equal(n.reason, 'erased');
});

test('第六响书页燃尽，女主角多的一方胜', () => {
  const s = put(put(put(empty({ clock: 11, bells: 5 }), 0, 4, 'crimson', 'hood'), 1, 4, 'crimson', 'cinder'), 4, 0, 'gold', 'gretel');
  const n = play(s, { from: square(0, 4), to: square(0, 3) });
  assert.equal(n.winner, 'crimson');
  assert.equal(n.reason, 'burnt');
});

test('无路可走的一方只能听钟', () => {
  const s = put(put(empty({ turn: 'crimson' }), 0, 4, 'crimson', 'hood'), 2, 0, 'gold', 'briar');
  const n = play(s, { from: square(0, 4), to: square(0, 3) });
  assert.equal(n.turn, 'crimson');
  assert.equal(n.clock, 2);
  assert.ok(n.events.some((e) => e.type === 'pass'));
});

test('书灵会抓住一步写下结局的机会，也总能把一局下完', () => {
  const s = put(put(empty({ clock: 11, turn: 'gold' }), 2, 1, 'gold', 'gretel'), 0, 4, 'crimson', 'hood');
  assert.equal(chooseMove(s, 2).to, CENTER);
  let g = start(), guard = 0;
  while (!g.winner && guard++ < 400) g = play(g, chooseMove(g, 2));
  assert.ok(g.winner);
});
