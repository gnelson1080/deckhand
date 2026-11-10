import { getMeta, getCards, getUpdated, getDeckGuide, formatDate } from '../data.js';
import { thumb } from '../lib/search.js';
import { escapeHtml } from '../ui/rich-text.js';
import { shareBar, difficultyMarks, difficultyLabel } from '../ui/charts.js';
import { displayName } from '../ui/define.js';

export async function render(root) {
  root.innerHTML = `<h1 class="page-title">Today's top decks</h1><p class="muted">Loading tournament results…</p>`;
  let meta, cards, updated;
  try { [meta, cards, updated] = await Promise.all([getMeta(), getCards(), getUpdated()]); }
  catch { root.innerHTML = `<h1 class="page-title">Today's top decks</h1><p class="empty">Tournament data didn't load. Check your connection and try again.</p>`; return; }
  const guides = await Promise.all(meta.decks.map(d => getDeckGuide(d.leaderId)));
  const max = Math.max(...meta.decks.map(d => d.share));
  const easiest = meta.decks.map((d, i) => ({ d, g: guides[i] })).filter(x => x.g).sort((a, b) => a.g.difficulty - b.g.difficulty || a.d.rank - b.d.rank)[0];

  root.innerHTML = `
    <h1 class="page-title">Today's top decks</h1>
    <p class="page-lede">The Leaders winning the most tournaments right now, from ${meta.sampleSize ? `${meta.sampleSize} top-placing decklists` : 'recent decklists'}${meta.from ? ` (${formatDate(meta.from)} to ${formatDate(meta.to)})` : ''}.</p>
    <p class="updated-badge"><span class="dot" style="background:var(--good)"></span>Updated ${formatDate(updated.meta || meta.fetchedAt)} from ${escapeHtml(meta.source || 'tournament results')}</p>
    ${easiest ? `<a class="pick panel" href="#/deck/${easiest.d.rank}">
        <img src="${escapeHtml(thumb(cards.get(easiest.d.leaderId)?.img || ''))}" alt="" width="200" height="279">
        <span><span class="pick-label">New here? Start with</span><strong class="display">${escapeHtml(easiest.g.title)}</strong>
        <span class="muted">${escapeHtml(difficultyLabel(easiest.g.difficulty))}. Read the beginner guide.</span></span></a>` : ''}
    <ol class="meta-list">
      ${meta.decks.map((d, i) => {
        const L = cards.get(d.leaderId);
        const g = guides[i];
        return `<li style="--i:${i}"><a class="meta-row" href="#/deck/${d.rank}">
          <span class="meta-rank">${d.rank}</span>
          <img class="meta-leader" src="${escapeHtml(thumb(L?.img || ''))}" alt="" loading="lazy" width="200" height="279">
          <span class="meta-main">
            <span class="meta-name">${escapeHtml(d.name)}</span>
            <span class="meta-sub">${d.colors.map(c => `<span class="dot ${c}" title="${c}"></span>`).join('')}<span>${escapeHtml(displayName(L?.name || d.leaderId))}, ${escapeHtml(d.leaderId)}</span></span>
            ${shareBar(d.share, max)}
            ${g ? `<span class="meta-guide">${difficultyMarks(g.difficulty)}Beginner guide</span>` : ''}
          </span></a></li>`;
      }).join('')}
    </ol>
    <p class="muted meta-note">Share means the percent of top-placing decklists that used this Leader. A deck with a high share is popular and proven, which also means you'll face it often.</p>`;
}
