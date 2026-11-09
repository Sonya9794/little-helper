import test from 'node:test';
import assert from 'node:assert/strict';
import { ChessGame, chooseMove, moveReaction, clockText } from '../src/chess-game.ts';
import { ChessMascot } from '../src/chess-mascot.ts';
function log(options = {}) { return { id: 1, started_at: '2026-11-09T12:00:00Z', finished_at: null, elo: 800, adaptive: true, win_step: 5, loss_step: 5,
  options: { player: 'white', minutes: 0, increment: 0, energy: 2, ...options }, outcome: 'in_progress', pgn: '' }; }
test('legal moves, turn ownership and PGN move history', () => {
  const game = new ChessGame(log(), 0);
  assert.throws(() => game.move('e2','e5',undefined,'human',0));
  assert.equal(game.board.history().length, 0);
  game.move('e2','e4',undefined,'human',100);
  assert.throws(() => game.move('d2','d4',undefined,'human',100));
  game.move('e7','e5',undefined,'helper',200);
  assert.deepEqual(game.uciMoves(), ['e2e4','e7e5']); assert.match(game.pgn(), /1\. e4 e5/);
});
test('castling moves the rook and en passant removes the captured pawn', () => {
  const castle = new ChessGame(log(), 0, 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  castle.move('e1','g1',undefined,'human',0); assert.equal(castle.board.get('f1').type,'r'); assert.equal(castle.board.get('h1'),undefined);
  const ep = new ChessGame(log(),0,'4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
  ep.move('e5','d6',undefined,'human',0); assert.equal(ep.board.get('d5'),undefined);
});
test('all four promotion choices are supported', () => {
  for (const piece of ['q','r','b','n']) {
    const game = new ChessGame(log(),0,'4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
    game.move('a7','a8',piece,'human',0); assert.equal(game.board.get('a8').type,piece);
  }
});
test('checkmate records human loss and the correct PGN result', () => {
  const game = new ChessGame(log(),0);
  for (const [from,to,actor] of [['f2','f3','human'],['e7','e5','helper'],['g2','g4','human'],['d8','h4','helper']]) game.move(from,to,undefined,actor,0);
  assert.equal(game.outcome,'loss'); assert.match(game.pgn(), /0-1/); assert.equal(moveReaction(game,game.board.history({verbose:true}).at(-1)),'win');
});
test('stalemate and repetition are draws', () => {
  const stale = new ChessGame(log(),0,'k7/8/1QK5/8/8/8/8/8 w - - 0 1');
  stale.move('b6','c7',undefined,'human',0); assert.equal(stale.outcome,'draw'); assert.equal(stale.reason,'Stalemate');
  const repeat = new ChessGame(log(),0);
  for (let i=0;i<2;i++) for (const [from,to,actor] of [['g1','f3','human'],['g8','f6','helper'],['f3','g1','human'],['f6','g8','helper']]) repeat.move(from,to,undefined,actor,0);
  assert.equal(repeat.outcome,'draw'); assert.equal(repeat.reason,'Threefold repetition');
});
test('timer charges the correct side, adds increment and flags before a late move', () => {
  const game = new ChessGame(log({ minutes:1, increment:2 }),0);
  game.move('e2','e4',undefined,'human',5000); assert.equal(game.remaining.w,57000);
  game.tick(6000); assert.equal(game.remaining.b,59000);
  game.move('e7','e5',undefined,'helper',7000); assert.equal(game.remaining.b,60000);
  game.tick(64000); assert.equal(game.outcome,'loss'); assert.equal(game.move('d2','d4',undefined,'human',64001),null);
});
test('timeouts against a bare king are draws and pause/resume does not charge paused time', () => {
  const game = new ChessGame(log({minutes:1}),0,'4k3/8/8/8/8/8/8/R3K3 w - - 0 1');
  game.tick(60000); assert.equal(game.outcome,'draw');
  const paused = new ChessGame(log({minutes:1}),0); paused.pause(1000); paused.tick(50000); paused.resume(51000); paused.tick(52000); assert.equal(paused.remaining.w,58000);
});
test('beginner weakening selects only legal moves; native strength keeps the engine move', () => {
  const legal = ['e2e4','d2d4']; let values = [0,0.9];
  assert.equal(chooseMove(200,'e2e4',legal,()=>values.shift()),'d2d4');
  assert.equal(chooseMove(1500,'e2e4',legal,()=>0),'e2e4'); assert.throws(()=>chooseMove(200,'a1a8',legal));
});
test('calm checked reaction, energetic jumping and reduced motion expire cleanly', () => {
  const effect = new ChessMascot(); effect.start('checked',1,0); assert.equal(effect.frame(250,false).art,'staring'); assert.ok(effect.frame(250,false).y<0);
  effect.start('win',3,1000); assert.ok(effect.frame(1050,false).y<0); assert.equal(effect.frame(1050,true).y,0); assert.equal(effect.frame(1050,true).scale,1);
  assert.equal(effect.frame(3400,false).active,false); assert.equal(clockText(61001),'1:02');
  effect.start('win',3,4000); effect.reset(); assert.equal(effect.frame(4050,false).active,false);
});
