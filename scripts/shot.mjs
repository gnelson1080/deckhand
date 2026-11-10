// Screenshot helper: node scripts/shot.mjs <hash> <out.png> [light|dark] [width] [height]
import { createRequire } from 'node:module';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [hash = '#/learn', out = 'shot.png', theme = 'light', w = '390', h = '844', full = ''] = process.argv.slice(2);
const server = await startServer(0);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: +w, height: +h }, colorScheme: theme, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://localhost:${server.address().port}/${hash}`);
await page.waitForTimeout(1500);
await page.screenshot({ path: out, fullPage: full === 'full' });
if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
await browser.close(); server.close();
