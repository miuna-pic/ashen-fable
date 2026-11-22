// Adaptive render quality. Phone GPUs differ by an order of magnitude, so the stage sheds work until it holds
// its frame rate, cheapest loss first: the sky and sea buffer (soft paint, `back` times the picture), then bloom,
// and only then the pixels of the board and the pieces. A step that buys nothing is undone: the frame rate
// is then capped by the display or the CPU, not by pixels.
const SLOW = 1000 / 48, WINDOW = 800, KEY = 'mirror-alice-q';
export function createQuality(apply, dpr = Math.min(window.devicePixelRatio || 1, 2)) {
  const LEVELS = [[1, 1, 1], [1, .5, 1], [1, .5, 0], [1, .34, 0], [.8, .34, 0], [.65, .34, 0], [.5, .34, 0], [.375, .34, 0]]
    .map(([k, back, bloom]) => ({ ratio: Math.max(.75, dpr * k), back, bloom: !!bloom }));
  // a touch device starts with the backdrop already halved: it is the one step that cannot be seen
  const first = matchMedia('(pointer: coarse)').matches ? 1 : 0, saved = sessionStorage.getItem(KEY);
  const pin = new URLSearchParams(location.search).get('q');   // ?q=3 holds one step, to compare them on a device
  let level = Math.min(LEVELS.length - 1, pin !== null ? pin | 0 : saved === null ? first : saved | 0), locked = pin !== null;
  let n = 0, sum = 0, skip = 2, slow = 0, before = 0, fps = 60;
  const set = (i) => { level = i; sessionStorage.setItem(KEY, i); apply(LEVELS[i]); n = sum = slow = 0; skip = 1; };
  apply(LEVELS[level]);
  return {
    get level() { return level; }, get fps() { return fps; }, get ratio() { return LEVELS[level].ratio; }, get locked() { return locked; },
    tick(ms) {
      if (ms > 1500) { n = sum = 0; return; } // the tab was hidden
      sum += ms; if (++n < 4 || sum < WINDOW) return;
      const avg = sum / n; n = sum = 0; fps = 1000 / avg;
      if (skip) { skip--; return; } // shader compiles and texture uploads right after a change
      if (locked) return;
      // Only a device that is nearly smooth gets its pixels back; one far below that keeps shedding, since its timings are too noisy to judge a single step.
      if (before) { const gained = avg < before * .9 || avg > SLOW * 2; before = 0; if (!gained) { locked = true; return set(level - 1); } }
      slow = avg > SLOW ? slow + 1 : 0;
      if ((slow >= 2 || avg > SLOW * 2) && level < LEVELS.length - 1) { before = avg; set(level + 1); }
    },
  };
}
