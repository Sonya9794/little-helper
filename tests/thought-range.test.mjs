import test from 'node:test';
import assert from 'node:assert/strict';
import {rangeMinute,rangeHandle,moveThoughtHandle} from '../src/thought-range-model.ts';
test('one track maps endpoints and integer minutes to the requested 1–30 range',()=>{
  assert.equal(rangeMinute(10,10,290),1);assert.equal(rangeMinute(300,10,290),30);assert.equal(rangeMinute(70,10,290),7);assert.equal(rangeMinute(-100,10,290),1);assert.equal(rangeMinute(900,10,290),30);
});
test('minimum and maximum handles meet without crossing',()=>{
  assert.deepEqual(moveThoughtHandle(3,10,'min',15),[10,10]);assert.deepEqual(moveThoughtHandle(3,10,'max',1),[3,3]);
  assert.deepEqual(moveThoughtHandle(3,10,'min',1),[1,10]);assert.deepEqual(moveThoughtHandle(3,10,'max',30),[3,30]);
});
test('overlapped handles separate toward the drag direction',()=>{
  assert.equal(rangeHandle(7,7,7),null);assert.equal(rangeHandle(7,7,7,-2),'min');assert.equal(rangeHandle(7,7,7,2),'max');
  assert.equal(rangeHandle(3,7,7),'min');assert.equal(rangeHandle(20,7,7),'max');assert.equal(rangeHandle(4,3,10),'min');assert.equal(rangeHandle(9,3,10),'max');
});
