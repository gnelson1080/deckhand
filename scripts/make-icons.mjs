// Renders assets/app-icon.svg into the PNG app icons: node scripts/make-icons.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const svg = readFileSync(new URL('../assets/app-icon.svg', import.meta.url), 'utf8');
const b = await chromium.launch();
for (const [name, size, pad] of [['icon-192.png', 192, 0], ['icon-512.png', 512, 0], ['icon-maskable.png', 512, 0.12]]) {
  const p = await b.newPage({ viewport: { width: size, height: size } });
  const inner = Math.round(size * (1 - pad * 2));
  await p.setContent(`<body style="margin:0;background:#12304a;display:grid;place-items:center;height:${size}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</body>`);
  await p.screenshot({ path: new URL(`../assets/${name}`, import.meta.url).pathname, omitBackground: false });
  await p.close();
}
await b.close();
console.log('icons written');
