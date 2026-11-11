import { listen } from '@tauri-apps/api/event';
import { type Square, type PieceSymbol, type Move } from 'chess.js';
import { invoke, el, button } from './api';
import { type ChessStore, type ChessOptions, type ReactionKind, targetElo } from './chess-api';
import { ChessGame, chooseMove, moveReaction, clockText } from './chess-game';
import { Stockfish } from './chess-engine';

const names: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const glyphs: Record<string, string> = { wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙', bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟' };
const chatter: Record<ReactionKind, string[]> = {
  checked: ['Wait. That pointy piece is looking at me.', 'A tactical inconvenience. Definitely planned.'],
  checking: ['Knock knock. Your king has a visitor.', 'Your king seems popular today.'],
  capture: ['Thank you. I collect those.', 'That piece has joined my tiny collection.'],
  player_capture: ['I was emotionally attached to that one.', 'A bold donation from my army.'],
  win: ['Tiny mascot. Surprisingly large chess ego.', 'Good game. I shall be insufferable for four seconds.'],
  loss: ['Good game! My revenge arc starts after a snack.', 'You win. I am filing a tiny chess complaint.'],
  draw: ['Perfectly balanced. Like my two little feet.', 'A draw! We are both suspiciously brilliant.'],
};

export async function chessUI(root: HTMLElement): Promise<void> {
  document.body.classList.add('chess');
  let store: ChessStore | null = null, game: ChessGame | null = null, engine: Stockfish | null = null;
  let view: 'setup' | 'board' | 'logs' = 'setup';
  let selected: Square | null = null, focusSquare: Square = 'e2';
  let promotion: { from: Square; to: Square } | null = null;
  let busy = false, error = '', notice = '', editPending = false, finishedSaved = false;
  let completion: Promise<void> | null = null;
  let startGeneration = 0;
  let confirmation: 'resign' | 'abandon' | 'close' | null = null;
  let selectedLog: number | null = null;
  const options = { color: 'white' as 'white' | 'black' | 'random', minutes: 0, increment: 0, energy: 2, custom: false };

  async function load(): Promise<void> { store = await invoke<ChessStore>('chess_store'); }
  async function react(kind: ReactionKind): Promise<void> {
    if (!game) return;
    const energy = game.log.options.energy;
    notice = energy === 3 ? chatter[kind][Math.floor(Math.random() * chatter[kind].length)]
      : energy === 2 ? ({ checked: 'Oh! I am in check.', checking: 'Check!', capture: 'A little capture.', player_capture: 'Nice capture!', win: 'Good game!', loss: 'Well played!', draw: 'Good game. A draw!' }[kind])
      : ({ checked: 'Oh. Check.', checking: 'Check.', capture: '', player_capture: '', win: 'Good game.', loss: 'Well played.', draw: 'Good game.' }[kind]);
    await invoke('chess_react', { kind, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches });
  }
  async function complete(): Promise<void> {
    if (!game || game.outcome === 'in_progress' || finishedSaved) return;
    if (completion) return completion;
    const current = game; engine?.terminate(); engine = null;
    completion = (async () => {
      store = await invoke<ChessStore>('finish_chess', { id: current.log.id, outcome: current.outcome, pgn: current.pgn() });
      finishedSaved = true;
      confirmation = null;
      if (current.outcome !== 'aborted') await react(current.outcome === 'win' ? 'loss' : current.outcome === 'loss' ? 'win' : 'draw');
    })();
    try { await completion; } finally { completion = null; }
  }
  async function persist(move: Move): Promise<void> {
    if (!game) return;
    if (game.outcome !== 'in_progress') { await complete(); return; }
    await invoke('chess_progress', { id: game.log.id, pgn: game.pgn() });
    const kind = moveReaction(game, move); if (kind) await react(kind);
  }
  async function helperTurn(): Promise<void> {
    const current = game;
    if (!current || current.outcome !== 'in_progress' || current.board.turn() === current.human) return;
    engine ??= new Stockfish(); render();
    const best = await engine.bestMove(current.uciMoves(), current.log.elo);
    if (game !== current || current.outcome !== 'in_progress') return;
    const legal = current.board.moves({ verbose: true }).map(move => `${move.from}${move.to}${move.promotion ?? ''}`);
    const chosen = chooseMove(current.log.elo, best, legal);
    const move = current.move(chosen.slice(0, 2) as Square, chosen.slice(2, 4) as Square, chosen[4] as PieceSymbol | undefined, 'helper', Date.now());
    if (move) { focusSquare = move.to; await persist(move); }
    else await complete();
  }
  async function run(action: () => Promise<void>): Promise<void> {
    if (busy) return; busy = true; error = ''; render();
    try { await action(); }
    catch (cause) {
      if (game && game.outcome !== 'in_progress') {
        try { await complete(); } catch (saveError) { error = String(saveError); }
      } else { error = String(cause); game?.pause(Date.now()); }
    } finally { busy = false; render(); }
  }
  async function play(from: Square, to: Square, piece?: PieceSymbol): Promise<void> {
    await run(async () => {
      if (!game) return;
      const move = game.move(from, to, piece, 'human', Date.now()); selected = null; promotion = null;
      if (move) await persist(move); else await complete();
      render(); await helperTurn();
    });
  }
  function squareClick(square: Square): void {
    if (!game || busy || error || game.outcome !== 'in_progress' || game.board.turn() !== game.human) return;
    focusSquare = square;
    if (selected) {
      const moves = game.board.moves({ square: selected, verbose: true }).filter(move => move.to === square);
      if (moves.length) {
        if (moves.some(move => move.promotion)) { promotion = { from: selected, to: square }; render(); root.querySelector<HTMLButtonElement>('.promotion button')?.focus(); }
        else void play(selected, square);
        return;
      }
    }
    selected = game.board.get(square)?.color === game.human ? square : null;
    render(); root.querySelector<HTMLButtonElement>(`[data-square="${square}"]`)?.focus();
  }
  function action(text: string, handler: () => void, key?: string): HTMLButtonElement {
    const node = button(text, handler, key); node.disabled = busy; return node;
  }
  function renderSetup(): HTMLElement {
    const section = el('section', undefined, 'chess-setup'); section.append(el('h2', 'Play against Little Helper'));
    if (!store) return section;
    const difficulty = el('div', undefined, 'setup-difficulty');
    difficulty.append(el('h3', `Current Elo: ${targetElo(store.settings)}`), el('p', `${store.settings.mode === 'adaptive' ? 'Adaptive' : 'Preset'} · Practice difficulty estimate`, 'muted'),
      action('Edit', () => { editPending = true; render(); void invoke('open_detail', { page: 'prompt', text: 'chess' }).catch(cause => { error = String(cause); render(); }); }));
    if (editPending) difficulty.append(action('Refresh changes', () => { void run(async () => { await load(); editPending = false; }); }));
    section.append(difficulty);
    const form = el('form');
    const colors = el('fieldset'); colors.append(el('legend', 'Color you play as'));
    for (const value of ['white', 'random', 'black'] as const) {
      const label = el('label'); const radio = el('input'); radio.type = 'radio'; radio.name = 'player-color'; radio.value = value; radio.checked = options.color === value;
      radio.onchange = () => { options.color = value; }; label.append(radio, document.createTextNode(value[0].toUpperCase() + value.slice(1))); colors.append(label);
    }
    const timerLabel = el('label', 'Timer'); const timer = el('select');
    for (const [value, text] of [['0', 'Untimed'], ['1', '1 minute'], ['3', '3 minutes'], ['5', '5 minutes'], ['10', '10 minutes'], ['15', '15 minutes'], ['custom', 'Custom']]) {
      const option = el('option', text); option.value = value; timer.append(option);
    }
    timer.value = options.custom ? 'custom' : String(options.minutes);
    timer.onchange = () => { options.custom = timer.value === 'custom'; options.minutes = options.custom ? Math.max(1, options.minutes) : Number(timer.value); if (!options.minutes) options.increment = 0; render(); };
    timerLabel.append(timer);
    const timing = el('div', undefined, 'timer-options'); timing.append(timerLabel);
    const number = (label: string, value: number, min: number, max: number, change: (value: number) => void) => {
      const wrapper = el('label', label); const input = el('input'); input.type = 'number'; input.min = String(min); input.max = String(max); input.step = '1'; input.required = true; input.value = String(value); input.oninput = () => change(Number(input.value)); wrapper.append(input); return wrapper;
    };
    if (options.custom) timing.append(number('Minutes per player', options.minutes, 1, 180, value => { options.minutes = value; }));
    if (options.minutes) timing.append(number('Increment per move (seconds)', options.increment, 0, 60, value => { options.increment = value; }));
    const energyLabel = el('label', 'Helper energy'); const energy = el('input'); energy.type = 'range'; energy.min = '1'; energy.max = '3'; energy.step = '1'; energy.value = String(options.energy);
    const output = el('output', `${options.energy} · ${['', 'Calm', 'Playful', 'Very energetic'][options.energy]}`);
    energy.setAttribute('aria-label', 'Helper energy'); energy.setAttribute('aria-valuetext', output.value);
    energy.oninput = () => { options.energy = Number(energy.value); output.value = `${options.energy} · ${['', 'Calm', 'Playful', 'Very energetic'][options.energy]}`; energy.setAttribute('aria-valuetext', output.value); };
    energyLabel.append(energy, output);
    const logs = action('Recent game logs (last 5)', () => { void run(async () => { await load(); view = 'logs'; selectedLog = null; }); }); logs.type = 'button';
    const start = el('button', busy ? 'Loading local engine…' : 'Start game'); start.type = 'submit'; start.disabled = busy;
    form.onsubmit = event => { event.preventDefault(); void run(async () => {
      const generation = ++startGeneration;
      engine?.terminate(); const startingEngine = new Stockfish(); engine = startingEngine;
      try { await startingEngine.ready(); } catch (cause) { if (generation !== startGeneration) return; throw cause; }
      if (generation !== startGeneration) return;
      const player = options.color === 'random' ? (crypto.getRandomValues(new Uint8Array(1))[0] & 1 ? 'white' : 'black') : options.color;
      const config: ChessOptions = { player, minutes: options.minutes, increment: options.increment, energy: options.energy };
      const log = await invoke<import('./chess-api').GameLog>('begin_chess', { options: config });
      if (generation !== startGeneration) {
        const canceled = new ChessGame(log, Date.now()); canceled.end('aborted', 'Canceled before play');
        store = await invoke<ChessStore>('finish_chess', { id: log.id, outcome: 'aborted', pgn: canceled.pgn() }); return;
      }
      game = new ChessGame(log, Date.now()); completion = null; finishedSaved = false; selected = null; focusSquare = player === 'white' ? 'e2' : 'e7';
      view = 'board'; notice = 'Good luck. Let’s play!'; await invoke('chess_progress', { id: log.id, pgn: game.pgn() }); render(); await helperTurn();
    }); };
    form.append(colors, timing, energyLabel, logs, start); section.append(form,
      el('p', 'Stockfish 19 Lite runs locally. Below 1320, deliberate weaker moves provide beginner practice.', 'muted'));
    const about = el('details'); about.append(el('summary', 'Chess engine and licenses'));
    about.append(el('p', 'Stockfish.js 19.0.1 (GPLv3) and chess.js 1.4.0 (BSD-2-Clause). Little Helper’s own license decision is pending.', 'muted'));
    const licenseText = el('pre', '', 'pgn-log');
    for (const [title, file] of [['Engine license', 'Stockfish-GPL-3.0.txt'], ['Chess rules license', 'chess.js-BSD-2-Clause.txt'], ['Matching source information', 'SOURCES.txt']]) {
      const show = button(title, () => {
        void fetch(`/third-party/${file}`).then(response => { if (!response.ok) throw new Error('Could not read bundled license information.'); return response.text(); })
          .then(text => { licenseText.textContent = text; }).catch(cause => { licenseText.textContent = String(cause); });
      }); about.append(show);
    }
    about.append(licenseText); section.append(about);
    return section;
  }
  function renderBoard(): HTMLElement {
    const section = el('section', undefined, 'game-layout'); if (!game) return section;
    const current = game; const boardColumn = el('div');
    const turn = current.outcome === 'in_progress' ? (current.board.turn() === current.human ? 'Your turn' : 'Little Helper is thinking…') : ({ win: 'You win!', loss: 'Little Helper wins', draw: 'Draw', aborted: 'Game abandoned' }[current.outcome]);
    const status = el('h2', `${turn}${current.board.isCheck() && current.outcome === 'in_progress' ? ' · Check' : ''}`); status.setAttribute('role', 'status'); boardColumn.append(status);
    const clocks = el('div', undefined, 'chess-clocks');
    for (const color of ['w', 'b'] as const) { const clock = el('div'); clock.dataset.clock = color; clock.setAttribute('aria-live', 'off'); clocks.append(clock); }
    boardColumn.append(clocks);
    const board = el('div', undefined, 'chess-board'); board.setAttribute('role', 'grid'); board.setAttribute('aria-label', 'Chessboard. Use arrow keys and Enter or Space to choose a piece and destination.');
    const files = current.human === 'w' ? 'abcdefgh' : 'hgfedcba'; const ranks = current.human === 'w' ? '87654321' : '12345678';
    const destinations = selected ? current.board.moves({ square: selected, verbose: true }).map(move => move.to) : [];
    const lastMove = current.board.history({ verbose: true }).at(-1);
    const squares: Square[] = [];
    for (const rank of ranks) for (const file of files) squares.push(`${file}${rank}` as Square);
    for (const [index, square] of squares.entries()) {
      const piece = current.board.get(square); const cell = button('', () => squareClick(square)); cell.type = 'button';
      cell.className = `chess-square ${current.board.squareColor(square)}${square === selected ? ' selected' : ''}${destinations.includes(square) ? ' legal' : ''}${square === lastMove?.from || square === lastMove?.to ? ' last-move' : ''}${piece?.type === 'k' && piece.color === current.board.turn() && current.board.isCheck() ? ' in-check' : ''}`;
      cell.dataset.square = square; cell.tabIndex = square === focusSquare ? 0 : -1; cell.setAttribute('role', 'gridcell'); cell.setAttribute('aria-selected', String(square === selected));
      cell.setAttribute('aria-label', `${square}${piece ? ` ${piece.color === 'w' ? 'white' : 'black'} ${names[piece.type]}` : ' empty'}${destinations.includes(square) ? ', legal destination' : ''}`);
      if (piece) { const glyph = el('span', glyphs[`${piece.color}${piece.type}`], `piece piece-${piece.color}`); glyph.setAttribute('aria-hidden', 'true'); cell.append(glyph); }
      const coordinates = el('small', square, 'square-coordinate'); coordinates.setAttribute('aria-hidden', 'true'); cell.append(coordinates);
      cell.onkeydown = event => {
        const delta = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -8, ArrowDown: 8 } as Record<string, number>)[event.key];
        if (delta === undefined) return; event.preventDefault();
        if ((delta === -1 && index % 8 === 0) || (delta === 1 && index % 8 === 7)) return;
        const next = squares[index + delta]; if (!next) return; focusSquare = next;
        board.querySelectorAll<HTMLButtonElement>('button').forEach(node => { node.tabIndex = node.dataset.square === next ? 0 : -1; });
        board.querySelector<HTMLButtonElement>(`[data-square="${next}"]`)?.focus();
      };
      board.append(cell);
    }
    boardColumn.append(board);
    if (promotion) {
      const dialog = el('div', undefined, 'promotion'); dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-label', 'Choose promotion piece'); dialog.append(el('p', 'Promote Pawn to:'));
      for (const piece of ['q', 'r', 'b', 'n'] as PieceSymbol[]) dialog.append(action(names[piece][0].toUpperCase() + names[piece].slice(1), () => { if (promotion) void play(promotion.from, promotion.to, piece); }));
      dialog.append(action('Cancel', () => { promotion = null; render(); })); boardColumn.append(dialog);
    }
    const sidebar = el('aside', undefined, 'game-sidebar');
    sidebar.append(el('h3', `Helper Elo ${current.log.elo} · Energy ${current.log.options.energy}`), el('p', `You play ${current.log.options.player}. ${current.log.adaptive ? `Adaptive: +${current.log.win_step} after your win / −${current.log.loss_step} after your loss.` : 'Preset difficulty.'}`, 'muted'));
    const comment = el('div', undefined, 'helper-comment'); const image = el('img'); image.src = '/mascot.svg'; image.alt = 'Little Helper';
    comment.append(image, el('p', notice)); sidebar.append(comment);
    const moves = el('ol', undefined, 'move-log'); moves.setAttribute('aria-label', 'Move log'); const history = current.board.history();
    for (let i = 0; i < history.length; i += 2) moves.append(el('li', `${history[i]}${history[i + 1] ? `   ${history[i + 1]}` : ''}`));
    sidebar.append(el('h3', 'Moves'), moves);
    if (current.outcome === 'in_progress') sidebar.append(action('Resign', () => { confirmation = 'resign'; render(); }), action('Abandon game', () => { confirmation = 'abandon'; render(); }));
    else {
      sidebar.append(el('p', current.reason, 'status'));
      if (finishedSaved) sidebar.append(action('New game / setup', () => { void run(async () => { game = null; engine?.terminate(); engine = null; view = 'setup'; notice = ''; await load(); }); }),
        action('View and download game logs', () => { void run(async () => { await load(); view = 'logs'; selectedLog = current.log.id; }); }));
    }
    section.append(boardColumn, sidebar); return section;
  }
  function renderLogs(): HTMLElement {
    const section = el('section'); section.append(el('h2', 'Recent game logs'), el('p', 'The five most recent games are stored on this computer. Downloads are standard PGN files.', 'muted'));
    section.append(action('Back', () => { view = game ? 'board' : 'setup'; render(); }));
    if (!store?.games.length) section.append(el('p', 'No games yet. Play your first game to create a move log.'));
    for (const log of [...(store?.games ?? [])].reverse()) {
      const row = el('article', undefined, 'game-log'); row.append(el('h3', `Game ${log.id} · ${log.outcome.replace('_', ' ')}`), el('p', `${new Date(log.started_at).toLocaleString()} · You: ${log.options.player} · Elo ${log.elo}`, 'muted'),
        action('View moves / PGN', () => { selectedLog = selectedLog === log.id ? null : log.id; render(); }),
        action('Download PGN', () => { void run(async () => { notice = `Saved to ${await invoke<string>('export_chess', { id: log.id })}`; }); }));
      if (selectedLog === log.id) row.append(el('pre', log.pgn || 'No moves were played.', 'pgn-log'));
      section.append(row);
    }
    if (notice) section.append(el('p', notice, 'status')); return section;
  }
  function updateClocks(): void {
    if (!game) return;
    for (const color of ['w', 'b'] as const) {
      const node = root.querySelector<HTMLElement>(`[data-clock="${color}"]`);
      if (node) { node.textContent = `${color === 'w' ? 'White' : 'Black'} · ${game.log.options.minutes ? clockText(game.remaining[color]) : 'Untimed'}`; node.classList.toggle('active-clock', color === game.board.turn() && game.outcome === 'in_progress'); }
    }
  }
  function render(): void {
    root.replaceChildren(); const header = el('header'); header.append(el('h1', 'Little Helper Chess'), action('Close', requestClose)); root.append(header);
    if (!game || (game.outcome !== 'in_progress' && finishedSaved)) root.append(action('← Back to Games', () => { void run(async () => { await invoke('hide_chess'); await invoke('set_choice_group', { group: 'games' }); }); }));
    if (error) {
      const alert = el('p', error, 'error'); alert.setAttribute('role', 'alert'); root.append(alert);
      root.append(action(game ? 'Retry engine / save' : 'Retry', () => { void run(async () => {
        if (!game) { await load(); return; }
        if (game.outcome !== 'in_progress') { await complete(); return; }
        engine?.terminate(); engine = new Stockfish(); await engine.ready();
        await invoke('chess_progress', { id: game.log.id, pgn: game.pgn() }); game.resume(Date.now()); await helperTurn();
      }); }));
    }
    if (!store) root.append(el('p', error ? 'Chess data could not be loaded. Your file has not been replaced.' : 'Loading local chess data…'));
    else root.append(view === 'setup' ? renderSetup() : view === 'logs' ? renderLogs() : renderBoard());
    if (confirmation) {
      const confirm = el('section', undefined, 'chess-confirmation'); confirm.setAttribute('role', 'alertdialog'); confirm.setAttribute('aria-label', 'Confirm end of game');
      confirm.append(el('p', confirmation === 'resign' ? 'Resign this game? This counts as your loss.' : 'Abandon this game? The move log is kept, and Elo will not change.'),
        action('Keep playing', () => { confirmation = null; render(); }),
        action(confirmation === 'resign' ? 'Confirm resignation' : 'Abandon game', () => { const closing = confirmation === 'close'; const resigning = confirmation === 'resign'; confirmation = null;
          void run(async () => { game?.end(resigning ? 'loss' : 'aborted', resigning ? 'Resignation' : 'Abandoned'); await complete(); if (closing) await invoke('hide_chess'); });
        })); root.append(confirm);
    }
    root.setAttribute('aria-busy', String(busy)); updateClocks();
  }
  function requestClose(): void {
    if (!game && busy) { startGeneration++; engine?.terminate(); engine = null; void invoke('hide_chess'); return; }
    if (game?.outcome === 'in_progress') { confirmation = 'close'; render(); root.querySelector<HTMLButtonElement>('.chess-confirmation button')?.focus(); }
    else if (game && !finishedSaved) { error = 'Save the game result before closing.'; render(); }
    else void invoke('hide_chess');
  }
  await listen('chess-close-request', requestClose);
  window.addEventListener('focus', () => {
    if (!game && !editPending && !busy) void load().then(render).catch(cause => { error = String(cause); render(); });
  });
  setInterval(() => {
    if (!game || game.outcome !== 'in_progress' || error) return;
    game.tick(Date.now()); updateClocks();
    if (game.outcome !== 'in_progress') { engine?.terminate(); if (!busy) void run(complete); }
  }, 200);
  try { await load(); } catch (cause) { error = String(cause); } render();
}
