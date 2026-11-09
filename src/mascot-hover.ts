// A short, one-shot hop. Keep its top inside the placeholder's transparent margin.
export const HOP_MS = 280;
export class MascotHover {
  private started = -Infinity;
  private hovered = false;
  private dismissed = false;
  enter(now: number, reducedMotion: boolean): void {
    this.hovered = true;
    // Mask movement can cause pointer leave/enter at the edge of the artwork.
    // Ignore those re-entries until the hop and a short settling period end.
    if (now - this.started < HOP_MS + 150) return;
    this.dismissed = false;
    this.started = reducedMotion ? -Infinity : now;
  }
  leave(): void { this.hovered = false; }
  activate(): void { this.dismissed = true; }
  reset(): void {
    this.started = -Infinity;
    this.hovered = false;
    this.dismissed = false;
  }
  frame(now: number): { offset: number; excited: boolean; moving: boolean } {
    const elapsed = now - this.started;
    const moving = elapsed >= 0 && elapsed < HOP_MS;
    return {
      offset: moving ? -4 * Math.sin(Math.PI * elapsed / HOP_MS) : 0,
      excited: !this.dismissed && (this.hovered || moving),
      moving,
    };
  }
}
