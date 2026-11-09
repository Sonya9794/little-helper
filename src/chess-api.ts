export type RatingMode = 'adaptive' | 'preset';
export interface ChessSettings { mode: RatingMode; adaptive_elo: number; preset_elo: number; win_step: number; loss_step: number }
export interface ChessOptions { player: 'white' | 'black'; minutes: number; increment: number; energy: number }
export type Outcome = 'in_progress' | 'win' | 'loss' | 'draw' | 'aborted';
export interface GameLog { id: number; started_at: string; finished_at: string | null; elo: number; adaptive: boolean; win_step: number; loss_step: number; options: ChessOptions; outcome: Outcome; pgn: string }
export interface ChessStore { settings: ChessSettings; games: GameLog[] }
export function targetElo(settings: ChessSettings): number { return settings.mode === 'adaptive' ? settings.adaptive_elo : settings.preset_elo; }
export type ReactionKind = 'checked' | 'checking' | 'capture' | 'player_capture' | 'win' | 'loss' | 'draw';
