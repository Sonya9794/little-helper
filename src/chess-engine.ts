export interface EnginePort {
  postMessage(message: string): void; terminate(): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: { message?: string }) => void) | null;
}
export class Stockfish {
  private port: EnginePort;
  private pending: { match: (line: string) => boolean; resolve: (line: string) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> } | null = null;
  private initialized: Promise<void> | null = null;
  private stopped = false;
  constructor(port?: EnginePort) {
    this.port = port ?? new Worker('/engine/stockfish-19-lite-single.js') as unknown as EnginePort;
    this.port.onmessage = event => { for (const line of String(event.data).split('\n')) {
      const pending = this.pending;
      if (pending?.match(line.trim())) { this.pending = null; clearTimeout(pending.timer); pending.resolve(line.trim()); }
    } };
    this.port.onerror = event => { this.fail(new Error(event.message ?? 'The local chess engine failed to load.')); };
  }
  private fail(error: Error): void { const pending = this.pending; this.pending = null; if (pending) { clearTimeout(pending.timer); pending.reject(error); } }
  private wait(match: (line: string) => boolean, command: string, timeout = 15_000): Promise<string> {
    if (this.stopped) return Promise.reject(new Error('The chess engine was stopped.'));
    if (this.pending) return Promise.reject(new Error('The chess engine is still thinking.'));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.fail(new Error('The local chess engine did not respond. Retry the engine.')); }, timeout);
      this.pending = { match, resolve, reject, timer }; this.port.postMessage(command);
    });
  }
  ready(): Promise<void> {
    return this.initialized ??= (async () => {
      await this.wait(line => line === 'uciok', 'uci');
      this.port.postMessage('setoption name Hash value 16'); this.port.postMessage('ucinewgame');
      await this.wait(line => line === 'readyok', 'isready');
    })();
  }
  async bestMove(moves: string[], elo: number): Promise<string> {
    await this.ready();
    if (moves.some(move => !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)) || !Number.isInteger(elo) || elo < 200 || elo > 3190) throw new Error('Invalid chess engine request.');
    this.port.postMessage(`setoption name UCI_LimitStrength value ${elo >= 1320}`);
    this.port.postMessage(elo >= 1320 ? `setoption name UCI_Elo value ${elo}` : 'setoption name Skill Level value 0');
    this.port.postMessage(`position startpos${moves.length ? ` moves ${moves.join(' ')}` : ''}`);
    const line = await this.wait(line => line.startsWith('bestmove '), 'go movetime 400');
    const move = line.split(/\s+/)[1]; if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)) throw new Error('The chess engine returned no playable move.');
    return move;
  }
  terminate(): void { this.stopped = true; this.fail(new Error('The chess engine was stopped.')); this.port.terminate(); }
}
