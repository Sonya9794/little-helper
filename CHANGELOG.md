# Changelog

## 0.0.2

- Normal/DVD mode slider in Other…; optional native diagonal gliding with edge/corner bounces, interaction pauses, and no storage writes per animation frame.
- Sustained shaking longer than two seconds escalates to stronger multidirectional motion and ends in an angry stare with inward-slanted eye tops.
- Fast mouse wiggles or small circles over the mascot trigger a slight shake followed by one second of wide circular eyes with pupils and no mouth.
- Release frontend press/hover state when native dragging takes over, so hovering works again even when Windows consumes the mouse-up event.
- A quick hover hop with excited `> <` eyes and no mouth; clicking clears the expression, and reduced-motion preferences skip the hop.

## 0.0.1

- Fixed popup restoration: restore minimized native windows before measuring, placing, and showing them.
- Rounded click-through choices around the mascot, using saved prompt text as labels and adapting to screen edges.
- Motivation page with 20 original locally bundled quotes; no history/storage writes for quotes.
- UI geometry/quote tests and explicit native scene sizing for alpha masks.

- Original temporary seed-bot mascot in a small transparent, frameless, always-on-top window.
- Windows native alpha-derived input regions, click/drag distinction, saved position, monitor clamping, and anchored panel.
- Offline prompt entry, local JSON history capped at 100 records, frequency/latest statistics, and a future submission boundary.
- Editable daily habits with stable IDs, ordering, deletion confirmation for checked habits, and local-date resets.
- Tray minimize, restore, and Quit; single-instance lifecycle.
- Focused storage/history/habit/alpha-mask tests, portable Windows build, documentation, and Windows/macOS CI.
- macOS compilation support with an explicitly limited decorative, click-through mascot until a correct native alpha-hit adapter is implemented and tested on macOS.
- License decision remains pending.
