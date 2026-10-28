// Packages the production build for distribution: one self-contained index.html (works when
// double-clicked, or uploaded to any static host such as itch.io) plus a readme, zipped.
// Usage: npm run package
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const { name, version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const dist = join(root, 'dist');
const release = join(root, 'release');
const folder = `${name}-${version}`;
const out = join(release, folder);
const zip = join(release, `${folder}.zip`);

// Browsers refuse to load module scripts from file:// URLs, so the bundle and styles are inlined.
// Inline module scripts are still deferred, so the script can stay in <head>.
// Function replacements keep `$` sequences in the bundle from being read as patterns.
const asset = (path) => readFileSync(join(dist, path), 'utf8');
let html = readFileSync(join(dist, 'index.html'), 'utf8');
let scripts = 0;
let styles = 0;
html = html.replace(/<script type="module" crossorigin src="(?:\.\/|\/)?(assets\/[^"]+\.js)"><\/script>/g, (_m, path) => {
  const code = asset(path);
  if (/<\/script/i.test(code)) throw new Error(`${path} contains "</script" and cannot be inlined`);
  scripts++;
  return `<script type="module">${code}</script>`;
});
html = html.replace(/<link rel="stylesheet"(?: crossorigin)? href="(?:\.\/|\/)?(assets\/[^"]+\.css)">/g, (_m, path) => {
  styles++;
  return `<style>${asset(path)}</style>`;
});
if (scripts !== 1 || styles !== 1) throw new Error(`expected 1 script and 1 stylesheet, inlined ${scripts} and ${styles}`);

const readme = `Bulwark ${version}
${'='.repeat(8 + version.length)}

A 3D sci-fi base-defence game for desktop browsers.

How to play
-----------
Open index.html in Chrome, Edge, Firefox or Safari. No install or server needed.
To publish it on the web, upload index.html to any static host (for example itch.io as an HTML game).

Requirements
------------
- A desktop browser with WebGL 2 and a reasonably modern GPU.
- Mouse and keyboard.
- Fonts load from Google Fonts when online. Offline, the game falls back to system fonts.

Controls
--------
Mouse / hold left button   Aim and fire the core gun
Right button               Swarm missiles at enemies near the cursor
A S D F / Tab              Switch gun mode (Tab cycles)
T                          Toggle auto-fire
Space                      Nova pulse around the core
1-5                        Select a structure to build
Shift + click              Keep placing the same structure
X                          Sell the hovered structure
Q W E R                    Deploy a squad
Enter                      Launch the next wave (during a wave, call it early)
Wheel / P / M              Zoom / pause / mute
`;

rmSync(release, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'index.html'), html);
writeFileSync(join(out, 'README.txt'), readme);
execFileSync('zip', ['-9', '-r', '-X', '-q', zip, folder], { cwd: release });

const kb = (path) => `${(statSync(path).size / 1024).toFixed(0)} KB`;
console.log(`index.html ${kb(join(out, 'index.html'))}  ->  ${zip} (${kb(zip)})`);
