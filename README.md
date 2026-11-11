# Little Helper 0.0.3

Motivational on-screen "pet"

Unreleased: **Lock In → Timer** adds Normal countdown, Pomodoro, and Stopwatch ([timer guide](docs/TIMER.md)). Helper Thoughts now has one dual-handle **1–30 minute** interval slider; equal handles give a fixed interval, and switching thoughts off disables the other controls. Thought bubbles sit closer, and violent shaking produces a proportionally longer angry stare.

Unreleased: Settings sections are collapsible. **Helper Thoughts** can show offline jokes, fun facts, or encouragement in a separate clickable bubble following the mascot after random 3–10 minute waits. It starts off; off or all categories disabled means no bubbles. See [Helper Thoughts](docs/HELPER-THOUGHTS.md).

Unreleased: **Games →** now groups Chess and **Blackjack**. Blackjack uses session-only play-money chips and a separate offline window. See the [rules and acceptance checks](docs/BLACKJACK.md). The application remains version 0.0.3 until the next version is prepared.

Version 0.0.3 adds **Settings → Chess difficulty** and **Play Chess Game**, with a local Stockfish opponent, Adaptive/Preset ratings, clocks, three Helper energy levels, and five recent downloadable PGN logs. See the [chess guide and acceptance checks](docs/CHESS.md). Lock In groups Habit Tracker, Motivation, and the new color-customizable To-Do List with local date/time deadlines and duration estimates. See the [To-Do guide and acceptance checks](docs/TODO.md).

An offline Windows desktop mascot with local prompt history and an editable daily habit checklist. The temporary seed-bot artwork is original and replaceable. No AI service, provider SDK, OAuth, telemetry, shell execution, browser access, or computer-control capability is included in the application.

**License decision pending. No software license has been selected or granted.** Public source availability is not an open-source license grant.

## Setup

Windows: Git, Node.js (version in `.node-version`), Rust via rustup (version and formatter in `rust-toolchain.toml`), Microsoft Visual Studio Build Tools 2022 with Desktop development with C++, the x64/x86 compiler, and Windows 11 SDK 10.0.26100. `.vsconfig` records the native components; import it in Visual Studio Installer. Restart your terminal after installing tools so PATH updates take effect.

macOS: Node, rustup, and Xcode Command Line Tools (`xcode-select --install`). This source tree and CI also compile on macOS, but **native macOS pixel hit testing is not implemented in this Windows pilot**. On macOS the mascot is decorative and ignores all mouse input; `Show Little Helper` in the menu-bar tray opens the working panel. There is no rectangular hit-box fallback. A complete macOS overlay requires a correct native input-shape adapter and visual testing on a Mac. A macOS artifact must be compiled on macOS and visually tested there; Windows testing cannot establish macOS behavior. Transparent windows use Tauri's macOS private-API feature and are not intended for Mac App Store submission.

From the existing repository:

```powershell
npm ci
npm run dev
```

`npm ci` installs project-local dependencies using `package-lock.json`. Cargo downloads Rust dependencies using `Cargo.lock`; development/build tooling needs network access initially. The packaged application does not connect to any network service. Keep both lock files committed. `.node-version`, `rust-toolchain.toml`, `.vsconfig`, and CI document the reproducible setup; Python virtual environments and Linux containers cannot replace Windows/macOS native SDKs.

## Commands

```powershell
# Frontend type check
npm run typecheck
# Rust formatting check
cargo fmt --manifest-path src-tauri/Cargo.toml --check
# Rust compile check
cargo check --locked --manifest-path src-tauri/Cargo.toml
# Frontend interaction/geometry tests and Rust storage/window/motion tests
npm test
# All routine checks
npm run check
# Portable Windows release executable, with no installer or release/tag creation
npm run build
```

Windows output: `src-tauri/target/release/little-helper.exe`. Launch that executable directly or copy it elsewhere. Do not commit it. This is an unsigned pilot, so Windows may display an unknown-publisher/SmartScreen notice. Microsoft Edge **WebView2 Evergreen Runtime** must be installed on the destination computer; the portable executable does not bundle it. Friends running the executable do not need Node, Rust, or Visual Studio. macOS uses the same build command and produces `src-tauri/target/release/little-helper`; it has the limitations described above.

CI runs type checking, Rust formatting, checks, tests, and a release build on Windows and macOS. Successful jobs upload temporary workflow artifacts, not GitHub Releases or tags. Download the Windows artifact, extract it, and run the executable for acceptance testing. Workflow builds need no custom secrets. Availability is subject to GitHub Actions settings and hosted-runner limits; no paid service is required by the project.

## Using the pilot

Click an opaque mascot pixel to open the rounded choices, then select a page to open its detail panel. Drag with the left button by at least four CSS pixels to move the mascot. Only nonzero-alpha mascot pixels receive input on Windows, including anti-aliased edges. Transparent gaps click through to other applications. The mascot window is configured at 128 logical pixels square, frameless, transparent, and above normal windows. Position is saved after a short movement debounce, on tray minimization, and on Quit. Saved positions are clamped into the nearest available monitor work area on startup/restoration; the detail panel chooses a fitting side and is clamped as well.

Click the mascot to toggle rounded choices around it. The first two choices show saved prompt text itself (the most-used and most-recent prompts), followed clockwise by `Settings`, `Lock In →`, and `Games →`. Long labels have an ellipsis and a full-text tooltip. With empty history, those three main choices appear; Settings explains how to save the first prompt. Choosing a saved prompt records another local use and opens its full text. Nothing executes the prompt. Settings contains prompt entry, Mode, and Chess difficulty; Ctrl+Enter (Command+Enter on macOS) also saves a prompt. Lock In replaces the main choices with Habit Tracker, Motivation, To-Do List, Timer, and `← Back`. Back/Escape returns to main; Escape on main dismisses the choices. Detail pages return to their parent group. Near screen edges the choices gather on the side with room. Transparent gaps remain click-through, including the middle over the mascot. A compact transparent choices window is used, not a full-screen overlay.

Hovering makes the mascot hop once for about 280 ms, with excited `> <` eyes and no mouth. The face stays excited while hovering after landing, then returns to normal on leaving or clicking. The four-pixel hop fits inside the artwork's transparent top margin, leaving the saved desktop position unchanged. Each frame updates the native alpha mask; moving edges have a short settling guard against repeated hops. Reduced-motion preferences keep the expression change and skip movement.

Fast back-and-forth mouse movements or small circles over the mascot trigger a subtle two-pixel sideways shake. After movement stops (a 140 ms pause), it stares with large circular eyes and pupils, without a mouth, for one second. Clicks and drags clear the reaction. Detection uses only pointer events delivered to the mascot, with a short rolling movement window and speed/turn thresholds; it does not track the mouse globally. Reduced motion skips displacement while retaining the expression timing.

Keep shaking continuously for more than two seconds to escalate to a stronger sideways and vertical shake with a small rotation. The artwork briefly scales to 90% to leave room inside the same small window; its saved desktop position stays unchanged. After stopping, the one-second stare uses inward-slanted eye tops for an angry expression. Separate bouts reset the two-second timer. Reduced motion suppresses displacement, rotation, and scaling, while keeping the expression change.

Settings also contains a **Mode** slider with two stops: **Normal** and **DVD**. Normal keeps the mascot where you put it. DVD glides diagonally and bounces off the usable edges of its current monitor (excluding the taskbar/Dock); an exact corner hit reverses both directions. Hovering, dragging, open choices/detail panels, the context menu, and minimizing to tray pause movement. Close the interface and move away to resume. Dragging to another monitor continues there, and returning to Normal stops at the current position. The slider supports arrow keys, Home, and End, and changing it preserves an unsaved prompt draft. Mode is a session setting: every launch starts in Normal; no new settings file is created. Position is saved when switching back to Normal, minimizing, or quitting rather than on every DVD frame.

Motivation opens one random entry from 20 original short encouragements bundled in `src/motivation.ts`. Another quote draws again; repeats are possible. Quotes never enter prompt history or habit storage, and no service is contacted. Future action names can replace saved-text labels independently of the layout; action execution is still not implemented. See [rounded-choice acceptance checks](docs/ROUNDED-CHOICES.md).

In Habit Tracker, each written goal has one checkbox. Edit its text in place (Enter or leaving the field saves), use ↑/↓ to reorder, and Delete to remove. Deleting a checked habit requires inline confirmation. Add habit names at the bottom. `Close tracker` returns to the menu. Normal Tab/Shift+Tab navigation and visible keyboard focus are supported.

Lock In's **To-Do List** opens a compact table for completion, Task, local date/time Deadline, and Time Needed in hours/minutes. Rows can be added, renamed, deleted, checked, and unchecked. Each row offers 12 preset colors or a custom color wheel with brightness/sliders/hex input. Apply Color saves; Cancel preserves the previous color. Tasks persist separately in `todo.json` beside the other app-data files and never reset at midnight. See the [To-Do guide and acceptance checks](docs/TODO.md).

The local-date check resets only completion flags. It runs on startup, panel opening/focus, tray restoration, local midnight, and periodically while the panel is visible to catch sleep and clock/time-zone changes. Reloading on a different local date resets even if the application was closed at midnight. The current date and current checked states are stored; historical completion analytics are intentionally not collected.

Right-click a visible mascot pixel and select `Minimize to tray`. The mascot, choices, detail panel, and chess window disappear; the tray provides `Show Little Helper` and `Quit`. Show also restores an active chess game. Closing the detail panel hides it; closing an active chess window asks before abandoning the game. A second app launch restores the existing instance, preventing competing writers to personal data.

## Local storage and recovery

Tauri's standard per-user application-data directory is used, with application identifier `com.sonya9794.little-helper`:

| Platform | Prompt history | Habits |
| --- | --- | --- |
| Windows | `%APPDATA%\com.sonya9794.little-helper\prompt-history.json` | `%APPDATA%\com.sonya9794.little-helper\habits.json` |
| macOS | `~/Library/Application Support/com.sonya9794.little-helper/prompt-history.json` | `~/Library/Application Support/com.sonya9794.little-helper/habits.json` |

`window-position.json` is stored beside those files. They contain plain, human-readable JSON, are not encrypted, and never belong in the repository. History keeps the most recent 100 uses, with original text, UTC creation timestamps, and monotonic local IDs. Frequency groups trimmed/collapsed whitespace and lowercase text, uses the most recent use to break ties, and displays the latest original text for that group. Habits have stable IDs, explicit order, text, and checked flags associated with one saved local date.

Chess settings and the five recent game logs use a separate `chess.json` in the same application-data directory. Moves are saved after each turn; interrupted games retain their log and become abandoned on the next launch, without an Elo change. PGN downloads go to the OS Downloads folder and never overwrite an existing file. Chess does not alter habit data. Stockfish runs as a bundled, separate single-threaded WebAssembly worker; it does not launch external executables or contact a service. Its license, exact source pointers, and the chess.js license are bundled locally and viewable under Chess engine and licenses. See [third-party notices](THIRD_PARTY_NOTICES.md); the project-wide license decision is still pending.

Writes use a flushed temporary file in the same directory and atomic replacement. Missing files are normal. Invalid JSON, invalid schema, unsupported versions, and unreadable files produce local errors and block edits to the affected file; they are never silently replaced with defaults. The other feature remains usable. To recover, Quit, back up the affected file, repair its JSON/schema or manually move it aside, then restart. Moving it aside deliberately starts fresh; the app never does that automatically. Disk-full and permission failures are displayed. Do not run different builds with the same identifier concurrently under different OS accounts sharing an app-data directory.

## Replacing the mascot

Replace `public/mascot.svg`, `public/mascot-excited.svg`, `public/mascot-staring.svg`, and `public/mascot-angry.svg` (128×128 transparent SVGs), or change their image sources in `src/mascot.ts` to local transparent PNG/WebP/GIF assets. Match their silhouettes and leave at least four transparent pixels above the artwork for the hop and two on either side for gentle shaking. Strong shaking scales the artwork to leave room for its larger transforms; recheck clipping bounds if replacing the silhouette. Keep transparent pixels truly alpha-zero. The renderer uses the canvas's actual physical-pixel alpha buffer to regenerate the Windows region, including after DPI changes and for every animation frame. Each asset supplies one decoded frame; sprite sheets and animated image playback are not implemented. A future renderer must submit a fresh matching mask for each displayed frame. Window size and matching canvas bounds must be updated together if dimensions change. `scripts/generate-icons.mjs` regenerates the original temporary app icons with Node built-ins; it is development tooling, not an app capability.

## Troubleshooting and validation

If Cargo/linking fails, check the C++ workload and Windows SDK in Visual Studio Installer, then reopen the terminal. If npm is unavailable, install Node with npm and refresh PATH. If the executable does not open, verify WebView2 and inspect the tray/hidden-icons area for an existing instance. Storage errors include the affected local path. If the mascot becomes unreachable after a monitor change, choose Show from the tray, which clamps it into the current work area; after quitting you may also back up and move aside `window-position.json`.

See [architecture](docs/ARCHITECTURE.md), the [manual Windows acceptance checklist](docs/WINDOWS-ACCEPTANCE.md), and the [interaction and DVD-mode checks](docs/ROUNDED-CHOICES.md). Automated checks do not establish visual transparency, native cross-process click-through, tray behavior, mixed-DPI correctness, or macOS UI behavior. Complete the manual checklists before approving a `v0.0.3` tag. No tag or Release is created by this implementation.
