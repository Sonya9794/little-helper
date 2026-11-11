type Point = { x: number; y: number; time: number };
export const QUIET_MS = 140;
export const STARE_MS = 1000;
export const ESCALATE_MS = 2000;
// Only samples delivered to the mascot are used; no global mouse tracking.
export class MascotReaction {
  private points: Point[] = [];
  private shakeUntil = -Infinity;
  private stareUntil = -Infinity;
  private shakeStarted = -Infinity;
  private lastGesture = -Infinity;
  private intense = false;
  private violentStarted = -Infinity;

  move(x: number, y: number, now: number): void {
    let previous = this.points.at(-1);
    if (previous && now - previous.time > 180) {
      this.points = []; previous = undefined;
    }
    if (previous && Math.hypot(x - previous.x, y - previous.y) < 2.5) return;
    this.points.push({ x, y, time: now });
    this.points = this.points.filter(point => now - point.time <= 450).slice(-80);
    let distance = 0, turn = 0;
    let direction: number | undefined;
    for (let i = 1; i < this.points.length; i++) {
      const a = this.points[i - 1], b = this.points[i];
      const dx = b.x - a.x, dy = b.y - a.y;
      distance += Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      if (direction !== undefined) turn += Math.abs(Math.atan2(Math.sin(angle - direction), Math.cos(angle - direction)));
      direction = angle;
    }
    const elapsed = now - this.points[0].time;
    const gesture = elapsed > 0 && distance >= 60 && distance / elapsed >= 0.25 && turn >= Math.PI * 1.2;
    if (gesture || now < this.shakeUntil) {
      if (now >= this.shakeUntil) {
        this.shakeStarted = now;
        this.intense = false;
        this.violentStarted = -Infinity;
      } else if (now - this.lastGesture > QUIET_MS) {
        // Ordinary movement between wiggles does not count toward escalation.
        this.shakeStarted = now;
      }
      if (gesture) {
        this.lastGesture = now;
        if (!this.intense && now - this.shakeStarted > ESCALATE_MS) {
          this.intense = true; this.violentStarted = now;
        }
      }
      this.shakeUntil = now + QUIET_MS;
      const violentDuration = this.intense ? Math.max(0,this.shakeUntil-this.violentStarted) : 0;
      this.stareUntil = this.shakeUntil + STARE_MS + 0.8*violentDuration;
    }
  }
  reset(): void {
    this.points = []; this.shakeUntil = -Infinity; this.stareUntil = -Infinity;
    this.shakeStarted = -Infinity; this.lastGesture = -Infinity; this.intense = false; this.violentStarted = -Infinity;
  }
  frame(now: number, reducedMotion: boolean): { pose: 'idle' | 'shaking' | 'staring'; x: number; y: number; rotation: number; scale: number; angry: boolean; until: number } {
    const still = { x: 0, y: 0, rotation: 0, scale: 1 };
    if (now < this.shakeUntil) {
      const motion = reducedMotion ? still : this.intense ? {
        x: 9 * Math.sin(now * Math.PI * 2 / 55),
        y: 6 * Math.sin(now * Math.PI * 2 / 71),
        rotation: 0.09 * Math.sin(now * Math.PI * 2 / 93),
        // Leave room for the stronger motion without clipping the artwork.
        scale: 0.9,
      } : { ...still, x: 2 * Math.sin(now * Math.PI * 2 / 80) };
      return { pose: 'shaking', ...motion, angry: this.intense, until: this.shakeUntil };
    }
    if (now < this.stareUntil) return { pose: 'staring', ...still, angry: this.intense, until: this.stareUntil };
    return { pose: 'idle', ...still, angry: false, until: 0 };
  }
}
