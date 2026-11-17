// Builds dist/: the whole game as static files that any web host can serve.
// A solo run needs no server, because the rules run in the browser. Usage: npm run build
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
const copy = (from, to) => { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); };

fs.rmSync(out, { recursive: true, force: true });
for (const f of fs.readdirSync(path.join(root, 'client'))) copy(path.join(root, 'client', f), path.join(out, f));
// The rules, exactly as the server runs them.
for (const f of ['game.js', 'data.js', 'act.js']) copy(path.join(root, 'server', f), path.join(out, 'rules', f));
// Only the parts of three.js the client imports.
const three = path.join(root, 'node_modules/three');
for (const f of ['build/three.module.js', 'build/three.core.js', 'examples/jsm/utils/BufferGeometryUtils.js', 'LICENSE']) {
  if (fs.existsSync(path.join(three, f))) copy(path.join(three, f), path.join(out, 'vendor/three', f));
}
// Hosts such as GitHub Pages must not run the files through Jekyll.
fs.writeFileSync(path.join(out, '.nojekyll'), '');

let bytes = 0, files = 0;
const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else { bytes += fs.statSync(p).size; files++; } } };
walk(out);
console.log(`dist/ is ready: ${files} files, ${(bytes / 1024 / 1024).toFixed(2)} MB. Serve the folder with any static web server.`);
