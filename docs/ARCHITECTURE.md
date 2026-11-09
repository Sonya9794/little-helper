# Architecture — 0.0.2

The packaged application is offline. It contains no HTTP client, provider SDK, OAuth, API keys, telemetry, screen capture, browser-reading, shell, app-launching, or arbitrary file-operation commands. Build tools and CI download development dependencies; that is separate from runtime behavior. Only bundled UI assets and narrow local Tauri IPC commands are allowed by the production CSP. No remote content is loaded into the WebViews.

| Responsibility | Location |
| --- | --- |
| Mascot rendering, physical-pixel alpha extraction, click vs drag | `src/mascot.ts`, `public/mascot.svg`, `public/mascot-excited.svg` |
| One-shot hover hop and expression state | `src/mascot-hover.ts` |
| Local pointer-gesture detection, sustained-shake escalation and timed stare | `src/mascot-reaction.ts`, `public/mascot-staring.svg`, `public/mascot-angry.svg` |
| Normal/DVD session mode, native window gliding, reflection physics and interaction pauses | `src-tauri/src/motion.rs`; slider in `src/panel.ts` |
| Native geometry, nearest-monitor work-area clamping, panel anchoring, position persistence | `src-tauri/src/overlay.rs` |
| Input shape abstraction and Windows GDI region adapter | `src-tauri/src/hit_test.rs` |
| Main menu and prompt form | `src/panel.ts` |
| Prompt records, retention, validation, normalization, statistics | `src-tauri/src/history.rs` |
| Habit editing controls | `src/habits.ts` |
| Habit IDs/order/editing/date resets and validation | `src-tauri/src/habits.rs` |
| Shared safe JSON reads and atomic replacement | `src-tauri/src/storage.rs` |
| Tray and minimize/restore lifecycle | `src-tauri/src/tray.rs` |
| Native command registration and serialized local mutations | `src-tauri/src/lib.rs` |
| Future submission boundary, currently local history only | `src-tauri/src/execution.rs` |

## Input shape and native windows

The Windows adapter translates client-pixel coordinates into window-region coordinates using ClientToScreen and GetWindowRect. This accounts for invisible native borders, even on frameless windows; ignoring that offset shifts hit testing away from the artwork.

The mascot window is 128 logical pixels square, not a desktop-sized overlay. The static SVG is drawn into a physical-resolution canvas. Its exact nonzero alpha scanlines are sent to Rust. On Windows, checked GDI regions are combined and installed with `SetWindowRgn` on the top-level Tauri HWND. Transparent holes are outside the native window region, so they do not participate in desktop input routing, including clicks to a different process. This avoids the same-thread limitation of `HTTRANSPARENT` and the race in polling the pointer and toggling whole-window click-through. GDI region ownership transfers to Windows only on success. No screenshot, global input hook, accessibility permission, or cursor polling is needed.

The window starts hidden. A usable native region must be installed before it appears. A DPI change hides it until a matching physical-pixel mask is installed. Alpha > 0 is treated as visible, including anti-aliased edges. The region is also a visual clip, using the same boundaries as the canvas. The renderer is static; adding frames later requires keeping pixels and masks synchronized. Native cross-process hit testing and DPI behavior still require the documented manual Windows tests.

The backend is shared, with a clearly isolated platform adapter. A correct macOS native pixel-input shape is not shipped in this pilot. The macOS adapter safely ignores all mascot mouse events and reports the limitation in the panel; Show in the tray opens the panel. It never claims a rectangle or pointer polling meets pixel-level input semantics. macOS compilation and CI cannot establish visual or interactive correctness. A future native adapter must be compiled and tested on macOS before enabling mascot interactions there.

The separate panel is an ordinary small window that can receive keyboard/text input. It chooses a fitting side of the mascot and stays within monitor work areas. Positions use desktop physical coordinates, including negative monitor coordinates. Restoring clamps saved positions if monitors or arrangements changed. Position saves are debounced; minimize and Quit also save immediately. Tray hiding prevents a delayed mask refresh from showing the mascot again. A single-instance plugin restores an existing instance so two app copies cannot independently overwrite personal storage.

Native state is registered before explicitly creating either WebView. The frontend waits for a native startup-ready gate before sending storage/render commands, since WebView2 can pump IPC during window construction. Initial position moves are not persisted until restoration is complete.

## Rounded choices, page navigation, storage and dates
The choices overlay is one additional compact transparent WebView (`src/choices.ts`), with Canvas-drawn pill backgrounds and accessible HTML buttons. `src/scene.ts` obtains physical client dimensions from Rust and submits the exact painted alpha mask. Transparent gaps, including the mascot-sized middle, are excluded from the native region. `src/choice-layout.ts` lays choices around the mascot or gathers them beside it near screen edges. The original mascot window stays small. Dragging, details, Escape, and tray minimization dismiss the choices. macOS retains its ordinary panel menu while its native mascot input adapter is pending.

`src-tauri/src/choices.rs` owns transient page requests and choice-window placement. Page requests are retained until consumed, so opening a page does not depend on an event listener winning a startup race. Before placing/showing a detail window, its minimized state is restored; merely showing a minimized HWND leaves its content at off-screen icon coordinates with zero client size. The Motivation list and random selection are isolated in `src/motivation.ts`; quotes never reach the prompt-submission handler or persistence modules.


History and habits are separate versioned JSON files in Tauri's per-user app-data directory. Human-readable original prompt text is preserved. Submission order is authoritative for latest use and frequency tie-breaking, even when the wall clock moves backward. Counts are over the retained 100-record window. Stable monotonically increasing integer IDs are persisted and never reassigned during reorder/delete.

Each read validates JSON and structure before any edit. A malformed/unreadable file blocks writes to that feature. Updates serialize through a native mutex and replace the old file via a flushed, same-directory temporary file. Unix also syncs the directory. Failed replacement does not truncate the old file. The files are local plain text, not encrypted or synchronized by this application. OS-level profile backups or folder synchronization are outside the app's control.

Habits persist one local calendar date plus current flags. A date mismatch in either direction resets flags but preserves every habit's ID, name, and order. Local dates are obtained from the OS at each operation; elapsed 24-hour arithmetic is not used. Startup, restore, display/focus, a local-midnight timeout, and a periodic comparison handle closed-at-midnight, sleep, DST, clock, and time-zone changes. Timers are a convenience; correctness on restart does not depend on them.

## Future ChatGPT/provider integration

`PromptSubmission` is the minimal future-facing interface. `LocalHistoryOnly` is its sole implementation. A later provider adapter could be wired at this boundary, keeping authentication, network transport, and provider execution separate from history calculations and UI. Provider responses, credentials, and execution status would need a deliberate interface revision, rather than being stored in the prompt-history module. No future provider or authentication scaffolding runs today.

Any later computer actions will require explicit user permissions, scoped capabilities, and confirmation safeguards for consequential actions. Those capabilities and safeguards are not implemented in 0.0.2. The current app's fixed local-data persistence is not a general file-operation capability.

License decision pending; no license is selected.
