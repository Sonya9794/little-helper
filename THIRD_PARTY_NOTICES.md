# Third-party chess components

Little Helper's own software-license decision remains pending. These third-party licenses apply to their respective components; no project-wide license is selected here.

## Stockfish.js 19.0.1 / Stockfish 19 Lite

- Copyright 2026 Chess.com, LLC; Stockfish contributors and other credits appear in the unmodified worker header and upstream AUTHORS.
- License: GNU GPL version 3. Full license text is included in built assets at `third-party/Stockfish-GPL-3.0.txt`.
- Exact matching source tag: <https://github.com/nmrugg/stockfish.js/tree/v19.0.1>
- Matching commit: `0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6`.
- Source archive: <https://github.com/nmrugg/stockfish.js/archive/0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6.tar.gz>
- Distributed package: <https://registry.npmjs.org/stockfish/-/stockfish-19.0.1.tgz>, pinned with its integrity hash in `package-lock.json`.
- Build instructions and prerequisites are in that source revision's README/build scripts. The selected flavor is Lite single-threaded (`stockfish-19-lite-single.js` and its matching `.wasm`). These files are copied without modification, served as a separate local worker, and retain upstream notices. NNUE/network credits and obtaining build inputs are documented upstream.
- The built application also contains `third-party/SOURCES.txt` with source pointers. Preserve GPL notices and provide matching source information when redistributing Stockfish, including with portable copies. Distribution of the combined application needs an explicit project licensing decision/review before a public release; this implementation does not make that decision.

## chess.js 1.4.0

- Copyright 2025 Jeff Hlywa.
- BSD 2-Clause license: <https://github.com/jhlywa/chess.js/blob/v1.4.0/LICENSE>
- Source: <https://github.com/jhlywa/chess.js/tree/v1.4.0>.
- Full license/copyright text is included in built assets at `third-party/chess.js-BSD-2-Clause.txt`.

These components are installed locally through npm and bundled into the offline app. Runtime access to those URLs is not required. Existing Tauri, Rust, and frontend dependencies retain their own licenses recorded in their source distributions and lock files.
