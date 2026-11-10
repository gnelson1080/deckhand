import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
const listed = JSON.parse(sw.match(/const PRECACHE = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));

test('service worker precaches every app file (js, css, content, assets)', () => {
  const files = ['js', 'css', 'content', 'assets'].flatMap(d => walk(join(ROOT, d))).map(p => relative(ROOT, p).split('\\').join('/')).filter(f => !f.endsWith('.md'));
  for (const f of files) assert.ok(listed.includes(f), `sw.js PRECACHE is missing ${f}`);
  for (const f of listed) assert.ok(f === './' || existsSync(join(ROOT, f)), `PRECACHE lists missing file ${f}`);
});
test('manifest is valid and its icons exist', () => {
  const m = JSON.parse(readFileSync(join(ROOT, 'manifest.webmanifest'), 'utf8'));
  assert.equal(m.display, 'standalone');
  assert.ok(m.start_url && m.name && m.short_name);
  assert.ok(m.icons.some(i => i.sizes === '512x512') && m.icons.some(i => i.purpose === 'maskable'));
  for (const i of m.icons) assert.ok(existsSync(join(ROOT, i.src)), i.src);
});
