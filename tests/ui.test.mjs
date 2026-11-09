import test from 'node:test';
import assert from 'node:assert/strict';
import { QUOTES, randomQuote } from '../src/motivation.ts';
import { choiceLayout, overlaps } from '../src/choice-layout.ts';
test('motivation includes exactly 20 unique nonempty local quotes', () => {
  assert.equal(QUOTES.length, 20); assert.equal(new Set(QUOTES).size, 20);
  assert.ok(QUOTES.every(q => q.trim().length > 0));
  assert.equal(randomQuote(() => 0), QUOTES[0]); assert.equal(randomQuote(() => 0.999999), QUOTES[19]);
});
for (const count of [3, 5]) {
  for (const [name, x, y] of [['center',210,101],['top left',0,0],['top right',420,0],['bottom left',0,202],['bottom right',420,202]]) {
    test(`${count} choices fit ${name}, without covering mascot or each other`, () => {
      const mascot = { x, y, width:132, height:128 }; const rects = choiceLayout(552,330,mascot,count);
      assert.equal(rects.length,count);
      rects.forEach((r,i) => {
        assert.ok(r.x >= 0 && r.y >= 0 && r.x+r.width <= 552.01 && r.y+r.height <= 330.01);
        assert.ok(!overlaps(r,mascot));
        assert.ok(rects.every((other,j) => i===j || !overlaps(r,other)));
      });
    });
  }
}
