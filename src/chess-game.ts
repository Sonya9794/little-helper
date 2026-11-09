import { Chess, type Color, type Square, type PieceSymbol, type Move } from 'chess.js';
import type { GameLog, Outcome, ReactionKind } from './chess-api';

export class ChessGame {
  readonly board: Chess;
  readonly log: GameLog;
  readonly human: Color;
  remaining: Record<Color, number>;
  outcome: Outcome = 'in_progress';
  reason = '';
  private last: number;
  private paused = false;
  constructor(log: GameLog, now: number, fen?: string) {
    this.log = log; this.board = new Chess(fen); this.human = log.options.player === 'white' ? 'w' : 'b';
    this.remaining = { w: log.options.minutes * 60_000, b: log.options.minutes * 60_000 }; this.last = now;
    this.board.setHeader('Event', 'Little Helper'); this.board.setHeader('Date', log.started_at.slice(0, 10).replaceAll('-', '.'));
    this.board.setHeader('White', this.human === 'w' ? 'You' : 'Little Helper'); this.board.setHeader('Black', this.human === 'b' ? 'You' : 'Little Helper');
    this.board.setHeader('HelperElo', String(log.elo)); this.board.setHeader('TimeControl', log.options.minutes ? `${log.options.minutes * 60}+${log.options.increment}` : '-');
    this.board.setHeader('Result', '*');
  }
  tick(now: number): void {
    const elapsed = Math.max(0, now - this.last); this.last = now;
    if (this.paused || this.outcome !== 'in_progress' || !this.log.options.minutes) return;
    const turn = this.board.turn(); this.remaining[turn] = Math.max(0, this.remaining[turn] - elapsed);
    if (this.remaining[turn] === 0) {
      const opponent = turn === 'w' ? 'b' : 'w';
      const canMate = this.board.board().flat().some(piece => piece?.color === opponent && piece.type !== 'k');
      this.end(canMate ? (turn === this.human ? 'loss' : 'win') : 'draw', canMate ? 'Time expired' : 'Time expired; opponent has only a king');
    }
  }
  pause(now: number): void { this.tick(now); this.paused = true; }
  resume(now: number): void { this.last = now; this.paused = false; }
  move(from: Square, to: Square, promotion: PieceSymbol | undefined, actor: 'human' | 'helper', now: number): Move | null {
    this.tick(now); if (this.outcome !== 'in_progress') return null;
    if (this.paused) throw new Error('The game is paused. Retry before playing.');
    if ((this.board.turn() === this.human) !== (actor === 'human')) throw new Error('It is not your turn.');
    const color = this.board.turn(); const move = this.board.move({ from, to, ...(promotion ? { promotion } : {}) });
    if (this.log.options.minutes) this.remaining[color] += this.log.options.increment * 1000;
    if (this.board.isCheckmate()) this.end(this.board.turn() === this.human ? 'loss' : 'win', 'Checkmate');
    else if (this.board.isStalemate()) this.end('draw', 'Stalemate');
    else if (this.board.isInsufficientMaterial()) this.end('draw', 'Insufficient material');
    else if (this.board.isThreefoldRepetition()) this.end('draw', 'Threefold repetition');
    else if (this.board.isDraw()) this.end('draw', 'Fifty-move rule');
    return move;
  }
  end(outcome: Exclude<Outcome, 'in_progress'>, reason: string): void {
    if (this.outcome !== 'in_progress') return;
    this.outcome = outcome; this.reason = reason;
    const humanWon = outcome === 'win';
    const result = outcome === 'draw' ? '1/2-1/2' : outcome === 'aborted' ? '*' : (humanWon === (this.human === 'w') ? '1-0' : '0-1');
    this.board.setHeader('Result', result); this.board.setHeader('Termination', reason);
  }
  pgn(): string { return this.board.pgn({ maxWidth: 80 }); }
  uciMoves(): string[] { return this.board.history({ verbose: true }).map(move => `${move.from}${move.to}${move.promotion ?? ''}`); }
}

export function chooseMove(elo: number, best: string, legal: string[], random = Math.random): string {
  if (!legal.includes(best)) throw new Error('Stockfish returned an illegal move.');
  // Deliberate weakening, not a claim of calibrated sub-1320 engine strength.
  const chance = Math.max(0, (1320 - elo) / 1120) * 0.65;
  if (chance && random() < chance) return legal[Math.min(legal.length - 1, Math.floor(random() * legal.length))];
  return best;
}
export function moveReaction(game: ChessGame, move: Move): ReactionKind | null {
  if (game.outcome === 'win') return 'loss';
  if (game.outcome === 'loss') return 'win';
  if (game.outcome === 'draw') return 'draw';
  if (game.board.isCheck()) return game.board.turn() === game.human ? 'checking' : 'checked';
  if (move.captured) return move.color === game.human ? 'player_capture' : 'capture';
  return null;
}
export function clockText(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
