# Lock In and To-Do List

The main mascot choices contain saved prompts (when available), Settings, **Lock In →**, and Play Chess Game. Lock In replaces those choices with Habit Tracker, Motivation, To-Do List, and **← Back**. These actions use the same around-the-mascot layout, with the existing compact column fallback at screen edges. Escape in Lock In returns to main; Escape in main dismisses the choices. Returning from a Lock In detail page or the To-Do window restores Lock In. A fresh mascot click after dismissal starts at main. The ordinary-panel macOS fallback follows the same hierarchy; its existing native mascot hit-testing limitation remains.

To-Do List opens a compact, resizable window anchored beside the mascot and clamped to its monitor work area. Its table has completion, Task, Deadline, and Time Needed columns. Add a task below the table. Rename, change a deadline, or edit an estimate in place; Enter or leaving the field saves. Check/uncheck immediately. Delete removes that row; completed rows stay until explicitly deleted.

Deadlines are optional local date-and-time values, stored exactly as entered (`YYYY-MM-DDTHH:MM`) without timezone conversion. Time Needed is an optional duration entered as whole hours and 0–59 minutes; it is stored as total minutes. Clearing both duration fields (or entering zero) clears the estimate. No reminders or scheduling service is added.

Each row's Color button opens 12 preset swatches plus Custom Color Wheel. The custom wheel chooses hue and saturation; brightness, hue/saturation sliders, and a hex field are available for precise/keyboard selection. Preview, then Apply Color, or Cancel to keep the old color. Row text and native input themes adapt to dark/light backgrounds. Color changes are saved only on Apply, not every pointer movement.

Tasks are stored in human-readable `todo.json` beside the other application data:

- Windows: `%APPDATA%\com.sonya9794.little-helper\todo.json`
- macOS: `~/Library/Application Support/com.sonya9794.little-helper/todo.json`

Records have a stable ID, text, completion flag, optional deadline, optional minute estimate, and `#rrggbb` color. Insertion order is preserved and IDs are never reused after deletion. This data is separate from habits and never resets at midnight. Storage uses validated reads and the shared flushed, atomic replacement helper. Missing files start empty. Malformed/unreadable data produces a local error and blocks writes without replacing the file. Task text must contain 1–2000 characters. Data and compiled artifacts remain ignored by Git.

DVD/reaction roaming pauses while the To-Do window is visible. Tray minimization also hides the To-Do window. Reopening it restores saved rows. No chess, prompt, habit, or AI-provider logic is coupled to task completion.

## Acceptance checks

- Main choices show Lock In with a right arrow. Selecting it removes main actions and presents Habit Tracker, Motivation, To-Do List, and a left-arrow Back choice. Back and Escape return to main. Verify both empty and nonempty prompt history.
- Open Habit Tracker/Motivation and return: Lock In should reopen. Other existing Settings/chess actions remain reachable on main. Check distributed layout in the center and compact placement near all screen edges.
- Add tasks, rename, check/uncheck, delete, and reopen the table. Add-task input clears after success, while a new draft typed during saving is preserved. Deleted IDs are not reused.
- Enter a date and time, edit it, and clear it. Enter 1 hour 35 minutes and verify 95 stored minutes; clear the estimate. Reject blank task names, invalid dates, negative/fractional hours, and minutes above 59 without changing saved data.
- Open Color: count 12 presets. Apply a preset, use the actual color wheel, adjust brightness, and enter a custom hex color. Apply persists the chosen color; Cancel leaves it unchanged. Check readability on dark/light colors, including calendar icons and focus outlines. Use Tab and sliders with arrow keys.
- Restart the application: task text, checks, deadlines, durations, and colors remain. Completion states must survive a date change and remain independent from habit resets.
- Back from the table returns to Lock In. Window placement stays reachable on mixed-DPI monitors. DVD pauses during editing. Tray hides all windows without discarding saved rows.
- With the app closed and a backup available, corrupt `todo.json`: opening To-Do must show a local error, and edit attempts must leave the original bytes unchanged. Restore the backup afterward.
- Verify mascot opaque-pixel input, transparent gaps between the new bubbles, and normal dragging. macOS compilation/visual behavior requires a Mac.

Run `npm run check` for model, storage, duration, wheel/contrast, and existing regression tests; `npm run build` creates the portable Windows executable.

## Verification

On Windows, all 97 automated tests passed (57 frontend/model tests and 40 Rust tests), along with TypeScript checking, Rust formatting/checking, and a release build. An isolated packaged application passed native WebView checks for menu replacement and arrows, return navigation, task editing/checking/deletion, date/time and duration fields, preset and actual color-wheel input, custom hex colors, cancellation, and persistence after a full restart. Screenshots were inspected for table readability and submenu controls. This did not verify physical desktop click-through, every monitor arrangement, or macOS behavior; use the acceptance checks above for those.
