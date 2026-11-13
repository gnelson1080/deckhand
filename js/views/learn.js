// The voyage map: one island per lesson, a ship at the lesson you're on.
import { getLessonIndex } from '../data.js';
import { store } from '../store.js';
import { currentLesson, emptyProgress } from '../lib/progress.js';
import { escapeHtml } from '../ui/rich-text.js';
import { icon } from '../icons.js';

export async function render(root) {
  const st = store();
  const progress = st.get('progress', emptyProgress());
  const index = await getLessonIndex().catch(() => null);
  if (!index) { root.innerHTML = '<p class="empty">Lessons didn\'t load. Check your connection and try again.</p>'; return; }

  if (!progress.completed.length && !st.get('seenIntro', false)) return intro(root, () => { st.set('seenIntro', true); });

  const cur = currentLesson(progress, index.length);
  const allDone = progress.completed.length >= index.length;
  const just = st.get('justFinished', null);
  st.set('justFinished', null);

  // Islands zig-zag down the chart.
  const xs = [22, 70, 34, 76, 26, 66, 30, 74, 24, 68, 40];
  const gap = 132;
  const pts = index.map((l, i) => [xs[i % xs.length], 70 + i * gap]);
  const h = pts.at(-1)[1] + 90;
  const path = pts.map(([x, y], i) => {
    if (!i) return `M ${x} ${y}`;
    const [px, py] = pts[i - 1];
    return `C ${px} ${py + gap * .55}, ${x} ${y - gap * .55}, ${x} ${y}`;
  }).join(' ');

  root.innerHTML = `
    <h1 class="page-title">Your voyage</h1>
    <p class="page-lede">${allDone ? 'Every island visited. Revisit any lesson, or go study today\'s top decks.' : `${progress.completed.length} of ${index.length} lessons done. Your ship is at lesson ${cur}.`}</p>
    <a class="btn btn-primary btn-block continue" href="#/lesson/${cur}">${allDone ? 'Review the last lesson' : progress.completed.length ? `Continue: ${escapeHtml(index[cur - 1].title)}` : 'Start lesson 1'}</a>
    ${progress.completed.length >= 1 && !st.get('installHintDismissed', false) && !matchMedia('(display-mode: standalone)').matches ? `<aside class="tip install-hint"><span class="tip-flag" aria-hidden="true"></span><div><p><strong>Keep Deckhand on your phone.</strong> ${/iPhone|iPad/.test(navigator.userAgent) ? 'Tap Share, then "Add to Home Screen".' : 'Add it to your home screen and lessons work offline.'}</p>
      <button type="button" class="btn install-go" hidden>Install</button> <button type="button" class="btn install-x">Not now</button></div></aside>` : ''}
    <a class="btn btn-block play-cta" href="#/play">${icon('ship', { size: 20 })}Play a practice game vs. the computer</a>
    <div class="voyage" style="--h:${h}px">
      <svg class="voyage-route" viewBox="0 0 100 ${h}" preserveAspectRatio="none" aria-hidden="true">
        <path d="${path}" class="route-all" vector-effect="non-scaling-stroke"/>
      </svg>
      ${index.map((l, i) => {
        const [x, y] = pts[i];
        const done = progress.completed.includes(l.id);
        const here = l.id === cur && !allDone;
        return `<a class="island${x > 50 ? ' flip' : ''}${done ? ' done' : ''}${here ? ' here' : ''}${just === l.id ? ' just' : ''}" href="#/lesson/${l.id}" style="--x:${x}%;--y:${y}px;--i:${i}" aria-label="Lesson ${l.id}: ${escapeHtml(l.title)}${done ? ', completed' : here ? ', current lesson' : ''}">
          <span class="isle" aria-hidden="true"><span class="isle-n">${l.id}</span>${done ? `<span class="isle-stamp">${icon('check', { size: 16, stroke: 3 })}</span>` : ''}</span>
          <span class="isle-label"><strong>${escapeHtml(l.title)}</strong><small>${l.minutes} min${Number(progress.quiz?.[l.id]) ? `, quiz ${Number(progress.quiz[l.id])}/3` : ''}</small></span>
        </a>`;
      }).join('')}
      ${allDone ? '' : `<span class="voyage-ship" style="--x:${pts[cur - 1][0]}%;--y:${pts[cur - 1][1]}px" aria-hidden="true">${icon('ship', { size: 34 })}</span>`}
    </div>
    <footer class="site-foot"><p>Deckhand is an unofficial fan-made learning tool. It is not affiliated with Bandai, Eiichiro Oda, Shueisha, Toei Animation or TCGplayer. Card images and names belong to their owners. <a href="#/about">About Deckhand</a></p></footer>`;

  const hint = root.querySelector('.install-hint');
  if (hint) {
    const go = hint.querySelector('.install-go');
    if (window.__installPrompt) go.hidden = false;
    go.addEventListener('click', async () => { window.__installPrompt?.prompt(); hint.remove(); });
    hint.querySelector('.install-x').addEventListener('click', () => { st.set('installHintDismissed', true); hint.remove(); });
  }

  // If a lesson was just finished, sail the ship from the old island to the new one.
  const ship = root.querySelector('.voyage-ship');
  if (ship && just && just === cur - 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const [fx, fy] = pts[just - 1];
    ship.animate([{ left: `${fx}%`, top: `${fy}px` }, { left: `${pts[cur - 1][0]}%`, top: `${pts[cur - 1][1]}px` }], { duration: 1400, easing: 'cubic-bezier(.45,.05,.3,1)' });
    root.querySelector('.island.here')?.scrollIntoView({ block: 'center' });
  }
}

function intro(root, onStart) {
  root.innerHTML = `<section class="intro">
      <div class="intro-art" aria-hidden="true">
        <span class="intro-card c1"></span><span class="intro-card c2"></span><span class="intro-card c3"></span>
        <span class="intro-compass">${icon('compass', { size: 64, stroke: 1.4 })}</span>
      </div>
      <h1 class="intro-title">Learn the One&nbsp;Piece Card Game from zero.</h1>
      <p class="intro-lede">Twelve short lessons, a few minutes each. You'll practice on a real board, take a 3-question check after each lesson, and finish knowing which deck to pick up first.</p>
      <a class="btn btn-primary btn-block intro-go" href="#/lesson/1">Start here</a>
      <p class="intro-small">No account needed. Your progress is saved on this device.</p>
    </section>`;
  root.querySelector('.intro-go').addEventListener('click', onStart);
}
