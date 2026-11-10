// Bottom sheet: slides up, drag down or Esc to close, focus stays inside while open.
import { icon } from '../icons.js';

let el, panel, lastFocus, dragY = null, startY = 0;

function ensure() {
  if (el) return;
  el = document.createElement('div');
  el.className = 'sheet';
  el.hidden = true;
  el.innerHTML = `<div class="sheet-scrim" data-close></div>
    <div class="sheet-panel" role="dialog" aria-modal="true" aria-labelledby="sheet-title" tabindex="-1">
      <div class="sheet-grip" aria-hidden="true"></div>
      <div class="sheet-head"><h2 id="sheet-title"></h2><button class="icon-btn" type="button" data-close aria-label="Close">${icon('close')}</button></div>
      <div class="sheet-body"></div>
    </div>`;
  document.body.append(el);
  panel = el.querySelector('.sheet-panel');
  el.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSheet(); });
  el.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSheet();
    if (e.key === 'Tab') {
      const f = [...panel.querySelectorAll('button, a[href], input, [tabindex]:not([tabindex="-1"])')];
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
      else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
    }
  });
  const grip = el.querySelector('.sheet-head');
  grip.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; startY = e.clientY; dragY = 0; panel.style.transition = 'none'; grip.setPointerCapture(e.pointerId); });
  grip.addEventListener('pointermove', e => { if (dragY === null) return; dragY = Math.max(0, e.clientY - startY); panel.style.transform = `translateY(${dragY}px)`; });
  const end = () => { if (dragY === null) return; panel.style.transition = ''; if (dragY > 90) closeSheet(); else panel.style.transform = ''; dragY = null; };
  grip.addEventListener('pointerup', end); grip.addEventListener('pointercancel', end);
}

export function openSheet({ title, html }) {
  ensure();
  lastFocus = document.activeElement;
  el.querySelector('#sheet-title').textContent = title;
  el.querySelector('.sheet-body').innerHTML = html;
  panel.style.transform = '';
  el.hidden = false;
  requestAnimationFrame(() => { el.classList.add('open'); panel.focus({ preventScroll: true }); });
}

export function closeSheet() {
  if (!el || el.hidden) return;
  el.classList.remove('open');
  const done = () => { el.hidden = true; lastFocus?.focus?.({ preventScroll: true }); };
  matchMedia('(prefers-reduced-motion: reduce)').matches ? done() : setTimeout(done, 260);
}
