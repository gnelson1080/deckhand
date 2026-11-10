// "My decks": saved decks, new deck, import a pasted list.
import { getCards } from '../data.js';
import { store } from '../store.js';
import { createDecks } from '../lib/decks-store.js';
import { parseDeckText, validateDeck, deckTotal } from '../lib/deck.js';
import { deckStats } from '../lib/deckstats.js';
import { thumb } from '../lib/search.js';
import { escapeHtml, safeColors } from '../ui/rich-text.js';
import { displayName } from '../ui/define.js';
import { openSheet, closeSheet } from '../ui/sheet.js';
import { go } from '../router.js';
import { icon } from '../icons.js';

export const ring = (n, max = 50, size = 44) => {
  const r = size / 2 - 4, c = 2 * Math.PI * r, k = Math.min(1, n / max);
  const tone = n === max ? 'var(--good)' : n > max ? 'var(--bad)' : 'var(--sea)';
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--rule)" stroke-width="4"/>
    <circle class="ring-v" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${tone}" stroke-width="4" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - k)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" class="ring-t">${n}</text></svg>`;
};

export async function render(root) {
  const decks = createDecks(store());
  const cards = await getCards().catch(() => new Map());
  const list = decks.list();

  root.innerHTML = `
    <h1 class="page-title">My decks</h1>
    <p class="page-lede">Build a deck, check that it's legal, and see what it costs. Decks are saved on this device.</p>
    <div class="deck-actions">
      <a class="btn btn-primary" href="#/build/new">${icon('anchor', { size: 18 })}New deck</a>
      <button type="button" class="btn import-btn">Paste a list</button>
    </div>
    ${list.length ? `<ul class="my-decks">${list.map((d, i) => {
      const L = cards.get(d.leaderId);
      const v = validateDeck(d, cards);
      const s = deckStats(d.entries, cards);
      return `<li style="--i:${i}"><a class="my-deck" href="#/build/${encodeURIComponent(d.id)}">
          ${L ? `<img src="${escapeHtml(thumb(L.img))}" alt="" width="200" height="279">` : '<span class="no-leader">?</span>'}
          <span class="my-deck-main"><strong>${escapeHtml(d.name)}</strong>
            <span class="meta-sub">${safeColors(L?.colors).map(c => `<span class="dot ${c}"></span>`).join('')}${escapeHtml(L ? displayName(L.name) : 'No Leader yet')}</span>
            <span class="my-deck-status ${v.ok ? 'ok' : ''}">${v.ok ? `${icon('check', { size: 14, stroke: 3 })}Tournament legal` : escapeHtml(v.problems[0]?.msg || '')}</span>${s.price ? `<span class="muted small">About $${Math.round(s.price)} on TCGplayer</span>` : ''}</span>
          ${ring(deckTotal(d))}
        </a>
        <span class="my-deck-tools"><button type="button" class="chip" data-dup="${escapeHtml(d.id)}">Duplicate</button><button type="button" class="chip" data-del="${escapeHtml(d.id)}">Delete</button></span></li>`;
    }).join('')}</ul>`
    : `<div class="empty decks-empty"><p><strong>No decks yet.</strong></p><p>Start a new one, or open a winning deck in the <a href="#/meta">Meta tab</a> and tap "Copy into my decks".</p></div>`}
    <p class="decks-foot">Switching phones? <a href="#/about">Back up your decks and lessons</a>.</p>`;

  root.querySelector('.my-decks')?.addEventListener('click', e => {
    const dup = e.target.closest('[data-dup]');
    const del = e.target.closest('[data-del]');
    if (dup) { decks.duplicate(dup.dataset.dup); render(root); }
    if (del) {
      const d = decks.get(del.dataset.del);
      if (d && confirm(`Delete "${d.name}"? This can't be undone.`)) { decks.remove(d.id); render(root); }
    }
  });

  root.querySelector('.import-btn').addEventListener('click', () => {
    openSheet({ title: 'Paste a decklist', html: `<p class="muted">One card per line, like <code>4xOP01-016</code>. Lists copied from TCGplayer, Limitless or a simulator work.</p>
      <textarea class="import-box" rows="9" placeholder="1xOP13-001&#10;4xOP07-022&#10;4xST32-001"></textarea>
      <div class="import-report" aria-live="polite"></div>
      <button type="button" class="btn btn-primary btn-block import-go">Import</button>` });
    const sheet = document.querySelector('.sheet');
    sheet.querySelector('.import-go').addEventListener('click', () => {
      const p = parseDeckText(sheet.querySelector('.import-box').value, cards);
      const report = sheet.querySelector('.import-report');
      if (!p.leaderId && !p.entries.length) { report.innerHTML = `<p class="bad-text">No cards found. Check the format: <code>4xOP01-016</code>.</p>`; return; }
      const L = cards.get(p.leaderId);
      const d = decks.save({ name: L ? `${displayName(L.name)} deck` : 'Imported deck', leaderId: p.leaderId, entries: p.entries });
      if (p.bad.length) {
        report.innerHTML = `<p>Imported ${p.entries.reduce((n, e) => n + e.count, 0)} cards. These lines were skipped:</p><ul class="bad-lines">${p.bad.map(b => `<li><code>${escapeHtml(b.line)}</code> ${escapeHtml(b.reason)}</li>`).join('')}</ul>
          <a class="btn btn-primary btn-block" href="#/build/${encodeURIComponent(d.id)}">Open the deck</a>`;
        report.querySelector('a').addEventListener('click', closeSheet);
      } else { closeSheet(); go('build', d.id); }
    });
  });
}
