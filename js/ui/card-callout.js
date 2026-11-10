// A real card picture with numbered pins pointing at its parts (cost, power, counter...).
import { getCards } from '../data.js';
import { escapeHtml, richText } from './rich-text.js';
import { termIndex } from './define.js';

// Pin positions as % of the card frame (official card layout).
const SPOTS = {
  normal: { cost: [9, 6], power: [80, 4.5], attribute: [92, 10], counter: [5.5, 34], effect: [50, 66], trigger: [50, 79], name: [50, 87], type: [50, 92], color: [7, 95] },
  leader: { power: [80, 4.5], attribute: [92, 10], effect: [50, 68], name: [50, 86], type: [50, 92], life: [89, 87], color: [7, 95] },
};

export async function renderCallout(el, { cardId, callouts }) {
  const [cards, idx] = await Promise.all([getCards().catch(() => new Map()), termIndex()]);
  const c = cards.get(cardId);
  if (!c) { el.innerHTML = `<p class="muted">Card ${escapeHtml(cardId)} couldn't load.</p>`; return; }
  const spots = c.type === 'Leader' ? SPOTS.leader : SPOTS.normal;
  el.classList.add('callout');
  el.innerHTML = `<figure class="callout-fig">
      <div class="callout-card"><img src="${escapeHtml(c.img)}" alt="${escapeHtml(c.name)} (${escapeHtml(c.id)})" loading="lazy" width="600" height="838">
        ${callouts.map((k, i) => { const [x, y] = spots[k.part] || [50, 50]; return `<button type="button" class="pin" style="--x:${x}%;--y:${y}%;--d:${i * 140}ms" data-i="${i}" aria-label="${i + 1}: ${escapeHtml(k.label)}">${i + 1}</button>`; }).join('')}
      </div>
      <figcaption><ol class="pin-list">${callouts.map((k, i) => `<li data-i="${i}"><span class="pin-n">${i + 1}</span><span>${richText(k.label, idx)}</span></li>`).join('')}</ol></figcaption>
    </figure>`;
  const focus = i => el.querySelectorAll('[data-i]').forEach(n => n.classList.toggle('on', n.dataset.i === String(i)));
  el.addEventListener('click', e => { const p = e.target.closest('.pin, .pin-list li'); if (p) focus(p.dataset.i); });
  const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { el.classList.add('shown'); io.disconnect(); } }, { threshold: .35 });
  io.observe(el);
}
