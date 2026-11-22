import test from 'node:test';
import assert from 'node:assert/strict';
import { compile, movesX, playX, solveX, shownAims, strike, bellIn } from '../src/modifiers.js';
import { LEVELS, CHAPTERS } from '../src/levels.js';
import { STORY, AFTER, ENDING, PAGES, COACH, NAMES, ART, GLYPH, DEATH } from '../src/story.js';
import { sprite } from '../src/cast.js';
import { existsSync } from 'node:fs';
import { botRate } from '../tools/gen.js';

const P = (name) => name.charCodeAt(0) - 97 + (8 - +name[1]) * 6;
const by = (id) => LEVELS.find((l) => l.id === id);
const ending = (l) => (l.mod?.exit ? 'crown' : null);

test('every board has a shortest line equal to its par', () => {
  for (const l of LEVELS) { const p = solveX(compile(l, l.need || []), { cap: 400000, ending: ending(l) }); assert.equal(p?.length, l.par, l.id); }
});
test('every board, chapter and speaker has its text', () => {
  for (const l of LEVELS) { assert.ok(STORY[l.id]?.length, 'story ' + l.id); assert.ok(CHAPTERS[l.ch], 'chapter ' + l.id); }
  assert.equal(PAGES.length, CHAPTERS.length);
  const lines = [...Object.values(STORY), ...Object.values(AFTER), ...Object.values(ENDING)].flat();
  for (const [who] of lines) { assert.ok(who in NAMES, 'name ' + who); assert.ok(ART[who] || who in GLYPH, 'face ' + who); }
  for (const [who, , mood] of lines) {
    if (who in GLYPH) continue;
    const src = sprite(who, mood); assert.ok(src && existsSync(new URL('../public/' + src.slice(2), import.meta.url)), 'sprite ' + who + ' ' + mood);
    if (mood) assert.ok(src.endsWith(`_${mood}.webp`), 'mood ' + who + ' ' + mood);
  }
  for (let c = 0; c < CHAPTERS.length; c++) for (const d of ['bg', 'page']) assert.ok(existsSync(new URL(`../public/art/${d}/${c}.webp`, import.meta.url)), d + c);
  for (const k of 'srQhnbS') assert.equal(DEATH[k].length, 2);
});
test('the first square is won with one body; from the second square on the mirror is required', () => {
  for (const l of LEVELS) { const alone = solveX(compile(l, l.need || []), { faces: [0], cap: 400000, ending: ending(l) });
    if (l.ch === 0) assert.ok(alone, l.id); else assert.equal(alone, null, l.id); }
});
test('coach scripts are playable step by step and leave a winnable board', () => {
  for (const [id, steps] of Object.entries(COACH)) {
    const l = by(id); let st = compile(l), face = 0; const graves = [];
    for (const s of steps) {
      if (s.free) break;
      if (s.flip !== undefined) { assert.notEqual(face, s.flip, id); face = s.flip; continue; }
      for (const name of s.only) assert.ok(movesX(st, face).some((m) => m.to === P(name)), `${id}: ${name} is not a legal move`);
      const r = playX(st, face, P(s.only[0]));
      if (s.die) { for (const name of s.only) assert.equal(playX(st, face, P(name)).st.result, 'dead', id + ' ' + name); graves.push(P(s.only[0])); st = compile(l, graves); face = 0; }
      else { assert.equal(r.st.result, null, id + ' ' + s.only[0]); st = r.st; }
    }
    assert.ok(solveX(st), id + ' stuck after coaching');
    assert.ok(steps.at(-1).free, id);
  }
});
test('the oral exam cannot be passed by luck or with one body, and has no slack', () => {
  const exam = LEVELS.filter((l) => l.exam); assert.equal(exam.length, 5);
  for (const l of exam) {
    assert.equal(l.par, l.mod.limit, l.id);
    assert.ok(botRate(l, 2000) < .03, l.id + ' random play passes too often');
    assert.equal(solveX(compile(l), { faces: [1] }), null, l.id + ' mirror alone');
  }
});
test('limit: running out of moves fails the board', () => {
  const l = by('viva1'); let st = compile(l); const m = movesX(st, 0).find((x) => playX(st, 0, x.to).st.result === null);
  st = playX(st, 0, m.to).st; const back = movesX(st, 0).find((x) => playX(st, 0, x.to).st.cause === 'timeout');
  assert.ok(back);
});
test('bell: pieces change faces on the stroke, and bell boards need the bell', () => {
  const l = by('stair'); let st = compile(l); assert.equal(bellIn(st), 3);
  const faces = st.enemies.map((e) => e.face);
  for (let i = 0; i < 3; i++) { const m = solveX(st)[0]; st = playX(st, m.face, m.to).st; }
  assert.deepEqual(st.enemies.filter((e) => e.alive).map((e) => e.face), faces.map((f) => 1 - f)); assert.equal(st.rang, 1);
  for (const b of LEVELS.filter((x) => x.mod?.bell)) assert.equal(solveX(compile({ ...b, mod: {} })), null, b.id);
});
test('dark: threats are hidden until a match is struck, and matches run out', () => {
  let st = compile(by('match1')); assert.equal(shownAims(st).length, 0);
  assert.ok(strike(st)); assert.ok(shownAims(st).length > 0); assert.equal(strike(st), false);
  const m = solveX(st)[0]; st = playX(st, m.face, m.to).st; assert.equal(st.lit, 1);
  st.lit = 0; st.matches = 0; assert.equal(strike(st), false);
});
test('wilful: bodies alternate, and a dry mirror passes the move back', () => {
  let st = compile({ ink: 1, mod: { wilful: true }, map: [['C.....', '......', '......', '......', '......', '......', '......', '..A...'], Array(8).fill('......')] });
  assert.equal(movesX(st, 1).length, 0); st = playX(st, 0, P('c2')).st; assert.equal(st.lead, 1); assert.equal(movesX(st, 0).length, 0);
  st = playX(st, 1, P('c5')).st; assert.equal(st.lead, 0); const r = playX(st, 0, P('c6')); assert.equal(r.st.lead, 0); assert.ok(r.ev.some((e) => e.t === 'sulk'));
});
test('martyr boards are impossible alive and possible over your own corpses', () => {
  const m = LEVELS.filter((l) => l.need); assert.equal(m.length, 2);
  for (const l of m) { assert.equal(solveX(compile(l), { cap: 400000 }), null, l.id); assert.ok(solveX(compile(l, l.need)), l.id); }
});
test('the last board has two endings: the crown, and the crack while the shadow lives', () => {
  const l = LEVELS.at(-1), st = compile(l);
  const crown = solveX(st, { ending: 'crown' }), exit = solveX(st, { ending: 'exit' });
  assert.ok(crown && exit); let s = st; for (const m of exit) s = playX(s, m.face, m.to).st;
  assert.equal(s.ending, 'exit'); assert.ok(s.enemies.some((e) => e.kind === 'S' && e.alive));
  s = st; for (const m of crown) s = playX(s, m.face, m.to).st; assert.equal(s.ending, 'crown');
});
