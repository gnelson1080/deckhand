// Tap any .kw button anywhere in the app to see its plain-English meaning.
import { getGlossary, getCards } from '../data.js';
import { buildTermIndex, escapeHtml } from './rich-text.js';
import { openSheet } from './sheet.js';

let idxPromise;
export const termIndex = () => (idxPromise ||= getGlossary().then(buildTermIndex));

export async function defineTerm(term) {
  const glossary = await getGlossary();
  const g = glossary.find(x => x.term === term);
  if (!g) return;
  let example = '';
  if (g.example) {
    const card = (await getCards().catch(() => new Map())).get(g.example);
    if (card) example = `<a class="sheet-example" href="#/card/${encodeURIComponent(card.id)}">
      <img src="${escapeHtml(card.img)}" alt="" loading="lazy" width="72" height="100">
      <span><strong>Example: ${escapeHtml(displayName(card.name))}</strong><span class="muted">${escapeHtml(card.id)}. Tap to see the card.</span></span></a>`;
  }
  openSheet({
    title: g.term,
    html: `<p class="sheet-short">${escapeHtml(g.short)}</p>${g.long ? `<p class="muted">${escapeHtml(g.long)}</p>` : ''}${example}
      <a class="sheet-more" href="#/glossary/${encodeURIComponent(g.term)}">Open in glossary</a>`,
  });
}

export const displayName = n => String(n || '').replace(/\s*\((?:[A-Z]*\d+[A-Z\d-]*)\)\s*$/, '');

export function installDefineHandler() {
  document.addEventListener('click', e => {
    const b = e.target.closest('button.kw');
    if (!b) return;
    e.preventDefault();
    defineTerm(b.dataset.term);
  });
}
