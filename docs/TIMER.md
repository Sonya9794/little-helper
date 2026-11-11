# Lock In Timer

Open **Lock In → Timer**. Normal is a custom countdown with hours, minutes, and seconds (1 second–24 hours). Stopwatch counts upward. Pomodoro configures starting work minutes, fixed break minutes, work decrease per round, and work-round count. Defaults are Normal 25 minutes and Pomodoro 25-minute work, 5-minute breaks, zero decrease, four rounds.

Pomodoro shortens **work only**. With 25/5, decrease 2, and four rounds, work periods are 25, 23, 21, and 19 minutes; three 5-minute breaks separate them. The session ends after the final work period. Zero decrease keeps work periods equal. Work/break inputs accept 1–1440 whole minutes, decrease 0–1440, rounds 1–100. Configurations that would reduce any work period to zero or below are rejected, without replacing a running timer. Phase transitions happen automatically.

Start, Pause, Resume, and Reset are available as appropriate. Reset stops and clears elapsed progress while retaining the current setup. Reset before editing a running/paused timer or switching its mode. The timer keeps running when its window closes, Back is selected, or the app is minimized to tray. Reopen it to see the current phase/time. Phase changes and completion are shown in this window. Quitting Little Helper clears timer progress and setup: this pilot keeps timers in memory and does not create a timer data file.

Rust owns elapsed time through a process-local monotonic clock. Display updates derive from elapsed time, not from counting JavaScript ticks. Delayed display polling catches up across work/break phases and completion. Paused time is excluded. Countdown display rounds remaining seconds up; stopwatch display rounds elapsed seconds down. Completed countdowns stop at zero. Existing history, habits, tasks, and chess data are independent.

`src-tauri/src/timer.rs` holds the clock, schedule validation, transitions, and deterministic clock tests. `timer_commands.rs` exposes only timer actions and anchored-window open/back commands. `src/timer-ui.ts` renders the controls and `timer-model.ts` validates draft input and formats time. The timer shares the standard tray hiding/close behavior, ordinary panel anchoring, and roaming pause while its window is visible.

## Manual Windows checks

- Open Lock In: Timer appears before Back, and the five choices stay distributed when there is room. Timer Back returns to Lock In. Test near screen edges and at different DPI scales.
- Normal: start a short countdown; pause, wait, resume, complete, and reset. Completion stops at zero. Check invalid/empty and over-24-hour durations.
- Stopwatch: start/pause/resume/reset. Close or go Back while running; reopen and verify time advanced. Minimize to tray and reopen through Lock In.
- Pomodoro: set work/break/decrease/rounds. Verify the summary, fixed breaks, decreasing work, automatic transitions, pause/resume across a boundary, and completion after the final work period. Reject a reduction reaching zero. Check a single-round session and zero decrease.
- Use keyboard Tab/Shift+Tab, arrow keys in numeric fields/radios, Enter to Start, and visible focus. Reset should allow changing mode/settings again.
- Quit/relaunch: timer is idle with defaults. Personal data files must remain untouched. macOS must be compiled and visually checked on a Mac.

Run `npm run check` and `npm run build` for full automated verification and the portable executable.

## Verification

All 143 automated tests passed on Windows (82 frontend/model and 61 Rust), including clock boundaries, pause/resume/reset, delayed polling across phases, decreased work/fixed breaks, invalid schedules, single rounds, and time formatting. TypeScript checking, Rust formatting/checking, and the normal Windows release build passed. An isolated packaged app passed countdown pause/resume/completion/reset, stopwatch time continuing across Back/reopen, Pomodoro form/summary and real accelerated work/break/next-work/completion transitions, invalid-schedule rejection, and restart-to-idle behavior. Screenshots were inspected. Physical tray use, sleep behavior, all mixed-DPI arrangements, and macOS remain manual acceptance checks.
