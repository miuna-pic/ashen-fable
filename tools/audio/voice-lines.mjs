// Lists every line the two Alices and the Cat speak, with the file name the game will look for.
// A line with a count filled in at play time (`{n}`) has no fixed words to record, so it stays unvoiced.
// Run: node tools/audio/voice-lines.mjs > tools/audio/voice-lines.json
import * as story from '../../src/story.js';
import { voiceKey } from '../../src/audio.js';

const WHO = ['a', 'b', 'cat'], out = new Map();
const add = (who, text) => { if (WHO.includes(who) && typeof text === 'string' && text.trim() && !text.includes('{')) out.set(voiceKey(who, text), { key: voiceKey(who, text), who, text }); };
const walk = (x) => {
  if (Array.isArray(x)) { if (x.length === 2 && typeof x[0] === 'string' && typeof x[1] === 'string') add(x[0], x[1]); else x.forEach(walk); }
  else if (x && typeof x === 'object') { if (typeof x.say === 'string') add(x.who, x.say); Object.values(x).forEach(walk); }
};
for (const k of ['STORY', 'AFTER', 'ENDING', 'COACH']) walk(story[k]);
// What she tells Alice after a death; the Cat calls time.
for (const [k, v] of Object.entries(story.DEATH)) if (Array.isArray(v)) v.forEach((t) => add(k === 'timeout' ? 'cat' : 'b', t));
console.log(JSON.stringify([...out.values()], null, 1));
