export const SIZE = 5;
export const THRONE = 12;
export const LIMIT = 40;
export const SIDES = { ash: '烛廷', thorn: '荆廷' };
export const TYPES = {
  crown: { name: '无名王', mark: '♛', rule: '向任意方向一步', value: 50 },
  wolf: { name: '缄默狼', mark: '✣', rule: '沿直线走一至两格', value: 4 },
  nun: { name: '缝眼修女', mark: '✦', rule: '沿斜线走一至两格', value: 3 },
};
const orthogonal = [[1,0],[-1,0],[0,1],[0,-1]];
const diagonal = [[1,1],[-1,-1],[1,-1],[-1,1]];
export const other = (side) => side === 'ash' ? 'thorn' : 'ash';
export const col = (index) => index % SIZE;
export const row = (index) => Math.floor(index / SIZE);
export const inBoard = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;
export const coord = (index) => String.fromCharCode(65 + col(index)) + (SIZE - row(index));
export const square = (x,y) => y * SIZE + x;
export const at = (state, index) => state.pieces.find((piece) => piece.at === index);
const opening = [
  ['thorn', 'crown', 2], ['thorn', 'wolf', 9], ['thorn', 'nun', 5],
  ['ash', 'crown', 22], ['ash', 'wolf', 15], ['ash', 'nun', 19],
];

export function start() {
  const state = {
    pieces: opening.map(([side, kind, at]) => ({ id: side + '-' + kind, side, kind, at })),
    side: 'ash', turn: 1, echo: null, last: null, result: null, history: [],
  };
  state.history.push(positionKey(state));
  return state;
}

export function movesFor(state, piece) {
  if (!piece || piece.side !== state.side || state.result) return [];
  const directions = piece.kind === 'wolf' ? orthogonal : piece.kind === 'nun' ? diagonal : [...orthogonal, ...diagonal];
  const destinations = [];
  for (const [dx,dy] of directions) {
    for (let n = 1; n <= (piece.kind === 'crown' ? 1 : 2); n++) {
      const x = col(piece.at) + dx * n, y = row(piece.at) + dy * n;
      if (!inBoard(x,y)) break;
      const to = square(x,y), target = at(state, to);
      if (target?.side !== piece.side) destinations.push(to);
      if (target) break;
    }
  }
  return destinations;
}

export function actions(state) {
  return state.pieces.flatMap((piece) => movesFor(state, piece).map((to) => ({ from: piece.at, to })));
}

export function echoFor(from, to, side) {
  const x = col(from), y = row(from);
  const mx = Math.sign(col(to) - x), my = Math.sign(row(to) - y);
  const tiles = orthogonal
    .filter(([dx,dy]) => dx * mx + dy * my <= 0 && inBoard(x + dx,y + dy))
    .map(([dx,dy]) => square(x + dx,y + dy));
  return { from, side, tiles: [from, ...tiles] };
}

function positionKey(state) {
  const figures = state.pieces.map(({ id, at }) => id + at).sort().join(',');
  const echo = state.echo ? [...state.echo.tiles].sort((a,b) => a-b).join(',') : '';
  return state.side + '|' + figures + '|' + echo;
}

export function play(state, from, to) {
  const mover = at(state, from);
  if (!movesFor(state, mover).includes(to)) return state;
  const hit = at(state, to) ?? null;
  const previousEcho = state.echo;
  const fallen = [];
  const before = at(state, THRONE);
  let pieces = state.pieces.filter((piece) => piece !== hit).map((piece) => piece === mover ? { ...piece, at: to } : piece);
  const directVictory = hit?.kind === 'crown';
  if (previousEcho && !directVictory) {
    pieces = pieces.filter((piece) => {
      if (!previousEcho.tiles.includes(piece.at)) return true;
      fallen.push(piece);
      return false;
    });
  }
  const side = other(state.side);
  const after = pieces.find((piece) => piece.at === THRONE);
  const crowns = pieces.filter((piece) => piece.kind === 'crown');
  let result = null;
  if (crowns.length === 0) result = { winner: null, reason: 'crowns' };
  else if (crowns.length === 1) result = { winner: crowns[0].side, reason: directVictory ? 'capture' : 'echo' };
  else if (before?.side === side && after?.id === before.id) result = { winner: side, reason: 'throne' };
  else if (state.turn >= LIMIT) result = { winner: null, reason: 'limit' };
  const next = {
    pieces, side, turn: state.turn + 1, result, echo: echoFor(from,to,state.side),
    last: { piece: mover, to, hit, fallen, struck: directVictory ? [] : previousEcho?.tiles ?? [] },
  };
  const key = positionKey(next);
  next.history = [...state.history, key];
  if (!result && !actions(next).length) next.result = { winner: state.side, reason: 'trapped' };
  if (!next.result && next.history.filter((past) => past === key).length >= 3) next.result = { winner: null, reason:'repeat' };
  return next;
}

function score(state, side) {
  if (state.result) return !state.result.winner ? 0 : (state.result.winner === side ? 1000 : -1000) / (state.turn / 100 + 1);
  return state.pieces.reduce((sum, piece) => {
    const distance = Math.abs(col(piece.at)-2) + Math.abs(row(piece.at)-2);
    const danger = state.echo?.tiles.includes(piece.at)
      ? (piece.kind === 'crown' ? 10 : 1.8) * (piece.side === state.side ? .6 : 1.6)
      : 0;
    const value = TYPES[piece.kind].value + (4-distance)*0.45 + (piece.at === THRONE ? 5 : 0) - danger;
    return sum + (piece.side === side ? value : -value);
  }, 0);
}

export function chooseMove(state) {
  const side = state.side;
  function search(node, depth, lower, upper) {
    if (depth === 0 || node.result) return score(node, side);
    const maximizing = node.side === side;
    let rating = maximizing ? -Infinity : Infinity;
    for (const { from, to } of actions(node)) {
      const value = search(play(node,from,to),depth-1,lower,upper);
      if (maximizing) {
        rating = Math.max(rating,value);
        lower = Math.max(lower,rating);
      } else {
        rating = Math.min(rating,value);
        upper = Math.min(upper,rating);
      }
      if (lower >= upper) break;
    }
    return rating;
  }
  let best = null, bestScore = -Infinity;
  for (const action of actions(state)) {
    const next = play(state, action.from, action.to);
    const position = score(next, side);
    const worstReply = search(next, 2, -Infinity, Infinity);
    const rating = worstReply * 0.85 + position * 0.15;
    if (rating > bestScore) { best = action; bestScore = rating; }
  }
  return best;
}
