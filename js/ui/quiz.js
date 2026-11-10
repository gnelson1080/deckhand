// Three-question check at the end of each lesson.
import { gradeQuiz } from '../lib/quiz.js';
import { escapeHtml, richText } from './rich-text.js';
import { termIndex } from './define.js';
import { stamp, shake, buzz } from './fx.js';

export async function renderQuiz(el, questions, onFinish) {
  const idx = await termIndex();
  const picks = [];
  let i = 0;
  el.classList.add('quiz');

  const show = () => {
    const q = questions[i];
    el.innerHTML = `<p class="quiz-count">Question ${i + 1} of ${questions.length}</p>
      <h3 class="quiz-q">${richText(q.q, idx)}</h3>
      <div class="quiz-choices" role="group" aria-label="Answers">${q.choices.map((c, n) => `<button type="button" class="choice" data-n="${n}">${escapeHtml(c)}</button>`).join('')}</div>
      <div class="quiz-why" aria-live="polite"></div>`;
    el.querySelector('.choice')?.focus({ preventScroll: true });
  };

  el.addEventListener('click', e => {
    const b = e.target.closest('.choice');
    if (b && picks[i] === undefined) {
      const n = +b.dataset.n;
      const q = questions[i];
      picks[i] = n;
      const right = n === q.answer;
      el.querySelectorAll('.choice').forEach(x => { x.disabled = true; if (+x.dataset.n === q.answer) x.classList.add('right'); });
      if (!right) { b.classList.add('wrong'); shake(b); buzz([25, 40, 25]); } else { stamp(b, 'Correct!'); buzz(15); }
      const last = i === questions.length - 1;
      el.querySelector('.quiz-why').innerHTML = `<p><strong>${right ? 'Yes.' : 'Not quite.'}</strong> ${richText(q.why, idx)}</p>
        <button type="button" class="btn btn-primary quiz-next">${last ? 'See my score' : 'Next question'}</button>`;
      el.querySelector('.quiz-next').focus({ preventScroll: true });
      return;
    }
    if (e.target.closest('.quiz-next')) {
      if (i < questions.length - 1) { i++; show(); return; }
      const r = gradeQuiz(questions, picks);
      el.innerHTML = `<div class="quiz-result ${r.passed ? 'pass' : 'retry'}">
        <p class="quiz-score"><span class="display">${r.score}/${r.total}</span></p>
        <p>${r.passed ? 'You\'ve got it.' : 'Almost. Read the explanations once more and try again. You need 2 out of 3.'}</p>
        ${r.passed ? '' : '<button type="button" class="btn quiz-retry">Try the quiz again</button>'}</div>`;
      el.querySelector('.quiz-retry')?.addEventListener('click', () => { picks.length = 0; i = 0; show(); });
      onFinish?.(r);
    }
  });
  show();
}
