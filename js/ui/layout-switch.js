// Applies the chosen layout (computer or phone), asks on first open, and wires the header switch.
import { store } from '../store.js';
import { suggestLayout, readLayout } from '../lib/layout.js';
import { icon } from '../icons.js';

const html = document.documentElement;

export function applyLayout(layout) {
  html.dataset.layout = layout;
  const btn = document.getElementById('layout-toggle');
  if (btn) {
    const other = layout === 'desktop' ? 'phone' : 'computer';
    btn.innerHTML = icon(layout === 'desktop' ? 'phone' : 'monitor');
    btn.setAttribute('aria-label', `Switch to the ${other} version`);
    btn.title = `Switch to the ${other} version`;
  }
  dispatchEvent(new CustomEvent('layoutchange', { detail: layout }));
}

export function setLayout(layout, { rerender } = {}) {
  store().set('layout', layout);
  applyLayout(layout);
  rerender?.();
}

function chooser(onPick) {
  const suggested = suggestLayout({ width: innerWidth, coarse: matchMedia('(pointer: coarse)').matches });
  const el = document.createElement('div');
  el.className = 'layout-chooser';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'lc-title');
  el.innerHTML = `<div class="lc-box">
      <svg width="44" height="44" viewBox="0 0 32 32" aria-hidden="true"><use href="assets/icon.svg#mark"/></svg>
      <h1 id="lc-title" class="display">Welcome aboard</h1>
      <p>Which version do you want? You can switch anytime with the button at the top.</p>
      <div class="lc-options">
        <button type="button" class="lc-opt ${suggested === 'desktop' ? 'suggested' : ''}" data-layout="desktop">${icon('monitor', { size: 40, stroke: 1.6 })}<strong>Computer</strong><span>Big board, side-by-side deck builder, keyboard shortcuts</span>${suggested === 'desktop' ? '<em>Best fit for this screen</em>' : ''}</button>
        <button type="button" class="lc-opt ${suggested === 'mobile' ? 'suggested' : ''}" data-layout="mobile">${icon('phone', { size: 40, stroke: 1.6 })}<strong>Phone</strong><span>Made for one hand, tabs at the bottom, installs to your home screen</span>${suggested === 'mobile' ? '<em>Best fit for this screen</em>' : ''}</button>
      </div>
    </div>`;
  document.body.append(el);
  el.querySelector('.suggested')?.focus();
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-layout]'); if (!b) return;
    el.classList.add('closing');
    setTimeout(() => el.remove(), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 280);
    onPick(b.dataset.layout);
  });
}

export function initLayout(rerender) {
  const saved = readLayout(store());
  applyLayout(saved || suggestLayout({ width: innerWidth, coarse: matchMedia('(pointer: coarse)').matches }));
  if (!saved) chooser(l => setLayout(l, { rerender }));
  document.getElementById('layout-toggle')?.addEventListener('click', () => setLayout(html.dataset.layout === 'desktop' ? 'mobile' : 'desktop', { rerender }));
}
