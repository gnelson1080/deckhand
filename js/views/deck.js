import { winRate } from './meta.js';
import { getMeta, getCards, getDeckGuide, tcgplayerUrl, formatDate } from '../data.js';
import { thumb } from '../lib/search.js';
import { deckStats } from '../lib/deckstats.js';
import { escapeHtml, richText, safeUrl, safeColors } from '../ui/rich-text.js';
import { termIndex, displayName } from '../ui/define.js';
import { costCurve, difficultyMarks, difficultyLabel } from '../ui/charts.js';
import { icon } from '../icons.js';

export async function render(root, param) {
  const rank = parseInt(param, 10);
  const [meta, cards, idx] = await Promise.all([getMeta(), getCards(), termIndex()]);
  const d = meta.decks.find(x => x.rank === rank);
  if (!d) { root.innerHTML = `<h1 class="page-title">Deck not found</h1><a class="btn" href="#/meta">See today's top decks</a>`; return; }
  const g = await getDeckGuide(d.leaderId);
  const L = cards.get(d.leaderId);
  let listIdx = 0;

  root.innerHTML = `
    <a class="back-link" href="#/meta" data-back>${icon('back', { size: 20 })}Top decks</a>
    <header class="deck-hero">
      <a class="deck-leader" href="#/card/${encodeURIComponent(d.leaderId)}"><img src="${escapeHtml(L?.img || '')}" alt="${escapeHtml(L?.name || '')} Leader card" width="600" height="838"></a>
      <div>
        <p class="deck-rank"><span class="rank">#${Number(d.rank) || 0}</span> right now, ${Number(d.share) || 0}% of top decks</p>
        ${winRate(d.online)}
        <h1 class="deck-title">${escapeHtml(g?.title || d.name)}</h1>
        <p class="meta-sub">${safeColors(d.colors).map(c => `<span class="dot ${c}"></span>${c}`).join(' ')}</p>
        ${g ? `<p class="deck-diff">${difficultyMarks(g.difficulty)}${escapeHtml(difficultyLabel(g.difficulty))}</p>` : ''}
      </div>
    </header>
    <div class="deck-cols">
    ${g ? `<section class="guide">
        <p class="guide-summary">${richText(g.summary, idx)}</p>
        <h2>Game plan</h2><ol class="plan">${g.gamePlan.map(s => `<li>${richText(s, idx)}</li>`).join('')}</ol>
        <h2>Key cards</h2><div class="key-cards">${g.keyCards.map(k => { const c = cards.get(k.id); return `<a class="key-card" href="#/card/${encodeURIComponent(k.id)}"><img src="${escapeHtml(thumb(c?.img || ''))}" alt="" loading="lazy" width="200" height="279"><span><strong>${escapeHtml(displayName(c?.name || k.id))}</strong><span>${richText(k.why, idx)}</span></span></a>`; }).join('')}</div>
        <h2>How it wins</h2><p>${richText(g.howItWins, idx)}</p>
        <h2>Watch out for</h2><ul>${g.weakTo.map(w => `<li>${richText(w, idx)}</li>`).join('')}</ul>
        <aside class="tip"><span class="tip-flag" aria-hidden="true"></span><div><strong>Opening hand:</strong> ${richText(g.mulliganTips, idx)}</div></aside>
      </section>` : `<p class="page-lede">No beginner guide for this deck yet. Here's a winning list to study.</p>`}
    <section class="decklist">
      <h2>A winning list</h2>
      ${d.lists.length > 1 ? `<div class="list-tabs" role="tablist">${d.lists.map((l, i) => `<button type="button" role="tab" class="chip" aria-pressed="${i === 0}" data-list="${i}">${escapeHtml(l.place || '')}, ${escapeHtml(l.event || 'tournament')}</button>`).join('')}</div>` : ''}
      <div class="list-body"></div>
    </section>
    </div>`;

  const body = root.querySelector('.list-body');
  const drawList = () => {
    const l = d.lists[listIdx];
    const s = deckStats(l.cards, cards);
    const group = (name, items) => items.length ? `<h3>${name} <span class="muted">(${items.reduce((n, x) => n + x.count, 0)})</span></h3>
      <ul class="dl-grid">${items.map(x => `<li><a href="#/card/${encodeURIComponent(x.id)}" class="dl-card"><img src="${escapeHtml(thumb(x.card?.img || ''))}" alt="" loading="lazy" width="200" height="279"><span class="dl-count">${Number(x.count) || 0}×</span><span class="dl-name">${escapeHtml(displayName(x.card?.name || x.id))}</span></a></li>`).join('')}</ul>` : '';
    body.innerHTML = `
      <p class="muted">${escapeHtml(l.player || 'A player')} placed ${escapeHtml(l.place || '')} at ${escapeHtml(l.event || 'a tournament')}${l.players ? ` (${Number(l.players) || 0} players)` : ''}${l.date ? `, ${formatDate(l.date)}` : ''}.</p>
      <div class="deck-stats">
        <div class="stat"><span class="stat-v">${s.total}</span><span class="stat-l">cards in deck</span></div>
        <div class="stat"><span class="stat-v">${s.counters}</span><span class="stat-l">with Counter</span></div>
        <div class="stat"><span class="stat-v">${s.price ? '$' + Math.round(s.price) : '—'}</span><span class="stat-l">about, on TCGplayer</span></div>
      </div>
      ${costCurve(s.curve)}
      ${group('Characters', s.byType.Character)}${group('Events', s.byType.Event)}${group('Stages', s.byType.Stage)}${group('Other', s.byType.Other)}
      <p class="list-links"><a class="btn btn-primary" href="#/build/from/${Number(d.rank) || 0}/${listIdx}">${icon('anchor', { size: 16 })}Copy into my decks</a>${l.url ? `<a class="btn" href="${escapeHtml(safeUrl(l.url))}" target="_blank" rel="noopener">Full list on TCGplayer ${icon('link', { size: 16 })}</a>` : ''}
        <a class="btn" href="${escapeHtml(safeUrl(tcgplayerUrl(L)))}" target="_blank" rel="noopener">Buy the Leader ${icon('link', { size: 16 })}</a></p>
      <p class="muted small">Price is an estimate from TCGplayer market prices for the cheapest common printing of each card.</p>`;
  };
  root.querySelector('.list-tabs')?.addEventListener('click', e => {
    const b = e.target.closest('[data-list]'); if (!b) return;
    listIdx = +b.dataset.list;
    root.querySelectorAll('[data-list]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    drawList();
  });
  drawList();
}
