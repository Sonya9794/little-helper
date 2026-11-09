import type { ReactionKind } from './chess-api';
export class ChessMascot {
  private started = -Infinity;
  private until = 0;
  private kind: ReactionKind = 'draw';
  private energy = 1;
  start(kind: ReactionKind, energy: number, now: number): void {
    this.kind = kind; this.energy = energy; this.started = now;
    this.until = energy === 1 && ['capture', 'player_capture', 'checking'].includes(kind) ? 0 : now + (energy === 3 ? 2400 : energy === 2 ? 1400 : 1000);
  }
  reset(): void { this.until = 0; }
  frame(now: number, reduced: boolean): { active: boolean; art: 'excited' | 'staring' | 'angry'; y: number; scale: number; moving: boolean; until: number } {
    const active = now < this.until;
    const canJump = this.energy > 1 || this.kind === 'checked';
    const moving = active && canJump && !reduced;
    const period = this.energy === 3 ? 280 : this.energy === 2 ? 500 : 1000;
    const elapsed = now - this.started;
    return { active, art: this.kind === 'loss' ? 'angry' : this.kind === 'checked' || this.kind === 'draw' ? 'staring' : 'excited',
      y: moving ? -(this.energy === 3 ? 6 : 3.5) * Math.max(0, Math.sin(elapsed * Math.PI * 2 / period)) : 0,
      scale: moving && this.energy === 3 ? 0.9 : 1, moving, until: this.until };
  }
}
