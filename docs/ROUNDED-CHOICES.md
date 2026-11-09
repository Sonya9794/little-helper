# Rounded choices and popup regression checks

This updates the first-menu steps in WINDOWS-ACCEPTANCE.md. The storage, daily reset, drag, monitor, and tray checks there still apply. No release/tag is approved by these checks alone.

- Click a visible mascot pixel once: rounded choices appear around it, with no rectangular background. Click again or press Escape to dismiss them.
- Hover over a visible mascot pixel: one quick hop (about 280 ms), with `> <` eyes and no mouth. The excited face stays while hovering after landing; leaving restores the normal face, and clicking clears excitement immediately. Check that resting on an edge does not trigger repeated hops, and dragging still works. With Windows animation/reduced-motion preferences enabled, only the expression changes. During the hop, transparent pixels must still pass input through.
- With empty history, Other…, Habit Tracker, and Motivation appear. Other… opens a normal-sized visible text-entry panel and explains how to save the first prompt. It must not appear minimized or at off-screen icon coordinates.
- Save a prompt. The two saved-prompt choices now show actual prompt text, not category labels. Selecting either appends one use and opens the full saved text. Verify updated latest/frequency values by saving different prompts; ties still favor the most recent use.
- Choose Habit Tracker: the full checklist panel appears. Check editing/keyboard controls using the main acceptance checklist. Back to choices and Close tracker return to the rounded choices.
- Choose Motivation: a quote appears. Another quote selects from the same list of 20; a repeat is valid. Verify prompt-history and habits files are unchanged by quote selection.
- Put Notepad underneath. A gap between choices must pass clicks to Notepad; the transparent middle must let the mascot receive its own clicks. Button corners outside the visible pill must also pass input through.
- Near each screen corner and on a different-DPI monitor, choices remain on-screen and do not cover the mascot. Near edges they may gather in a column. Tab/Shift+Tab/Enter and visible focus work on choice buttons.
- Open a detail page, close it, and repeat. Minimize to tray and restore, then open it again: content must have a positive-sized visible client area every time.
- Dragging and tray minimization hide choices and details. A delayed redraw must not reopen them after minimization.
- Hover, drag, release, move away, then hover again without clicking: the hop and excited eyes must work each time, including after a quick drag and repeated drags.
- Wiggle the mouse rapidly back and forth, or draw small quick circles over the mascot without holding a button: it shakes slightly, then stops and stares with two big circular eyes and pupils (no mouth) for about a second. Slow motion or a straight pass should not trigger it. Clicking or starting a drag clears the reaction. With reduced motion enabled it changes expressions without shaking. Transparent pixels still pass through throughout.
- Keep wiggling for more than two seconds: the shake becomes much stronger sideways, vertically, and with a small rotation. Stop: the same round eyes now have inward-slanted upper edges and pupils, with no mouth, for one second. The artwork must stay inside its window without clipping. Separate short shaking bouts must not add up to escalation. Reduced motion must suppress all displacement, rotation, and scaling while still showing the angry stare.

Automated tests: `npm test` runs Node's built-in tests for the 20-quote list and choice geometry, followed by Rust history/habit/storage/native-mask tests. Windows interactive checks need an active desktop; CI builds do not establish visual correctness.

## Normal/DVD mode

- Open Other… and find Mode below the prompt form. Tab to its two-stop slider and use arrows/Home/End to select Normal/DVD. Its accessible value should read Normal or DVD. Type a prompt draft first and verify switching modes preserves it without saving it to history.
- Select DVD, close the panel/choices, and move the pointer away: the mascot glides diagonally around the current monitor and reflects off all four usable edges. The taskbar remains clear. A corner hit reverses both axes. Transparent pixels still pass through while moving.
- Hover the mascot: it pauses so you can click or shake it. Move away: it resumes. Choices, detail pages, and the right-click menu must pause it, with no drifting panels or reset clicks required.
- Drag in DVD mode and release, including releasing outside the mascot: it must not fight the drag or stay stuck afterward. Drag to another monitor and check it continues within that monitor's work area. Change monitor arrangements or wake from sleep: it stays reachable and does not teleport to catch up.
- Select Normal: it stops immediately at its current position, with the original hover/drag/menu behavior intact. Tray minimization hides all windows and pauses DVD; restoring resumes the selected session mode. Quit and relaunch: Normal is selected and the last saved position is reachable.
- Prompt/habit files must remain unchanged by mode selection and gliding. Position saves occur at stop/tray/quit, not continuously while gliding. macOS compilation and visual checks still require a Mac; its existing decorative-mascot/native-hit-testing limitation remains.
