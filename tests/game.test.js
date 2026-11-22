import test from 'node:test';
import assert from 'node:assert/strict';
import { actions, at, chooseMove, echoFor, movesFor, play, start, THRONE } from '../src/game.js';

const piece = (side,kind,at) => ({ id:side+'-'+kind, side, kind, at });
const ashKing = piece('ash','crown',22);
const thornKing = piece('thorn','crown',2);
const state = (pieces,fields={}) => ({ ...start(), pieces, ...fields });

test('orthogonal and diagonal slides cannot jump either side', () => {
  const wolf = piece('ash','wolf',6), nun = piece('ash','nun',18);
  const enemy = piece('thorn','wolf',8);
  const opening = state([ashKing,thornKing,wolf,nun,enemy,piece('ash','crown',11)]);
  assert.ok(movesFor(opening,wolf).includes(8));
  assert.ok(!movesFor(opening,wolf).includes(11));
  assert.ok(!movesFor(opening,wolf).includes(16));
  assert.ok(movesFor(opening,nun).includes(12));
  assert.ok(!movesFor(opening,nun).includes(6));
  assert.equal(play(opening,6,16),opening);
});

test('echo covers the origin and non-forward orthogonal neighbors', () => {
  assert.deepEqual(echoFor(12,13,'ash').tiles,[12,11,17,7]);
  assert.deepEqual(echoFor(12,8,'thorn').tiles,[12,11,17]);
  assert.deepEqual(echoFor(0,6,'thorn').tiles,[0]);
});

test('either side can be caught; responder can move before the old echo strikes', () => {
  const initial = state([
    ashKing,thornKing,piece('ash','wolf',12),piece('ash','nun',11),piece('thorn','nun',7),
  ]);
  const pending = play(initial,12,13);
  assert.ok(at(pending,11));
  assert.ok(at(pending,7));
  const reply = play(pending,7,1);
  assert.equal(at(reply,11),undefined);
  assert.equal(at(reply,1)?.side,'thorn');
  assert.deepEqual(reply.last.fallen.map((p)=>p.kind),['nun']);
  assert.deepEqual(reply.last.struck,[12,11,17,7]);
  assert.deepEqual(reply.echo,echoFor(7,1,'thorn'));
  assert.equal(at(initial,12).kind,'wolf');
});

test('responding into a threatened square is legal but the echo removes that piece', () => {
  const initial = state([ashKing,thornKing,piece('thorn','wolf',9)],{
    side:'thorn', echo:echoFor(12,17,'ash'),
  });
  const reply = play(initial,9,7);
  assert.equal(at(reply,7),undefined);
  assert.equal(reply.last.fallen[0]?.id,'thorn-wolf');
});

test('taking the throne only wins after the other court answers', () => {
  const initial = state([ashKing,thornKing,piece('ash','wolf',11)]);
  const occupied = play(initial,11,THRONE);
  assert.equal(occupied.result,null);
  assert.deepEqual(play(occupied,2,1).result,{winner:'ash',reason:'throne'});
});

test('an echo-broken throne claim does not win', () => {
  const initial = state([ashKing,thornKing,piece('ash','wolf',THRONE)],{
    side:'thorn', echo:echoFor(13,14,'ash'),
  });
  const reply = play(initial,2,1);
  assert.equal(reply.result,null);
  assert.equal(at(reply,THRONE),undefined);
});

test('direct capture takes precedence; simultaneous echo deaths draw', () => {
  const initial = state([piece('ash','crown',11),piece('thorn','crown',17),piece('thorn','wolf',10)],{
    side:'thorn', echo:echoFor(12,13,'ash'),
  });
  assert.deepEqual(play(initial,10,11).result,{winner:'thorn',reason:'capture'});
  assert.deepEqual(play(initial,10,5).result,{winner:null,reason:'crowns'});
});

test('third occurrence draws only when pieces, side and pending echo match', () => {
  let current = state([ashKing,thornKing],{history:[]});
  for (let n=0;n<2;n++) {
    for (const [from,to] of [[22,21],[2,3],[21,22],[3,2]]) current=play(current,from,to);
  }
  assert.equal(current.result,null);
  current=play(current,22,21);
  assert.deepEqual(current.result,{winner:null,reason:'repeat'});
});

test('the automaton only picks legal actions and self-play terminates', () => {
  let current=start();
  while(!current.result) {
    const move=chooseMove(current);
    assert.ok(actions(current).some(({from,to})=>from===move.from && to===move.to));
    current=play(current,move.from,move.to);
    assert.ok(current.turn<=41);
    assert.equal(new Set(current.pieces.map((p)=>p.at)).size,current.pieces.length);
  }
  assert.equal(chooseMove(current),null);
});
