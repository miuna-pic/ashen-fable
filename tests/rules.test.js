import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/rules.js';

const act = (s, id, type, to) => R.play(s, { id, type, to });
const set = (s, id, at) => { R.piece(s, id).at = at; return s; };

test('开局：十根火柴、三颗心、三位女孩', () => {
  const s = R.start();
  assert.equal(s.matches, 10);
  assert.equal(s.queenHp, 3);
  assert.deepEqual(s.pieces.filter(R.isHeroine).map((p) => p.id), ['match', 'mermaid', 'karen']);
});

test('划火柴照亮两格菱形，融冰，并在三个敌方回合后熄灭', () => {
  let s = set(R.start(), 'match', R.idx(3, 2));
  s.pieces = s.pieces.filter((p) => p.kind !== 'shard' && p.id !== 'karen');
  let r = act(s, 'match', 'strike', R.idx(3, 2));
  assert.equal(r.state.matches, 9);
  assert.ok(R.isLit(r.state, R.idx(3, 0)) && R.isLit(r.state, R.idx(5, 2)) && !R.isLit(r.state, R.idx(5, 1)));
  assert.equal(r.state.ice[R.idx(3, 1)], false);
  assert.ok(r.events.some((e) => e.t === 'melt'));
  s = r.state;
  for (const to of [R.idx(3, 3), R.idx(3, 4)]) s = act(s, 'match', 'move', to).state;
  assert.equal(s.lights.length, 0);
});

test('暗处的敌人无法被击中，光里才行', () => {
  let s = set(set(R.start(), 'mermaid', R.idx(3, 3)), 'match', R.idx(3, 2));
  s.pieces = s.pieces.filter((p) => p.kind !== 'shard' && p.id !== 'karen');
  assert.ok(!R.actionsFor(s, 'mermaid').some((a) => a.hit));
  s = act(s, 'match', 'strike', R.idx(3, 2)).state;
  set(s, 'match', R.idx(2, 2));
  const hit = R.actionsFor(s, 'mermaid').find((a) => a.hit === 'queen');
  assert.ok(hit);
  const r = R.play(s, hit);
  assert.equal(r.state.queenHp, 2);
  assert.notEqual(R.piece(r.state, 'queen').at, R.idx(3, 0));
});

test('人鱼暗处每格耗声、光里不耗；声尽化为泡沫留下永久的光', () => {
  let s = R.start();
  s.pieces = s.pieces.filter((p) => p.kind !== 'shard' && p.id !== 'karen');
  const r = act(s, 'mermaid', 'move', R.idx(1, 3));
  assert.equal(r.state.voice, 7);
  s = r.state; s.voice = 2;
  const end = act(s, 'mermaid', 'move', R.idx(3, 3));
  assert.equal(R.piece(end.state, 'mermaid'), undefined);
  assert.ok(end.state.lights.some((l) => l.foam && l.at === R.idx(3, 3)));
  assert.ok(R.isLit(end.state, R.idx(4, 4)));
});

test('红舞鞋每回合自己跳两格，撞墙反弹', () => {
  let s = R.start();
  s.pieces = s.pieces.filter((p) => p.kind !== 'shard');
  const r = act(s, 'match', 'move', R.idx(3, 5));
  assert.equal(R.piece(r.state, 'karen').at, R.idx(3, 3));
  s = set(r.state, 'karen', R.idx(0, 3)); s.karenDir = [-1, 0];
  assert.deepEqual(R.dancePath(s).path, [R.idx(1, 3), R.idx(2, 3)]);
});

test('镜片落在暗处的女孩身上即败北，光里安全', () => {
  let s = set(R.start(), 'shard1', R.idx(2, 3));
  s = set(s, 'match', R.idx(3, 6));
  const dark = act(s, 'mermaid', 'move', R.idx(1, 5));
  assert.equal(dark.state.result, null);
  s = set(R.start(), 'shard1', R.idx(2, 4));
  const lost = act(s, 'mermaid', 'move', R.idx(0, 6));
  assert.deepEqual(lost.state.result, { winner: 'queen', reason: 'girl' });
  const safe = act(s, 'match', 'strike', R.idx(3, 6));
  assert.equal(safe.state.result, null);
});

test('雪后三颗心碎尽即胜', () => {
  let s = set(set(R.start(), 'mermaid', R.idx(3, 3)), 'match', R.idx(3, 2));
  s.pieces = s.pieces.filter((p) => p.kind !== 'shard' && p.id !== 'karen');
  s.queenHp = 1;
  s = act(s, 'match', 'strike', R.idx(3, 2)).state;
  set(s, 'match', R.idx(2, 2));
  const r = R.play(s, R.actionsFor(s, 'mermaid').find((a) => a.hit));
  assert.deepEqual(r.state.result, { winner: 'ember', reason: 'queen' });
});

test('最后一根火柴熄灭，长夜降临', () => {
  let s = R.start();
  s.pieces = s.pieces.filter((p) => p.kind !== 'shard' && p.id !== 'karen');
  s.matches = 1;
  s = act(s, 'match', 'strike', R.idx(3, 6)).state;
  assert.equal(s.lights[0].r, 3);
  for (let k = 0; k < 4 && !s.result; k++) s = R.play(s, R.actionsFor(s, 'match').find((a) => a.type === 'move')).state;
  assert.deepEqual(s.result, { winner: 'queen', reason: 'night' });
});

test('凯伦反弹回自己刚离开的格子不算撞人，人鱼不因此失声', () => {
  let s = R.start();
  s.pieces = s.pieces.filter((p) => p.kind !== 'shard');
  s.ice.fill(false);
  set(s, 'karen', R.idx(1, 1)); s.karenDir = [-1, -1]; // 第一步进角落，第二步反弹回出发格
  const plan = R.dancePath(s);
  assert.deepEqual(plan.path, [R.idx(0, 0), R.idx(1, 1)]);
  assert.equal(plan.end.type, 'rest');
  const r = act(s, 'match', 'move', R.idx(3, 5));
  assert.equal(r.state.voice, R.VOICE);
  assert.ok(!r.events.some((e) => e.t === 'bump'));
});

test('人鱼不在场时不会再次化为泡沫', () => {
  let s = R.start();
  s.pieces = s.pieces.filter((p) => p.kind !== 'shard' && p.id !== 'mermaid');
  s.voice = 0; s.ice.fill(false);
  set(s, 'karen', R.idx(1, 1)); s.karenDir = [-1, -1];
  const r = act(s, 'match', 'move', R.idx(3, 5));
  assert.ok(!r.events.some((e) => e.t === 'foam'));
  assert.equal(r.state.lights.filter((l) => l.foam).length, 0);
});

test('凯伦真的撞上人鱼时，人鱼失去两点声', () => {
  let s = R.start();
  s.pieces = s.pieces.filter((p) => p.kind !== 'shard');
  s.ice.fill(false);
  set(s, 'karen', R.idx(3, 3)); set(s, 'mermaid', R.idx(4, 3)); s.karenDir = [1, 0];
  const r = act(s, 'match', 'move', R.idx(3, 5));
  assert.equal(r.state.voice, R.VOICE - 2);
  assert.equal(r.events.find((e) => e.t === 'bump').id, 'mermaid');
});

test('结冰预告在镜片行动后依然成立：被占住就不冻，不会改冻别处', () => {
  const s0 = R.start();
  const predicted = R.frostNext(s0);
  const r = act(s0, 'mermaid', 'move', R.idx(1, 3));
  const frozen = r.events.filter((e) => e.t === 'freeze').flatMap((e) => e.tiles);
  for (const i of frozen) assert.ok(predicted.includes(i), `tile ${i} froze without being forecast`);
});
