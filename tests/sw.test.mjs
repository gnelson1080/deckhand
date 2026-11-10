import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Load sw.js in a sandbox and expose its top-level helper functions.
function loadSW(extra = {}) {
  const listeners = {};
  const ctx = { self: { addEventListener: (t, f) => (listeners[t] = f), location: { origin: 'https://app.test' } }, location: { origin: 'https://app.test' }, URL, Response, Request, setTimeout, clearTimeout, Promise, console, ...extra };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), ctx);
  return { ctx, listeners };
}
const res = (body, { status = 200, type = 'application/json', redirected = false } = {}) => {
  const r = new Response(body, { status, headers: { 'Content-Type': type } });
  Object.defineProperty(r, 'redirected', { value: redirected });
  return r;
};

test('data responses are cached only when ok, not redirected, and JSON', () => {
  const { ctx } = loadSW();
  assert.equal(ctx.cacheable(res('{}'), 'data'), true);
  assert.equal(ctx.cacheable(res('<html>login</html>', { type: 'text/html' }), 'data'), false, 'captive portal page');
  assert.equal(ctx.cacheable(res('nope', { status: 404 }), 'data'), false);
  assert.equal(ctx.cacheable(res('{}', { redirected: true }), 'data'), false);
});
test('app files are not cached when an HTML page comes back for a script', () => {
  const { ctx } = loadSW();
  assert.equal(ctx.cacheable(res('x', { type: 'text/javascript' }), 'shell', 'https://app.test/js/app.js'), true);
  assert.equal(ctx.cacheable(res('<html>', { type: 'text/html' }), 'shell', 'https://app.test/js/app.js'), false);
  assert.equal(ctx.cacheable(res('<html>', { type: 'text/html' }), 'shell', 'https://app.test/index.html'), true);
});
test('opaque image responses are never cached', () => {
  const { ctx } = loadSW();
  assert.equal(ctx.cacheable({ ok: false, status: 0, type: 'opaque', redirected: false, headers: new Headers() }, 'image'), false);
});
test('networkFirst falls back to cache after the timeout when the network hangs', async () => {
  const { ctx } = loadSW();
  const cached = res('{"cached":true}');
  const t = Date.now();
  const out = await ctx.networkFirst(() => new Promise(() => {}), async () => cached, 200);
  assert.equal(out, cached);
  assert.ok(Date.now() - t < 1000);
});
test('networkFirst uses the network answer when it is fast', async () => {
  const { ctx } = loadSW();
  const fresh = res('{"fresh":true}');
  const out = await ctx.networkFirst(async () => fresh, async () => res('{}'), 200);
  assert.equal(out, fresh);
});
