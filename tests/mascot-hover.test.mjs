import test from 'node:test';
import assert from 'node:assert/strict';
import { MascotHover, HOP_MS } from '../src/mascot-hover.ts';

test('hover hops up and lands once, keeping the excited face while hovered', () => {
  const hover = new MascotHover();
  assert.deepEqual(hover.frame(0), { offset: 0, excited: false, moving: false });
  hover.enter(0, false);
  assert.equal(hover.frame(HOP_MS / 2).offset, -4);
  assert.deepEqual(hover.frame(HOP_MS), { offset: 0, excited: true, moving: false });
  assert.equal(hover.frame(5000).offset, 0);
  hover.leave();
  assert.equal(hover.frame(5000).excited, false);
});
test('leaving during a hop keeps the face through landing and then restores it', () => {
  const hover = new MascotHover(); hover.enter(0, false); hover.leave();
  assert.equal(hover.frame(100).excited, true);
  assert.equal(hover.frame(HOP_MS).excited, false);
});
test('click dismisses excitement immediately without restarting the hop', () => {
  const hover = new MascotHover(); hover.enter(0, false); hover.activate();
  assert.equal(hover.frame(100).excited, false);
  assert.equal(hover.frame(HOP_MS).excited, false);
  hover.leave(); hover.enter(1000, false);
  assert.equal(hover.frame(1100).excited, true);
});
test('moving alpha edges cannot continually retrigger the hop', () => {
  const hover = new MascotHover(); hover.enter(0, false);
  hover.leave(); hover.enter(HOP_MS - 10, false);
  hover.leave(); hover.enter(HOP_MS + 10, false);
  assert.equal(hover.frame(HOP_MS + 10).moving, false);
  assert.equal(hover.frame(HOP_MS + 10).offset, 0);
});
test('reduced motion changes the face without moving the mascot', () => {
  const hover = new MascotHover(); hover.enter(100, true);
  assert.deepEqual(hover.frame(100), { offset: 0, excited: true, moving: false });
  hover.leave(); assert.equal(hover.frame(101).excited, false);
});
test('native drag clears click dismissal and cooldown for the next hover', () => {
  const hover = new MascotHover();
  hover.enter(0, false); hover.activate();
  hover.reset(); // Native drag can finish without a frontend pointerup.
  assert.deepEqual(hover.frame(100), { offset: 0, excited: false, moving: false });
  hover.leave(); hover.enter(120, false);
  assert.equal(hover.frame(120 + HOP_MS / 2).offset, -4);
  assert.equal(hover.frame(120 + HOP_MS / 2).excited, true);
});
