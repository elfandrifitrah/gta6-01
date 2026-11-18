// Capture the four screenshots in shots.json by rendering the real game
// headlessly. Serves the repo with node serve.ts, loads each ?shot= query
// in Chromium (SwiftShader), waits for window.__shotReady, and writes a
// JPEG under the 256 KiB dossier cap, lowering quality until it fits.
// Fails loudly on console errors, page errors, or non-localhost requests.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire('/home/hatch/workspace/stick-scene-checks/package.json');
const { chromium } = require('playwright');

const SHOTS = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));
const MAX_BYTES = 262144;
const PORT = 8080;

function waitForServer(url, timeoutMs) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(url);
        // Confirm the page is this game's, not a stale server on the port.
        if (res.ok && (await res.text()).includes('Jakarta Heat')) return resolve();
      } catch { /* not up yet */ }
      if (Date.now() - start > timeoutMs) return reject(new Error('server did not come up'));
      setTimeout(tick, 250);
    };
    tick();
  });
}

async function main() {
  const server = spawn('node', ['serve.ts'], { cwd: here, stdio: 'pipe' });
  const errors = [];
  try {
    await waitForServer(`http://localhost:${PORT}/`, 15000);
    const browser = await chromium.launch({
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox', '--no-sandbox'],
    });
    try {
      for (const shot of SHOTS) {
        const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
        const shotErrors = [];
        page.on('console', (msg) => {
          if (msg.type() === 'error') shotErrors.push(`console: ${msg.text()}`);
        });
        page.on('pageerror', (err) => shotErrors.push(`pageerror: ${err.message}`));
        page.on('request', (req) => {
          const url = req.url();
          if (!url.startsWith('http://localhost:') && !url.startsWith('http://127.0.0.1:')) {
            shotErrors.push(`non-local request: ${url}`);
          }
        });
        await page.goto(`http://localhost:${PORT}/${shot.query}`, { waitUntil: 'load', timeout: 60000 });
        await page.waitForFunction('window.__shotReady === true', null, { timeout: 90000 });
        await page.waitForTimeout(600);
        let quality = 82;
        let buffer = null;
        while (quality >= 40) {
          buffer = await page.screenshot({ type: 'jpeg', quality });
          if (buffer.length <= MAX_BYTES) break;
          quality -= 10;
        }
        if (buffer.length > MAX_BYTES) {
          throw new Error(`${shot.name}: ${buffer.length} bytes even at quality ${quality}`);
        }
        writeFileSync(join(here, 'screenshots', shot.name), buffer);
        console.log(`${shot.name}: ${buffer.length} bytes at quality ${quality}`);
        if (shotErrors.length > 0) {
          errors.push(`${shot.name}: ${shotErrors.join(' | ')}`);
        }
        await page.close();
      }
    } finally {
      await browser.close();
    }
  } finally {
    server.kill();
  }
  if (errors.length > 0) {
    console.error('ERRORS:\n' + errors.join('\n'));
    process.exit(1);
  }
  console.log('All shots captured with zero console errors.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
