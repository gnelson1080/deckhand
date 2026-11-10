import { getUpdated, formatDate } from '../data.js';
import { store } from '../store.js';
import { icon } from '../icons.js';

export async function render(root) {
  const u = await getUpdated();
  root.innerHTML = `<a class="back-link" href="#/learn" data-back>${icon('back', { size: 20 })}Back</a>
    <h1 class="page-title">About Deckhand</h1>
    <p class="page-lede">A free, unofficial guide for people learning the One Piece Card Game from scratch.</p>
    <section class="panel about">
      <h2>Where the information comes from</h2>
      <ul>
        <li>Rules: Bandai's official Comprehensive Rules (version 1.2.1, August 2026).</li>
        <li>Cards, pictures and prices: TCGplayer. Card list updated ${formatDate(u.cards)}.</li>
        <li>Top decks: recent tournament results on TCGplayer. Updated ${formatDate(u.meta)}.</li>
      </ul>
      <h2>Install it on your phone</h2>
      <p><strong>iPhone:</strong> in Safari, tap the Share button, then "Add to Home Screen".</p>
      <p><strong>Android:</strong> in Chrome, tap the menu (three dots), then "Install app" or "Add to Home screen".</p>
      <p>Once installed, lessons work without an internet connection.</p>
      <h2>Your progress</h2>
      <p>Progress is saved on this device only. No account, no tracking.</p>
      <button type="button" class="btn reset-progress">Reset my lesson progress</button>
      <h2>The fine print</h2>
      <p class="muted">Deckhand is an unofficial fan-made learning tool. It is not affiliated with or endorsed by Bandai, Eiichiro Oda, Shueisha, Toei Animation or TCGplayer. ONE PIECE card names, text and images belong to their owners. Card images marked "SAMPLE" are the official preview scans.</p>
    </section>`;
  root.querySelector('.reset-progress').addEventListener('click', e => {
    if (!confirm('Erase all lesson progress on this device?')) return;
    store().set('progress', { completed: [], quiz: {} });
    store().set('seenIntro', false);
    e.target.textContent = 'Progress reset';
    e.target.disabled = true;
  });
}
