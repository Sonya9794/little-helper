import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Stockfish } from '../src/chess-engine.ts';
const require = createRequire(import.meta.url);
test('real bundled Stockfish worker protocol initializes and finds a legal mate', { timeout: 20000 }, async () => {
  let port;
  const native = require('stockfish')('lite-single',line=>port?.onmessage?.({data:line}));
  port = { onmessage:null,onerror:null,postMessage:command=>native.processCommand(command),terminate:()=>native.terminate() };
  const engine = new Stockfish(port);
  try {
    await engine.ready();
    assert.equal(await engine.bestMove(['f2f3','e7e5','g2g4'],3190),'d8h4');
    assert.match(await engine.bestMove([],200),/^[a-h][1-8][a-h][1-8][qrbn]?$/);
    await assert.rejects(engine.bestMove(['quit\nuci'],800), /Invalid/);
  } finally { engine.terminate(); }
});
