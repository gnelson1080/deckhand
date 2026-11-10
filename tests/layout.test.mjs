import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestLayout, readLayout } from '../js/lib/layout.js';

test('wide screens with a mouse suggest the computer layout', () => {
  assert.equal(suggestLayout({ width: 1440, coarse: false }), 'desktop');
  assert.equal(suggestLayout({ width: 1100, coarse: false }), 'desktop');
});
test('phones, small windows and touch tablets suggest the phone layout', () => {
  assert.equal(suggestLayout({ width: 390, coarse: true }), 'mobile');
  assert.equal(suggestLayout({ width: 900, coarse: false }), 'mobile');
  assert.equal(suggestLayout({ width: 1180, coarse: true }), 'mobile');
});
test('readLayout only accepts known values', () => {
  const st = v => ({ get: () => v });
  assert.equal(readLayout(st('desktop')), 'desktop');
  assert.equal(readLayout(st('mobile')), 'mobile');
  assert.equal(readLayout(st('banana')), null);
  assert.equal(readLayout(st(null)), null);
});
