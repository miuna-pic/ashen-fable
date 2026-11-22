import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { cueFor, stepNote, CHAPTER_CUES, voiceKey } from '../src/audio.js';
import { LEVELS } from '../src/levels.js';

const score = JSON.parse(readFileSync(new URL('../public/audio/score.json', import.meta.url)));
const file = (f) => existsSync(new URL('../public/audio/' + f, import.meta.url));

test('every level has a cue and every cue has its stems', () => {
  for (const level of [null, ...LEVELS]) {
    const name = cueFor(level && { id: level.id, boss: level.ch === 7 }, level?.ch), meta = score[name];
    assert.ok(meta, `no cue ${name}`);
    for (const k of ['a', ...(meta.faces > 1 ? ['b'] : []), ...(meta.pulse ? ['p'] : [])]) assert.ok(file(`${name}-${k}.m4a`), `${name}-${k}`);
  }
  assert.equal(cueFor({ id: 'new-level', boss: true }, 9), 'trial');
  assert.ok(score[cueFor({ id: 'new-level' }, 9)]);
});

test('each chapter has a theme of its own', () => {
  const chapters = [...new Set(LEVELS.map((l) => l.ch))];
  const cues = chapters.map((ch) => cueFor({ id: 'x', boss: ch === 7 }, ch));
  assert.equal(new Set(cues).size, chapters.length);
  assert.ok(!cues.includes('title'));
  assert.deepEqual(cues, CHAPTER_CUES.slice(0, chapters.length));
});

test('the mirror harmony is the surface harmony inverted around the axis of each theme', () => {
  for (const [name, meta] of Object.entries(score)) {
    const [above, below] = meta.chords;
    assert.equal(above.length, below.length, name);
    above.forEach((chord, bar) => {
      const flipped = chord.map((pc) => (((meta.axis ?? 4) - pc) % 12 + 12) % 12).sort((a, b) => a - b);
      assert.deepEqual([...below[bar]].sort((a, b) => a - b), flipped, `${name} bar ${bar}`);
    });
    assert.ok(Math.abs(meta.len - meta.bars * (meta.beats ?? 3) * 60 / meta.bpm) < 1e-3);
  }
});

test('footsteps ring chord tones: climbing above the glass, falling below it', () => {
  const dm = [2, 5, 9];
  const up = [0, 1, 2, 3].map((n) => stepNote(dm, n, 0)), down = [0, 1, 2, 3].map((n) => stepNote(dm, n, 1));
  assert.deepEqual(up, [74, 77, 81, 86]);
  assert.deepEqual(down, [74, 69, 65, 62]);
  for (const pcs of score.rabbit.chords.flat()) for (let n = 0; n < 4; n++) assert.ok(pcs.includes(stepNote(pcs, n, 0) % 12));
});

test('every recorded line is a line someone still says', () => {
  const lines = JSON.parse(readFileSync(new URL('../public/audio/voice/lines.json', import.meta.url)));
  const wanted = new Set(JSON.parse(readFileSync(new URL('../tools/audio/voice-lines.json', import.meta.url))).map((l) => l.key));
  for (const key of Object.keys(lines)) { assert.ok(wanted.has(key), key); assert.ok(file(`voice/${key}.m4a`), key); }
  assert.equal(voiceKey('b', '你又掉下来了。'), '4d164317');
  assert.equal(voiceKey('b', '〔玻璃另一面〕你又掉下来了。'), '4d164317');
});
