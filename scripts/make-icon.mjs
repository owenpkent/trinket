// Renders assets/icon.svg to a 1024x1024 PNG using headless Chrome or Edge, so
// the master icon is reproducible from source rather than checked in as a blob.
// Feed the result to `npm run tauri icon` to generate the platform icon set.
//
// Usage: node scripts/make-icon.mjs
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const SIZE = 1024;
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const assets = path.join(root, 'assets');
const svg = readFileSync(path.join(assets, 'icon.svg'), 'utf8');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;background:transparent}svg{display:block}
</style></head><body>${svg}</body></html>`;

const htmlPath = path.join(assets, '_icon.html');
writeFileSync(htmlPath, html);

const browsers = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];
const browser = browsers.find((candidate) => existsSync(candidate));
if (!browser) {
  console.error('No Chrome or Edge found for headless rendering.');
  process.exit(1);
}

const out = path.join(assets, 'icon.png');
execFileSync(browser, [
  '--headless',
  '--disable-gpu',
  '--hide-scrollbars',
  '--force-device-scale-factor=1',
  '--default-background-color=00000000',
  `--window-size=${SIZE},${SIZE}`,
  `--screenshot=${out}`,
  `file:///${htmlPath.replace(/\\/g, '/')}`,
]);

unlinkSync(htmlPath);
console.log('Wrote', path.relative(root, out));
