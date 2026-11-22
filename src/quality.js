// Adaptive render quality. Phone GPUs differ by an order of magnitude, so the stage starts sharp and sheds
// pixels (then bloom) until it holds its frame rate. A step that buys nothing is undone: the frame rate
// is then capped by the display or the CPU, not by pixels.
const SLOW = 1000 / 48, WINDOW = 800, KEY = 'mirror-alice-q';
export function createQuality(apply, dpr = Math.min(window.devicePixelRatio || 1, 2)) {
  const LEVELS = [1, .8, .65, .5].map((k, i) => ({ ratio: Math.max(.75, dpr * k), bloom: i < 2 }));
  let level = Math.min(LEVELS.length - 1, sessionStorage.getItem(KEY) | 0), locked = false;
  let n = 0, sum = 0, skip = 2, slow = 0, before = 0, fps = 60;
  const set = (i) => { level = i; sessionStorage.setItem(KEY, i); apply(LEVELS[i]); n = sum = slow = 0; skip = 2; };
  apply(LEVELS[level]);
  return {
    get level() { return level; }, get fps() { return fps; }, get ratio() { return LEVELS[level].ratio; }, get locked() { return locked; },
    tick(ms) {
      if (ms > 1500) { n = sum = 0; return; } // the tab was hidden
      sum += ms; if (++n < 4 || sum < WINDOW) return;
      const avg = sum / n; n = sum = 0; fps = 1000 / avg;
      if (skip) { skip--; return; } // shader compiles and texture uploads right after a change
      if (locked) return;
      if (before) { const gained = avg < before * .9; before = 0; if (!gained) { locked = true; return set(level - 1); } }
      slow = avg > SLOW ? slow + 1 : 0;
      if (slow >= 2 && level < LEVELS.length - 1) { before = avg; set(level + 1); }
    },
  };
}
