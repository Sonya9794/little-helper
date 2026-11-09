# Windows acceptance — 0.0.2

Run automated checks first (`npm run check`, then `npm run build`). Record Windows version, display scales, monitor arrangement, commit, and results below. These are manual tests, not claims that CI or unit tests establish UI behavior.

For the unreleased chess feature, also complete the [chess acceptance checks](CHESS.md#acceptance-checks).
For Lock In and the new task table, complete the [To-Do acceptance checks](TODO.md#acceptance-checks).

- [ ] Complete the [rounded-choice, hover-reaction, and Normal/DVD checks](ROUNDED-CHOICES.md) for version 0.0.2.
- [ ] Launch `src-tauri/target/release/little-helper.exe` directly, outside the repository as well. No installer or development tools are needed; WebView2 must exist.
- [ ] A small frameless mascot appears with no rectangular background. Place another normal application over/under it to verify it stays above normal windows.
- [ ] Put Notepad behind the mascot. Click an opaque body pixel: the Little Helper menu opens.
- [ ] Close the panel, then click a fully transparent corner **inside the 128×128 mascot bounds**. Notepad underneath must receive the click/caret change. Also test the gap between an arm and the body and transparent space beside the antenna. This must cross process boundaries.
- [ ] Drag an opaque pixel more than four pixels. The mascot moves and no menu opens on release. A small click with less movement opens the menu.
- [ ] Drag to another monitor, including negative coordinates and a different DPI scale. Artwork and hit mask stay aligned. Test opaque and transparent pixels again after moving.
- [ ] Quit via tray, relaunch, and verify position survives. Disconnect/rearrange the saved monitor, then launch/restore: the mascot stays reachable.
- [ ] Open the panel at each screen edge. It chooses a fitting side, remains reachable within the work area, and permits scrolling/resizing if needed.
- [ ] With no history file, main shows Settings, Lock In →, and Play Chess Game. Lock In replaces these with Habit Tracker, Motivation, To-Do List, and ← Back. Settings explains how to save the first prompt. Saved-text choices appear after saving a prompt.
- [ ] Cancel prompt entry and confirm no record is created. Submit whitespace only and confirm rejection. Submit real text; latest/most common update immediately.
- [ ] Submit `Read a book`, `  READ   a book  `, and `Chess`. The book group is most common and Chess is latest. Select Chess again: the tie goes to Chess, the newest use. Select a saved choice and inspect JSON to confirm another record is appended.
- [ ] Submit more than 100 records (unit tests cover retention too), inspect `%APPDATA%\com.sonya9794.little-helper\prompt-history.json`, and verify only the most recent 100 remain.
- [ ] Habit Tracker initially lists the exact five specified goals, each with one binary checkbox and no counters.
- [ ] Check and uncheck a habit. Add, rename (Enter/blur), delete an unchecked habit, and reorder with ↑/↓. Confirm no duplicate IDs and correct explicit order in habits.json.
- [ ] Delete a checked habit: confirmation is required. Cancel preserves it; confirming removes it.
- [ ] Reject blank/whitespace-only additions and renames. Use Tab/Shift+Tab/Space/Enter and verify visible focus.
- [ ] Close tracker to the menu, reopen it, and verify edits and checks remain. Quit/restart and verify both prompt and habit files persist.
- [ ] Test closed-across-midnight reset without changing the system clock: Quit, back up habits.json, change only its saved `date` to yesterday, leave some flags true, and relaunch. All checks reset, and names/IDs/order remain identical. Repeat with a future saved date to simulate a backward clock/time-zone date change.
- [ ] Leave the tracker open over local midnight and verify flags reset. Sleep across midnight, resume, and open/focus the tracker; verify reset. These require real timing or a test machine; do not change your daily-use computer's clock unnecessarily.
- [ ] Back up and deliberately corrupt a storage file with the app closed. Restart: a clear local error identifies the file. That file stays byte-for-byte unchanged after attempts to edit; the other feature still works. Restore the backup afterward.
- [ ] Right-click an opaque mascot pixel, select Minimize to tray: the mascot, choices, detail panel, and chess window disappear. Tray Show restores the saved/reachable position, data, and any active chess game. Tray Quit terminates the process.
- [ ] Launch a second executable instance: the existing instance restores, without competing writers or duplicate tray icons.
- [ ] Run offline/disconnected and verify every pilot feature still works.

Results: **not yet manually verified**. Record tester/date and any failures before approving the version tag. macOS visual testing is not claimed; macOS native mascot hit testing remains an explicit limitation. Do not tag or publish a Release until the Windows artifact is manually approved.
