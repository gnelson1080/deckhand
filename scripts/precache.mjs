// Rewrites the PRECACHE list in sw.js from the files on disk and bumps the cache version.
// Run after adding or removing app files: node scripts/precache.mjs
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = ['js', 'css', 'content', 'assets'].flatMap(d => walk(join(ROOT, d))).map(p => relative(ROOT, p).split('\\').join('/')).filter(f => !f.endsWith('.md')).sort();
const list = ['./', 'index.html', 'manifest.webmanifest', ...files];
const hash = createHash('sha1');
for (const f of list.slice(1)) hash.update(f).update(readFileSync(join(ROOT, f)));
const version = hash.digest('hex').slice(0, 10);
const swPath = join(ROOT, 'sw.js');
let sw = readFileSync(swPath, 'utf8');
sw = sw.replace(/const PRECACHE = \[[\s\S]*?\];/, `const PRECACHE = ${JSON.stringify(list, null, 2).replace(/"/g, "'")};`);
sw = sw.replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`);
writeFileSync(swPath, sw);
console.log(`sw.js: ${list.length} files, version ${version}`);
