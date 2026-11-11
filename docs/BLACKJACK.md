# Games and Blackjack

Main choices now include **Games →** in place of the direct chess shortcut. It replaces main choices with Chess, Blackjack, and **← Back**. Escape returns to main. Existing ring placement and edge fallback apply. The ordinary panel fallback on macOS has the same hierarchy; macOS still requires compilation and visual testing on a Mac.

Blackjack opens in its own resizable Little Helper window. It is entirely offline: no accounts, real money, purchases, network calls, or new dependencies. Start with 1,000 play-money chips and a default bet of 10. Enter a positive whole-chip bet up to the available balance.

## Rules

- Fresh 52-card deck each round, shuffled locally with Web Crypto randomness and unbiased Fisher–Yates sampling.
- Aces count as 1 or 11. Dealer stands on all 17s, including soft 17.
- Dealer receives one visible card and one hidden card. Naturals are checked immediately after dealing; otherwise the hidden card stays concealed until the round ends.
- Two-card blackjack pays 3:2; an ordinary win pays 1:1; ties return the stake. Both naturals tie. Three-or-more-card 21 is an ordinary hand.
- Hit draws one card. Reaching 21 automatically stands; going over 21 loses without further dealer draws.
- Double is available on the first two cards when enough chips remain. It reserves another stake, draws exactly one card, then stands (or busts). No splits, insurance, or surrender.
- Stakes are removed when placed. Payouts include the returned stake; odd-chip naturals can produce half-chip balances. Bets remain whole chips.

Chips and rounds live only in memory for the current app session. Back, window Close, and tray hiding preserve them; quitting resets them. Reset Chips requires confirmation and is available between rounds. Blackjack does not modify chess Elo/logs, prompts, habits, or tasks. Roaming pauses while the Blackjack window is visible. Tray minimization hides it along with the other windows. Restore the mascot and choose Games → Blackjack to resume it.

## Architecture

`src/menu-model.ts` describes both menu groups. `src/blackjack-game.ts` owns deck construction, scoring, legal actions, settlement, and session chips. It accepts a complete injected deck for deterministic rule tests. `src/blackjack-ui.ts` renders cards and controls using plain HTML/CSS and accessible card names. It does not invoke storage commands. `src-tauri/src/games.rs` shares monitor-safe placement/restoration between the game windows and exposes only Blackjack open/back commands. Existing tray code hides the additional window.

## Manual Windows acceptance

- Click Games: only Chess, Blackjack, and Back appear; arrows face the correct directions. Back and Escape return to main. Check ring placement centrally and fallback near screen edges, with and without saved prompts.
- Open Chess and verify setup/play still work. Back to Games is available outside an active game; existing active-game close confirmation remains unchanged.
- Open Blackjack. Deal, verify the hidden dealer card, Hit, Stand, and Double. Double becomes unavailable after a Hit or with insufficient chips. Check totals, result messages, and chip changes against the rules above.
- Try invalid bets and a bet larger than the balance. Complete rounds until no whole chips remain, then confirm Reset Chips. Cancel must leave chips unchanged.
- Navigate Back while a round is active, reopen Blackjack, and confirm the same cards/chips remain. Close/reopen the window and minimize/restore through the tray. No extra desktop window should remain after minimizing.
- Quit and restart: Blackjack returns to 1,000 chips and an empty table; existing chess/habit/task/history files are unchanged.
- Test keyboard Tab/Shift+Tab/Enter navigation, visible focus, accessible card labels, a narrow window, and mixed-DPI/monitor reachability.

Run `npm run check` for all automated checks and `npm run build` for the portable Windows executable. No binary is committed. macOS UI behavior and physical desktop hit testing need manual verification on the corresponding platform.

## Verification

On Windows, all 107 automated tests passed (67 frontend/model and 40 Rust tests), with frontend type checking, Rust formatting/checking, and a portable release build. A separate packaged test profile passed menu replacement/arrows/Back, Chess setup and return, Blackjack deal/hidden-card/Hit/Stand/Double and payouts, reset confirmation/cancellation, round preservation on Back, and a full-restart session reset. Screenshots were inspected for card and control readability. Physical tray interaction, desktop click-through, mixed-DPI arrangements, and macOS UI still require the manual checks above.
