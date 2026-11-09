import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
// Keep the unmodified engine as a separate local worker, not in our JS bundle.
const engineFiles = new Map([
  ['engine/stockfish-19-lite-single.js', ['node_modules/stockfish/bin/stockfish-19-lite-single.js', 'text/javascript']],
  ['engine/stockfish-19-lite-single.wasm', ['node_modules/stockfish/bin/stockfish-19-lite-single.wasm', 'application/wasm']],
  ['third-party/Stockfish-GPL-3.0.txt', ['node_modules/stockfish/Copying.txt', 'text/plain']],
  ['third-party/chess.js-BSD-2-Clause.txt', ['node_modules/chess.js/LICENSE', 'text/plain']],
]);
export default defineConfig({
  plugins: [{
    name: 'local-chess-engine',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const entry = engineFiles.get((request.url ?? '').split('?')[0].replace(/^\//, ''));
        if (!entry) { next(); return; }
        response.setHeader('Content-Type', entry[1]); response.end(readFileSync(resolve(entry[0])));
      });
    },
    generateBundle() {
      for (const [fileName, [source]] of engineFiles) this.emitFile({ type: 'asset', fileName, source: readFileSync(resolve(source)) });
      this.emitFile({ type: 'asset', fileName: 'third-party/SOURCES.txt', source: 'Stockfish.js 19.0.1, unmodified lite-single worker. GPLv3.\nMatching source and build instructions: https://github.com/nmrugg/stockfish.js/tree/0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6\nSource archive: https://github.com/nmrugg/stockfish.js/archive/0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6.tar.gz\nPackage: https://registry.npmjs.org/stockfish/-/stockfish-19.0.1.tgz\nchess.js 1.4.0, BSD-2-Clause: https://github.com/jhlywa/chess.js/tree/v1.4.0\nLittle Helper license decision remains pending.\n' });
    },
  }],
  clearScreen: false,
  server: { port: 1420, strictPort: true, host: '127.0.0.1' },
  build: { target: 'es2022' }
});
