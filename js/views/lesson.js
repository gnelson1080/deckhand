import { getLesson, getLessonIndex, getMeta, getCards, getDeckGuide } from '../data.js';
import { thumb } from '../lib/search.js';
import { difficultyMarks, difficultyLabel } from '../ui/charts.js';
import { store } from '../store.js';
import { completeLesson, emptyProgress } from '../lib/progress.js';
import { richText, escapeHtml } from '../ui/rich-text.js';
import { termIndex } from '../ui/define.js';
import { renderCallout } from '../ui/card-callout.js';
import { createBoard } from '../ui/miniboard.js';
import { renderQuiz } from '../ui/quiz.js';
import { confetti } from '../ui/fx.js';
import { icon } from '../icons.js';

export async function render(root, param) {
  const n = Math.max(1, parseInt(param, 10) || 1);
  let lesson, index;
  try { [lesson, index] = await Promise.all([getLesson(n), getLessonIndex()]); }
  catch { root.innerHTML = `<p class="empty">Lesson ${n} didn't load. Check your connection and try again.</p><a class="btn" href="#/learn">Back to the map</a>`; return; }
  const idx = await termIndex();
  const total = index.length;
  const steps = lesson.steps;
  const pages = steps.length + 1; // + quiz
  let page = 0;

  root.innerHTML = `
    <div class="lesson-top">
      <a class="back-link" href="#/learn">${icon('back', { size: 20 })}Map</a>
      <span class="lesson-meta">Lesson ${n} of ${total}, about ${lesson.minutes} min</span>
    </div>
    <div class="route" role="progressbar" aria-label="Lesson progress" aria-valuemin="1" aria-valuemax="${pages}">
      <div class="route-line"></div><div class="route-done"></div><span class="route-ship">${icon('ship', { size: 26 })}</span>
    </div>
    <h1 class="lesson-title">${escapeHtml(lesson.title)}</h1>
    <p class="lesson-goal">${richText(lesson.goal, idx)}</p>
    <div class="lesson-page" aria-live="polite"></div>
    <div class="lesson-nav">
      <button type="button" class="btn lesson-prev">${icon('back', { size: 18 })}Back</button>
      <button type="button" class="btn btn-primary lesson-next">Next${icon('next', { size: 18 })}</button>
    </div>`;

  const pageEl = root.querySelector('.lesson-page');
  const prev = root.querySelector('.lesson-prev');
  const next = root.querySelector('.lesson-next');
  const route = root.querySelector('.route');
  const solved = new Set();

  const setRoute = () => {
    const k = pages > 1 ? page / (pages - 1) : 1;
    route.style.setProperty('--k', k);
    route.setAttribute('aria-valuenow', page + 1);
    route.setAttribute('aria-valuetext', page < steps.length ? `Step ${page + 1} of ${steps.length}` : 'Quiz');
  };

  async function show(dir = 1) {
    pageEl.classList.remove('turn-in', 'turn-back'); void pageEl.offsetWidth;
    pageEl.classList.add(dir > 0 ? 'turn-in' : 'turn-back');
    setRoute();
    prev.hidden = page === 0;
    next.hidden = false;
    next.disabled = false;
    next.innerHTML = `Next${icon('next', { size: 18 })}`;
    if (page < steps.length) {
      const st = steps[page];
      pageEl.innerHTML = '';
      if (st.type === 'text') pageEl.innerHTML = `<div class="step-text">${st.html}</div>`;
      else if (st.type === 'tip') pageEl.innerHTML = `<aside class="tip"><span class="tip-flag" aria-hidden="true"></span><div>${st.html}</div></aside>`;
      else if (st.type === 'card') { const d = document.createElement('div'); pageEl.append(d); if (st.html) d.insertAdjacentHTML('beforebegin', `<div class="step-text">${st.html}</div>`); await renderCallout(d, st); }
      else if (st.type === 'deckpick') pageEl.innerHTML = await deckPick();
      else if (st.type === 'board') {
        if (st.html) pageEl.insertAdjacentHTML('beforeend', `<div class="step-text">${st.html}</div>`);
        const d = document.createElement('div'); pageEl.append(d);
        if (!solved.has(page)) { next.disabled = true; next.innerHTML = 'Solve the board to continue'; }
        const here = page;
        await createBoard(st.scenario, d, () => { solved.add(here); if (page === here) { next.disabled = false; next.innerHTML = `Next${icon('next', { size: 18 })}`; } });
      }
      linkTerms(pageEl);
    } else {
      next.hidden = true;
      pageEl.innerHTML = `<h2 class="quiz-title">Quick check</h2><div class="quiz-box"></div>`;
      await renderQuiz(pageEl.querySelector('.quiz-box'), lesson.quiz, r => { if (r.passed) finish(r.score); });
    }
    root.querySelector('.lesson-title').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  // Beginner-friendly decks from today's meta, easiest first.
  async function deckPick() {
    try {
      const [meta, cards] = await Promise.all([getMeta(), getCards()]);
      const guides = (await Promise.all(meta.decks.map(async d => ({ d, g: await getDeckGuide(d.leaderId) })))).filter(x => x.g)
        .sort((a, b) => a.g.difficulty - b.g.difficulty || a.d.rank - b.d.rank).slice(0, 3);
      if (!guides.length) return '<p class="muted">Open the Meta tab to see today\'s top decks.</p>';
      return `<p class="step-text">Beginner-friendly decks winning right now, easiest first:</p><div class="pick-list">${guides.map(({ d, g }) => `<a class="pick panel" href="#/deck/${Number(d.rank) || 0}">
        <img src="${escapeHtml(thumb(cards.get(d.leaderId)?.img || ''))}" alt="" width="200" height="279" loading="lazy">
        <span><strong class="display">${escapeHtml(g.title)}</strong><span class="deck-diff">${difficultyMarks(g.difficulty)}${escapeHtml(difficultyLabel(g.difficulty))}</span>
        <span class="muted">#${Number(d.rank) || 0} in tournaments. ${escapeHtml(g.summary.split('. ')[0])}.</span></span></a>`).join('')}</div>`;
    } catch { return '<p class="muted">Open the Meta tab to see today\'s top decks.</p>'; }
  }

  // Wrap glossary words written as <kw>Term</kw> in lesson html.
  function linkTerms(el) {
    el.querySelectorAll('kw').forEach(k => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'kw'; b.dataset.term = k.getAttribute('term') || k.textContent; b.textContent = k.textContent;
      k.replaceWith(b);
    });
  }

  function finish(score) {
    const st = store();
    st.set('progress', completeLesson(st.get('progress', emptyProgress()), n, score));
    st.set('justFinished', n);
    confetti();
    const nextLesson = index.find(l => l.id === n + 1);
    pageEl.insertAdjacentHTML('beforeend', `<div class="lesson-done">
      <h2>Lesson ${n} complete</h2>
      <p>${nextLesson ? `Next up: <strong>${escapeHtml(nextLesson.title)}</strong>.` : 'That was the last lesson. You know how to play the One Piece Card Game.'}</p>
      <div class="done-actions">${nextLesson ? `<a class="btn btn-primary" href="#/lesson/${n + 1}">Start lesson ${n + 1}</a>` : '<a class="btn btn-primary" href="#/meta">See today\'s top decks</a>'}
      <a class="btn" href="#/learn">Back to the map</a></div></div>`);
  }

  prev.addEventListener('click', () => { if (page > 0) { page--; show(-1); } });
  next.addEventListener('click', () => { if (page < pages - 1 && !next.disabled) { page++; show(1); } });
  await show(1);
}
