import test from 'node:test';
import assert from 'node:assert/strict';
import {thoughtLayout} from '../src/thought-layout.ts';
test('short thought hugs measured text and Pop instead of a fixed tall panel',()=>{
  const layout=thoughtLayout(150,18,40,25);
  assert.equal(layout.width,194);assert.equal(layout.height,101);
  assert.equal(layout.popY-(layout.textY+18),6);
  assert.equal(8+layout.bodyHeight-(layout.popY+25),10);
});
test('wrapped text grows only as needed, keeping Pop and tail within the cloud window',()=>{
  const short=thoughtLayout(236,36,40,25),long=thoughtLayout(236,54,40,25);
  assert.equal(short.width,280);assert.equal(long.height-short.height,18);
  for(const layout of [short,long]){
    assert.ok(layout.popX>=layout.textX);assert.ok(layout.popX+40<=layout.width-22);
    assert.equal(layout.height-(8+layout.bodyHeight),24);
    assert.ok(layout.height<=224);
  }
});
test('invalid measurements are rejected and narrow content retains usable minimum width',()=>{
  assert.equal(thoughtLayout(20,18,40,25).width,120);
  for(const n of [-1,NaN,Infinity])assert.throws(()=>thoughtLayout(n,18,40,25));
});
