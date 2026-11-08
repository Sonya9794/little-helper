# Changelog

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
