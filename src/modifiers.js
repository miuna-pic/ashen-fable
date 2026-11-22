// 战役变体：在不改动 rules.js 的前提下，为单个关卡叠加额外规则。
//   bell: N    子夜钟 —— 每 N 回合，所有非首领棋子掉到玻璃的另一面
//   wilful     任性的镜子 —— 每走一步，领路的身体自动交换；镜中的她没墨就罢工
//   limit: N   口试 —— 只给 N 步
//   dark: N    火柴 —— 红格平时看不见；一根火柴照亮 2 步，共 N 根（只影响显示）
//   solo       还没学会翻面：只有明面的身体能走
//   exit       首领关里，只要女王之影还活着，走到裂缝格也算赢（结局记为 exit）
// 地图里的 'x' 是开局就躺在那里的遗骸。
import { parseLevel, movesFor, play, allAims, KINDS } from './rules.js';

export function compile(level, graves = []) {
  const pre = [];
  const map = level.map.map((grid) => grid.map((line, y) => [...line].map((ch, x) => { if (ch !== 'x') return ch; pre.push(y * 6 + x); return '.'; }).join('')));
  const st = parseLevel({ ...level, map }, [...new Set([...pre, ...graves])]);
  const mod = level.mod || {};
  st.mod = mod; st.lead = 0; st.left = mod.limit ?? -1; st.matches = mod.dark ?? 0; st.lit = 0; st.ending = null; st.rang = 0;
  return st;
}

// 任性关里只有 st.lead 那一面能走。
export function movesX(st, face) {
  if (st.mod?.wilful && face !== st.lead) return [];
  if (st.mod?.solo && face === 1) return [];
  return movesFor(st, face);
}

export function playX(st0, face, to) {
  if (!movesX(st0, face).some((m) => m.to === to)) return null;
  const r = play(st0, face, to), st = r.st, ev = r.ev, mod = st.mod || {};
  if (st.lit > 0) st.lit -= 1;
  if (st.result === 'win') st.ending = 'crown';
  if (!st.result && mod.exit && to === st.goal && st.enemies.some((e) => e.alive && KINDS[e.kind].shadow)) { st.result = 'win'; st.ending = 'exit'; ev.push({ t: 'win' }); }
  if (!st.result && st.left > 0 && --st.left === 0) { st.result = 'dead'; st.cause = 'timeout'; ev.push({ t: 'timeout' }); }
  if (!st.result && mod.bell && (st.turn - 1) % mod.bell === 0) {
    for (const e of st.enemies) if (e.alive && !KINDS[e.kind].boss && !KINDS[e.kind].shadow) e.face = 1 - e.face;
    st.rang += 1; ev.push({ t: 'bell' });
  }
  if (!st.result && mod.wilful) {
    st.lead = 1 - st.lead;
    if (st.lead === 1 && !movesFor(st, 1).length) { st.lead = 0; ev.push({ t: 'sulk' }); }
  }
  return { st, ev };
}

export const bellIn = (st) => st.mod?.bell ? st.mod.bell - ((st.turn - 1) % st.mod.bell) : 0;
export function strike(st) { if (st.matches < 1 || st.lit > 0) return false; st.matches -= 1; st.lit = 2; return true; }
export const shownAims = (st) => (st.mod?.dark !== undefined && st.lit < 1 ? [] : allAims(st));

const keyOf = (st) => st.alice + '|' + st.ink + '|' + st.lead + '|' + st.left + '|' + (st.mod?.bell ? (st.turn - 1) % st.mod.bell : 0) + '|' + st.enemies.map((e) => e.alive ? e.at * 2 + e.face : 'x').join(',');
// 最短解（广度优先）。opts.faces 限定可用的身体，opts.ending 限定结局，opts.ok(st, face, move) 可以禁掉某些走法。
export function solveX(st, opts = {}) {
  const { faces = [0, 1], cap = 300000, ending = null, ok = null } = opts;
  const seen = new Map([[keyOf(st), null]]); let frontier = [st], n = 0;
  while (frontier.length) {
    const next = [];
    for (const cur of frontier) for (const face of faces) for (const m of movesX(cur, face)) {
      if (ok && !ok(cur, face, m)) continue;
      const r = playX(cur, face, m.to); if (r.st.result === 'dead') continue;
      if (r.st.result === 'win' && ending && r.st.ending !== ending) continue;
      const k = keyOf(r.st); if (seen.has(k)) continue;
      seen.set(k, { prev: cur, face, to: m.to });
      if (r.st.result === 'win') { const path = []; for (let p = seen.get(k); p; p = seen.get(keyOf(p.prev))) path.unshift({ face: p.face, to: p.to }); return path; }
      if (++n > cap) return null;
      next.push(r.st);
    }
    frontier = next;
  }
  return null;
}

// 给死因一句人话：是谁、从哪一面、凭什么砍到的。
export function causeOf(st0, st, ev) {
  if (st.cause === 'timeout') return { kind: 'timeout' };
  const hit = ev.find((e) => e.t === 'strike'); if (!hit) return null;
  const e = st0.enemies[hit.id]; return { kind: e.kind, face: e.face, at: hit.at };
}
