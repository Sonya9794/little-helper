import test from 'node:test';
import assert from 'node:assert/strict';
import { MascotReaction, QUIET_MS, STARE_MS, ESCALATE_MS } from '../src/mascot-reaction.ts';

function wiggle(reaction, interval = 30) {
  for (let i = 0; i < 6; i++) reaction.move(i % 2 ? 18 : -18, 0, i * interval);
  return 5 * interval;
}
test('fast back-and-forth movement triggers a bounded in-place shake', () => {
  const reaction = new MascotReaction(); const end = wiggle(reaction);
  const frame = reaction.frame(end, false);
  assert.equal(frame.pose, 'shaking'); assert.ok(Math.abs(frame.x) <= 2);
});
test('fast small circles also trigger the reaction', () => {
  const reaction = new MascotReaction();
  for (let i = 0; i <= 16; i++) {
    const angle = i * Math.PI / 8;
    reaction.move(12 * Math.cos(angle), 12 * Math.sin(angle), i * 12);
  }
  assert.equal(reaction.frame(192, false).pose, 'shaking');
});
test('ordinary straight movement and slow wiggling do not trigger', () => {
  const straight = new MascotReaction();
  for (let i = 0; i < 15; i++) straight.move(i * 12, 10, i * 15);
  assert.equal(straight.frame(220, false).pose, 'idle');
  const slow = new MascotReaction(); const end = wiggle(slow, 250);
  assert.equal(slow.frame(end, false).pose, 'idle');
});
test('stopping settles into a stationary stare for one second then restores', () => {
  const reaction = new MascotReaction(); const end = wiggle(reaction);
  assert.equal(reaction.frame(end + QUIET_MS - 1, false).pose, 'shaking');
  assert.equal(reaction.frame(end + QUIET_MS, false).pose, 'staring');
  assert.equal(reaction.frame(end + QUIET_MS + STARE_MS - 1, false).pose, 'staring');
  assert.equal(reaction.frame(end + QUIET_MS, false).x, 0);
  assert.equal(reaction.frame(end + QUIET_MS + STARE_MS, false).pose, 'idle');
});
test('stationary pointer noise cannot prolong shaking', () => {
  const reaction = new MascotReaction(); const end = wiggle(reaction);
  for (let i = 1; i < 15; i++) reaction.move(18 + i % 2, 0, end + i * 15);
  assert.equal(reaction.frame(end + 210, false).pose, 'staring');
});
test('click or drag reset clears both reaction and earlier movement samples', () => {
  const reaction = new MascotReaction(); const end = wiggle(reaction);
  reaction.reset(); reaction.move(0, 0, end + 1);
  assert.equal(reaction.frame(end + 1, false).pose, 'idle');
});
test('reduced motion preserves the expression timing with no shaking displacement', () => {
  const reaction = new MascotReaction(); const end = wiggle(reaction);
  assert.equal(reaction.frame(end, true).x, 0);
  assert.equal(reaction.frame(end + QUIET_MS, true).pose, 'staring');
});

function sustained(reaction, end, start = 0, interval = 30) {
  for (let i = 0; start + i * interval <= end; i++) reaction.move(i % 2 ? 18 : -18, 0, start + i * interval);
}
test('escalates only after more than two seconds of sustained shaking', () => {
  const reaction = new MascotReaction();
  const detectedAt = 30;
  sustained(reaction, detectedAt + ESCALATE_MS, 0, 10);
  assert.equal(reaction.frame(detectedAt + ESCALATE_MS, false).angry, false);
  reaction.move(-18, 0, detectedAt + ESCALATE_MS + 10);
  assert.equal(reaction.frame(detectedAt + ESCALATE_MS + 10, false).angry, true);
});
test('intense motion has bounded horizontal, vertical and rotational movement inside the canvas', () => {
  const reaction = new MascotReaction(); sustained(reaction, 3300);
  let largestX = 0, largestY = 0, largestRotation = 0;
  for (let now = 3300; now < 3300 + QUIET_MS; now++) {
    const frame = reaction.frame(now, false);
    largestX = Math.max(largestX, Math.abs(frame.x)); largestY = Math.max(largestY, Math.abs(frame.y));
    largestRotation = Math.max(largestRotation, Math.abs(frame.rotation));
    assert.ok(Math.abs(frame.x) <= 9 && Math.abs(frame.y) <= 6 && Math.abs(frame.rotation) <= 0.09);
    // Conservative artwork bounds include the outer strokes of leaves and feet.
    for (const x of [17.5, 110.5]) for (const y of [4, 123]) {
      const dx = (x - 64) * frame.scale, dy = (y - 64) * frame.scale;
      const px = 64 + frame.x + dx * Math.cos(frame.rotation) - dy * Math.sin(frame.rotation);
      const py = 64 + frame.y + dx * Math.sin(frame.rotation) + dy * Math.cos(frame.rotation);
      assert.ok(px >= 0 && px <= 128 && py >= 0 && py <= 128);
    }
  }
  assert.ok(largestX > 8 && largestY > 5 && largestRotation > 0.08);
});
test('angry stare lasts one second plus 0.8 times actual violent shaking time', () => {
  const reaction = new MascotReaction(); sustained(reaction, 3300);
  const now = 3300 + QUIET_MS;
  const frame = reaction.frame(now, false);
  assert.equal(frame.pose, 'staring'); assert.equal(frame.angry, true);
  assert.equal(frame.x, 0); assert.equal(frame.y, 0); assert.equal(frame.rotation, 0); assert.equal(frame.scale, 1);
  const violentStarted=2100;const duration=STARE_MS+0.8*(now-violentStarted);
  assert.equal(frame.until,now+duration);
  assert.equal(reaction.frame(frame.until-1,false).pose,'staring');
  assert.equal(reaction.frame(frame.until,false).pose,'idle');
});
test('longer violent bouts scale anger proportionally without extending during the stare',()=>{
  const a=new MascotReaction(),b=new MascotReaction();sustained(a,3300);sustained(b,6000);
  const aEnd=3300+QUIET_MS,bEnd=6000+QUIET_MS;
  const first=a.frame(aEnd,false),second=b.frame(bEnd,false);
  assert.equal((second.until-bEnd)-(first.until-aEnd),0.8*(6000-3300));
  assert.equal(b.frame(bEnd+500,false).until,second.until);
  assert.equal(b.frame(bEnd,true).until,second.until);
});
test('reset clears a prolonged angry stare and a new short bout gets the normal stare',()=>{
  const r=new MascotReaction();sustained(r,6000);assert.ok(r.frame(6000+QUIET_MS,false).until>8000);
  r.reset();assert.equal(r.frame(6200,false).pose,'idle');sustained(r,6800,6500);
  const end=6800+QUIET_MS;assert.equal(r.frame(end,false).angry,false);assert.equal(r.frame(end,false).until,end+STARE_MS);
});
test('separate short bouts do not accumulate toward escalation', () => {
  const reaction = new MascotReaction();
  sustained(reaction, 1800); sustained(reaction, 4000, 2200);
  assert.equal(reaction.frame(4000, false).angry, false);
});
test('reset clears escalation and reduced motion suppresses all intense transforms', () => {
  const reaction = new MascotReaction(); sustained(reaction, 3300);
  const frame = reaction.frame(3300, true);
  assert.equal(frame.x, 0); assert.equal(frame.y, 0); assert.equal(frame.rotation, 0); assert.equal(frame.scale, 1);
  assert.equal(reaction.frame(3300 + QUIET_MS, true).angry, true);
  reaction.reset(); sustained(reaction, 4000, 3700);
  assert.equal(reaction.frame(4000, false).angry, false);
});
