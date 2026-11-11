import test from 'node:test';
import assert from 'node:assert/strict';
import {THOUGHTS,thoughtPool,chooseThought} from '../src/thought-model.ts';
const settings={version:1,enabled:true,jokes:true,facts:true,motivation:true};
test('off and all categories off produce no thoughts',()=>{
  assert.deepEqual(thoughtPool({...settings,enabled:false}),[]);
  assert.deepEqual(thoughtPool({...settings,jokes:false,facts:false,motivation:false}),[]);
  assert.equal(chooseThought({...settings,enabled:false},0.5),null);
});
test('each toggle includes only its selected offline content',()=>{
  for(let mask=0;mask<8;mask++){
    const s={...settings,jokes:!!(mask&1),facts:!!(mask&2),motivation:!!(mask&4)};
    const expected=[...(s.jokes?THOUGHTS.jokes:[]),...(s.facts?THOUGHTS.facts:[]),...(s.motivation?THOUGHTS.motivation:[])];
    assert.deepEqual(thoughtPool(s),expected);
  }
});
test('random messages come from enabled content and fit a compact bubble',()=>{
  const pool=thoughtPool(settings);assert.equal(pool.length,30);assert.equal(new Set(pool).size,30);
  for(const text of pool)assert.ok(text.trim()===text&&text.length>0&&text.length<=150);
  assert.equal(chooseThought(settings,0),pool[0]);assert.equal(chooseThought(settings,1-Number.EPSILON),pool.at(-1));
  assert.throws(()=>chooseThought(settings,1));
});
