import test from 'node:test';
import assert from 'node:assert/strict';
import { QUOTES, randomQuote } from '../src/motivation.ts';
import { choiceLayout, overlaps } from '../src/choice-layout.ts';
test('motivation includes exactly 20 unique nonempty local quotes', () => {
  assert.equal(QUOTES.length, 20); assert.equal(new Set(QUOTES).size, 20);
  assert.ok(QUOTES.every(q => q.trim().length > 0));
  assert.equal(randomQuote(() => 0), QUOTES[0]); assert.equal(randomQuote(() => 0.999999), QUOTES[19]);
});
for (const count of [3, 4, 5, 6]) {
  for (const [name, x, y] of [['center',210,101],['top left',0,0],['top right',420,0],['bottom left',0,202],['bottom right',420,202]]) {
    test(`${count} choices fit ${name}, without covering mascot or each other`, () => {
      const mascot = { x, y, width:132, height:128 }; const rects = choiceLayout(552,330,mascot,count);
      assert.equal(rects.length,count);
      if (name === 'center' && count >= 4) {
        assert.ok(rects.some(r => r.x + r.width <= mascot.x) && rects.some(r => r.x >= mascot.x + mascot.width), 'choices should occupy both sides');
        assert.ok(rects.some(r => r.y + r.height <= mascot.y) && rects.some(r => r.y >= mascot.y + mascot.height), 'choices should occupy space above and below');
      }
      rects.forEach((r,i) => {
        assert.ok(r.x >= 0 && r.y >= 0 && r.x+r.width <= 552.01 && r.y+r.height <= 330.01);
        assert.ok(!overlaps(r,mascot));
        assert.ok(rects.every((other,j) => i===j || !overlaps(r,other)));
      });
    });
  }
}
for (const count of [4, 6]) {
  test(`${count} choices remain distributed with native border and DPI rounding offsets`, () => {
    for (const dx of [-4, 0, 4]) for (const dy of [-4, 0, 4]) {
      const mascot = { x: 210 + dx, y: 101 + dy, width: 132, height: 128 };
      const rects = choiceLayout(552,330,mascot,count);
      assert.ok(rects.some(r=>r.x+r.width<=mascot.x) && rects.some(r=>r.x>=mascot.x+mascot.width));
      assert.ok(rects.some(r=>r.y+r.height<=mascot.y) && rects.some(r=>r.y>=mascot.y+mascot.height));
    }
  });
}
