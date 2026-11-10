import { getUpdated, formatDate } from '../data.js';
import { store } from '../store.js';
import { makeBackup, readBackup, describeBackup } from '../lib/backup.js';
import { emptyProgress } from '../lib/progress.js';
import { escapeHtml } from '../ui/rich-text.js';
import { icon } from '../icons.js';

export async function render(root) {
  const u = await getUpdated();
  const st = store();
  const current = () => ({ progress: st.get('progress', emptyProgress()), decks: st.get('decks', []), theme: st.get('theme', null) });

  root.innerHTML = `<a class="back-link" href="#/learn" data-back>${icon('back', { size: 20 })}Back</a>
    <h1 class="page-title">About Deckhand</h1>
    <p class="page-lede">A free, unofficial guide for people learning the One Piece Card Game from scratch.</p>
    <section class="panel about" id="backup">
      <h2>Back up and restore</h2>
      <p>Your lessons and decks are saved on this device only. No account, no tracking. To move them to another phone, copy a backup code here and restore it there.</p>
      <p class="muted small">This device has: ${escapeHtml(describeBackup(current()))}.</p>
      <div class="list-links"><button type="button" class="btn btn-primary copy-backup">Copy backup code</button><button type="button" class="btn save-backup">Save as a file</button></div>
      <p class="backup-msg" aria-live="polite"></p>
      <details class="restore"><summary>Restore from a backup</summary>
        <label class="visually-hidden" for="restore-box">Backup code</label>
        <textarea id="restore-box" class="import-box" rows="4" placeholder="Paste a code that starts with DH1."></textarea>
        <div class="list-links"><button type="button" class="btn restore-check">Check the code</button>
          <label class="btn file-btn">Open a backup file<input type="file" accept=".txt,text/plain" hidden></label></div>
        <div class="restore-result" aria-live="polite"></div>
      </details>
      <h2>Where the information comes from</h2>
      <ul>
        <li>Rules: Bandai's official Comprehensive Rules (version 1.2.1, August 2026).</li>
        <li>Cards, pictures and prices: TCGplayer. Card list updated ${formatDate(u.cards)}.</li>
        <li>Top decks: paper tournament results on TCGplayer and online events on Limitless Play. Updated ${formatDate(u.meta)}.</li>
        <li>Banned cards: Bandai's official ban list (en.onepiece-cardgame.com).</li>
      </ul>
      <h2>Install it on your phone</h2>
      <p><strong>iPhone:</strong> in Safari, tap the Share button, then "Add to Home Screen".</p>
      <p><strong>Android:</strong> in Chrome, tap the menu (three dots), then "Install app" or "Add to Home screen".</p>
      <p>Once installed, lessons work without an internet connection.</p>
      <h2>Start over</h2>
      <button type="button" class="btn reset-progress">Reset my lesson progress</button>
      <h2>The fine print</h2>
      <p class="muted">Deckhand is an unofficial fan-made learning tool. It is not affiliated with or endorsed by Bandai, Eiichiro Oda, Shueisha, Toei Animation or TCGplayer. ONE PIECE card names, text and images belong to their owners. Card images marked "SAMPLE" are the official preview scans.</p>
    </section>`;

  const msg = root.querySelector('.backup-msg');
  root.querySelector('.copy-backup').addEventListener('click', async () => {
    const code = makeBackup(current());
    try { await navigator.clipboard.writeText(code); msg.textContent = 'Backup code copied. Paste it somewhere safe, like a note or a message to yourself.'; }
    catch { msg.innerHTML = `Copy this code:<textarea class="import-box" rows="3" readonly>${escapeHtml(code)}</textarea>`; msg.querySelector('textarea').select(); }
  });
  root.querySelector('.save-backup').addEventListener('click', () => {
    const blob = new Blob([makeBackup(current())], { type: 'text/plain' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `deckhand-backup-${new Date().toISOString().slice(0, 10)}.txt` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    msg.textContent = 'Backup file saved.';
  });

  const out = root.querySelector('.restore-result');
  const check = code => {
    const r = readBackup(code);
    if (!r.ok) { out.innerHTML = `<p class="bad-text">${escapeHtml(r.error)}</p>`; return; }
    out.innerHTML = `<p>This backup has <strong>${escapeHtml(describeBackup(r.data))}</strong>. Restoring replaces what's on this device now (${escapeHtml(describeBackup(current()))}).</p>
      <button type="button" class="btn btn-primary restore-go">Restore it</button>`;
    out.querySelector('.restore-go').addEventListener('click', () => {
      const saved = [st.set('progress', r.data.progress), st.set('decks', r.data.decks)].every(Boolean);
      st.set('seenIntro', true);
      if (r.data.theme) { st.set('theme', r.data.theme); document.documentElement.dataset.theme = r.data.theme; }
      out.innerHTML = saved
        ? `<p class="good-text">${icon('check', { size: 16, stroke: 3 })} Restored: ${escapeHtml(describeBackup(r.data))}.</p>`
        : `<p class="bad-text">Restored for now, but this browser didn't let Deckhand save it. It will be lost when you close the app. Private browsing or a full phone can cause this. Try again in a normal window, and keep your backup code.</p>`;
    });
  };
  root.querySelector('.restore-check').addEventListener('click', () => check(root.querySelector('#restore-box').value));
  root.querySelector('.file-btn input').addEventListener('change', async e => {
    const f = e.target.files?.[0]; if (!f) return;
    const text = await f.text().catch(() => '');
    root.querySelector('#restore-box').value = text.trim().slice(0, 200000);
    check(text);
  });

  root.querySelector('.reset-progress').addEventListener('click', e => {
    if (!confirm('Erase all lesson progress on this device? Your decks are kept.')) return;
    st.set('progress', emptyProgress());
    st.set('seenIntro', false);
    e.target.textContent = 'Progress reset';
    e.target.disabled = true;
  });
}
