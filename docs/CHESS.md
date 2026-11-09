# Offline chess

Open **Play Chess Game** from the mascot choices. A separate Little Helper Chess window opens; the browser is not used. Setup order is current difficulty (Edit opens Settings; Refresh changes appears afterward), player color, timer, Helper energy, recent logs, and Start game. Random chooses a color once at game start. Timers support untimed, preset minutes, or custom 1–180 minutes with 0–60 seconds increment per move.

## Difficulty

Settings replaces Other… and retains prompt entry and Normal/DVD mode. Its Chess difficulty section offers side-by-side **Adaptive** and **Preset** radio choices. Adaptive has its own current Elo and separate number steppers for points gained after a human win and lost after a human loss (1–200 each). Preset has its own fixed Elo. Both Elo values are retained independently and range from 200 to 3190. Save chess settings explicitly, then use Refresh changes in the chess setup window.

Defaults are Preset 800, Adaptive 800, and gain/loss amounts of 5. This is a practice difficulty target, not a measured competitive rating. At 1320–3190 the engine uses Stockfish's native UCI strength limiting. Below 1320 it uses Skill Level 0 and deliberately substitutes occasional random legal moves, increasingly often toward 200. Those beginner numbers are estimates, not calibrated Elo ratings; the Lite build is not the full Stockfish engine.

A game captures its starting difficulty, rating mode, and gain/loss amounts. After a human win, the captured gain is added to the current adaptive Elo; after a loss, the captured loss is subtracted. Values clamp to 200–3190. Draws and abandoned/interrupted games do not adjust Elo. Preset games never adjust adaptive Elo. Mid-game edits do not alter the running engine's target or the captured adjustment amounts; an adaptive game's result changes the stored adaptive value without overwriting the independent preset value. Retrying a result save cannot rate a game twice.

## Play and reactions

Click a piece and a highlighted destination, or use arrow keys on the board and Enter/Space. Promotion asks for queen, rook, bishop, or knight. Castling, en passant, checkmate, stalemate, insufficient material, repetition, and the fifty-move rule are handled by chess.js. Repetition and fifty-move draws are automatic in this casual implementation. A timeout is a draw if the opponent has only a king; otherwise the player whose clock expires loses. No online ratings or accounts are involved.

Energy 1 is calm: small reactions, with a hop and wide eyes when Helper is checked. Energy 2 adds playful reactions. Energy 3 adds repeated jumps, short desktop-bouncing bursts, celebrations, and locally written trash talk in the game window. No text-generation service is used. Energy 1/2 pause DVD roaming during a game; energy 3 permits it. Hovering and menus still pause native roaming. Reduced-motion preferences suppress reaction displacement and rotation.

Timed clocks continue while the chess window is unfocused or minimized to tray. Closing the game asks before abandoning it, preserving its PGN without changing Elo. Resigning counts as a loss. On an engine/storage error the running clock pauses and Retry allows continuation; logs are not silently discarded.

## Local logs and export

`chess.json` lives next to the existing prompt/habit files:

- Windows: `%APPDATA%\com.sonya9794.little-helper\chess.json`
- macOS: `~/Library/Application Support/com.sonya9794.little-helper/chess.json`

It stores chess settings and the five most recent games, including an in-progress game's PGN. The PGN is saved after every move. Records include stable IDs, dates, player color, timer, energy, starting target, adjustment rules, outcome, and PGN. A missing file is normal; malformed/unreadable data blocks chess writes and surfaces an error without replacing it. Existing history/habits remain separate. Atomic writes use the shared storage module.

If the application quits/crashes mid-game, its last saved move log is retained; at next startup the interrupted game is marked abandoned without changing Elo. Resuming interrupted games is not implemented. View and download the five recent logs from setup or the completed-game view. Download PGN writes only that stored game to the OS Downloads directory as `Little-Helper-chess-ID.pgn`; existing files are preserved by choosing a suffix. There is no arbitrary-path/file-operation interface.

## Engine and distribution

Stockfish.js 19.0.1 Lite single-threaded runs in a local Web Worker. Vite copies only its unmodified JS/WASM pair and notices from pinned project dependencies into the build; compiled engines are not committed. The packaged app fetches only its own embedded assets and makes no network requests to chess/AI services. No external executable, shell command, API key, or provider SDK is used. See [third-party notices](../THIRD_PARTY_NOTICES.md). Little Helper's own license decision remains pending.

The same sources and worker support Windows/macOS, but macOS compilation and visual behavior still require testing on a Mac. The pre-existing macOS decorative-mascot/native-hit-testing limitation remains.

## Acceptance checks

- Settings is named consistently in both menus. Play Chess Game opens a separate usable window, including on a short/high-DPI display.
- Adaptive/Preset are side-by-side choices. Set different Elo values and gain/loss amounts; save, switch modes, reopen Settings, and verify all independent values survive restart. Reject out-of-range/empty values.
- Edit in setup opens Settings at Chess difficulty. Refresh changes appears, and applying it updates the displayed target. Starting a game uses the current saved settings.
- Play White, Black, and Random. Verify legal highlights, keyboard navigation, check, both castlings, en passant, all promotions, checkmate, draws, and engine replies. Invalid moves cannot change the board.
- Test untimed and timed games, custom minutes/increment, timeouts, minimized clocks, resign, abandon/cancel, and close-window confirmation. No engine turn runs after a game ends.
- Verify calm/playful/energetic reactions, high-energy roaming, comments, and reduced motion. Check transparent-pixel pass-through, drag, DVD, tray restore, and existing prompt/habit features.
- Finish games with nondefault adaptive gains/losses; verify the correct sign and exact amount once, clamped at limits. Preset, draws, and abandoned games must not change adaptive Elo. Habit files must not change.
- Play/abandon more than five games. Confirm only the latest five remain; view PGNs, download twice without overwriting, and inspect the moves/results in another PGN reader. Restart preserves settings/logs. Quit mid-game and confirm the log is marked abandoned on restart.
- Test a malformed `chess.json` using a backup: the error must be visible and the original bytes preserved. Restore the backup afterward.
- Run offline, including the first game after launch. Check the engine worker, local JS/WASM MIME types, and absence of remote content requests.

Automated rules, real-engine, storage, adaptive-rating, and existing regression tests run with `npm run check`; build with `npm run build`. These do not establish visual correctness or macOS behavior.

Validation on 2026-11-09 (Windows): 83 unit tests, TypeScript checks, Rust formatting/checks, and release builds passed. An isolated packaged copy with its own data directory verified the offline worker and a legal engine reply, running clock, independent settings/custom loss, Edit/Refresh, Black's initial engine turn, close confirmation, abandoned-game log, and native PGN export. Setup and board screenshots were visually inspected. Test data/export were removed afterward. A full human-played game, physical energy reactions, tray/mixed-monitor behavior, and macOS compilation/visual checks remain manual acceptance items.
