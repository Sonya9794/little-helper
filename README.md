# Little Helper 0.0.1

Motivational on-screen "pet"

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
# Focused Rust unit tests (history, habits, atomic storage, alpha mask)
npm test
# All routine checks
npm run check
# Portable Windows release executable, with no installer or release/tag creation
npm run build
```

Windows output: `src-tauri/target/release/little-helper.exe`. Launch that executable directly or copy it elsewhere. Do not commit it. This is an unsigned pilot, so Windows may display an unknown-publisher/SmartScreen notice. Microsoft Edge **WebView2 Evergreen Runtime** must be installed on the destination computer; the portable executable does not bundle it. Friends running the executable do not need Node, Rust, or Visual Studio. macOS uses the same build command and produces `src-tauri/target/release/little-helper`; it has the limitations described above.

CI runs type checking, Rust formatting, checks, tests, and a release build on Windows and macOS. Successful jobs upload temporary workflow artifacts, not GitHub Releases or tags. Download the Windows artifact, extract it, and run the executable for acceptance testing. Workflow builds need no custom secrets. Availability is subject to GitHub Actions settings and hosted-runner limits; no paid service is required by the project.

## Using the pilot

Click an opaque mascot pixel to open the compact panel. Drag with the left button by at least four CSS pixels to move it. Only nonzero-alpha mascot pixels receive input on Windows, including anti-aliased edges. Transparent gaps click through to other applications. The native window is just 128 logical pixels square, frameless, transparent, and above normal windows. Position is saved after a short movement debounce, on tray minimization, and on Quit. Saved positions are clamped into the nearest available monitor work area on startup/restoration; the panel chooses a fitting side and is clamped as well.

The menu shows most-common and latest prompts, then `Other…`, then `Habit Tracker`. Empty history has a clear empty state. Selecting either saved prompt records another local use. Nothing executes the prompt. Submit/cancel text entry with the buttons; Ctrl+Enter (Command+Enter on macOS) also saves. Escape returns to the menu, then closes the panel.

In Habit Tracker, each written goal has one checkbox. Edit its text in place (Enter or leaving the field saves), use ↑/↓ to reorder, and Delete to remove. Deleting a checked habit requires inline confirmation. Add habit names at the bottom. `Close tracker` returns to the menu. Normal Tab/Shift+Tab navigation and visible keyboard focus are supported.

The local-date check resets only completion flags. It runs on startup, panel opening/focus, tray restoration, local midnight, and periodically while the panel is visible to catch sleep and clock/time-zone changes. Reloading on a different local date resets even if the application was closed at midnight. The current date and current checked states are stored; historical completion analytics are intentionally not collected.

Right-click a visible mascot pixel and select `Minimize to tray`. Both windows disappear; the tray provides `Show Little Helper` and `Quit`. Closing the panel hides it; it does not quit the app. A second app launch restores the existing instance, preventing competing writers to personal data.

## Local storage and recovery

Tauri's standard per-user application-data directory is used, with application identifier `com.sonya9794.little-helper`:

| Platform | Prompt history | Habits |
| --- | --- | --- |
| Windows | `%APPDATA%\com.sonya9794.little-helper\prompt-history.json` | `%APPDATA%\com.sonya9794.little-helper\habits.json` |
| macOS | `~/Library/Application Support/com.sonya9794.little-helper/prompt-history.json` | `~/Library/Application Support/com.sonya9794.little-helper/habits.json` |

`window-position.json` is stored beside those files. They contain plain, human-readable JSON, are not encrypted, and never belong in the repository. History keeps the most recent 100 uses, with original text, UTC creation timestamps, and monotonic local IDs. Frequency groups trimmed/collapsed whitespace and lowercase text, uses the most recent use to break ties, and displays the latest original text for that group. Habits have stable IDs, explicit order, text, and checked flags associated with one saved local date.

Writes use a flushed temporary file in the same directory and atomic replacement. Missing files are normal. Invalid JSON, invalid schema, unsupported versions, and unreadable files produce local errors and block edits to the affected file; they are never silently replaced with defaults. The other feature remains usable. To recover, Quit, back up the affected file, repair its JSON/schema or manually move it aside, then restart. Moving it aside deliberately starts fresh; the app never does that automatically. Disk-full and permission failures are displayed. Do not run different builds with the same identifier concurrently under different OS accounts sharing an app-data directory.

## Replacing the mascot

Replace `public/mascot.svg` (currently a 128×128 transparent SVG) or change the image source in `src/mascot.ts` to a local transparent PNG/WebP/GIF asset. Keep transparent pixels truly alpha-zero. The renderer uses the canvas's actual physical-pixel alpha buffer to regenerate the Windows region, including after DPI changes. It currently draws one static decoded frame; animated assets are static until an animation renderer is added. A future renderer must submit a fresh matching mask for each displayed frame. Window size and matching canvas bounds must be updated together if dimensions change. `scripts/generate-icons.mjs` regenerates the original temporary app icons with Node built-ins; it is development tooling, not an app capability.

## Troubleshooting and validation

If Cargo/linking fails, check the C++ workload and Windows SDK in Visual Studio Installer, then reopen the terminal. If npm is unavailable, install Node with npm and refresh PATH. If the executable does not open, verify WebView2 and inspect the tray/hidden-icons area for an existing instance. Storage errors include the affected local path. If the mascot becomes unreachable after a monitor change, choose Show from the tray, which clamps it into the current work area; after quitting you may also back up and move aside `window-position.json`.

See [architecture](docs/ARCHITECTURE.md) and the [manual Windows acceptance checklist](docs/WINDOWS-ACCEPTANCE.md). Automated checks do not establish visual transparency, native cross-process click-through, tray behavior, mixed-DPI correctness, or macOS UI behavior. Complete the manual checklist before approving a `v0.0.1` tag. No tag or Release is created by this implementation.
