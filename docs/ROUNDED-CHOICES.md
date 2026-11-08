# Rounded choices and popup regression checks

This updates the first-menu steps in WINDOWS-ACCEPTANCE.md. The storage, daily reset, drag, monitor, and tray checks there still apply. No release/tag is approved by these checks alone.

- Click a visible mascot pixel once: rounded choices appear around it, with no rectangular background. Click again or press Escape to dismiss them.
- With empty history, Other…, Habit Tracker, and Motivation appear. Other… opens a normal-sized visible text-entry panel and explains how to save the first prompt. It must not appear minimized or at off-screen icon coordinates.
- Save a prompt. The two saved-prompt choices now show actual prompt text, not category labels. Selecting either appends one use and opens the full saved text. Verify updated latest/frequency values by saving different prompts; ties still favor the most recent use.
- Choose Habit Tracker: the full checklist panel appears. Check editing/keyboard controls using the main acceptance checklist. Back to choices and Close tracker return to the rounded choices.
- Choose Motivation: a quote appears. Another quote selects from the same list of 20; a repeat is valid. Verify prompt-history and habits files are unchanged by quote selection.
- Put Notepad underneath. A gap between choices must pass clicks to Notepad; the transparent middle must let the mascot receive its own clicks. Button corners outside the visible pill must also pass input through.
- Near each screen corner and on a different-DPI monitor, choices remain on-screen and do not cover the mascot. Near edges they may gather in a column. Tab/Shift+Tab/Enter and visible focus work on choice buttons.
- Open a detail page, close it, and repeat. Minimize to tray and restore, then open it again: content must have a positive-sized visible client area every time.
- Dragging and tray minimization hide choices and details. A delayed redraw must not reopen them after minimization.

Automated tests: `npm test` runs Node's built-in tests for the 20-quote list and choice geometry, followed by Rust history/habit/storage/native-mask tests. Windows interactive checks need an active desktop; CI builds do not establish visual correctness.
