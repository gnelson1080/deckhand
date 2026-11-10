// Practice game setup: pick decks, difficulty, coach; or resume a saved game.
import { DECKS, POOL } from '../game/pool-data.js';
import { loadGame } from '../game/save.js';
import { store } from '../store.js';
import { escapeHtml, safeColors } from '../ui/rich-text.js';
import { getDeckGuide, getBanlist } from '../data.js';
import { banStatus } from '../lib/deck.js';
import { difficultyMarks } from '../ui/charts.js';
import { thumb } from '../lib/search.js';
import { go } from '../router.js';
import { icon } from '../icons.js';

const LEVELS = [['easy', 'Easy', 'Plays random legal moves. Good for learning the flow.'], ['normal', 'Normal', 'Plays sensibly and defends its Leader.'], ['hard', 'Hard', 'Plans its whole turn and saves Counters.']];

export async function render(root) {
  const st = store();
  const prefs = st.get('playPrefs', { mine: 'luffy-ace', theirs: 'sabo', level: 'easy', coach: true, first: 'random' });
  const saved = st.get('game', null);
  const resume = saved ? loadGame(saved, POOL) : null;
  const rules = await getBanlist();
  const guides = Object.fromEntries(await Promise.all(Object.values(DECKS).map(async d => [d.key, await getDeckGuide(d.leaderId)])));

  const deckCard = (d, group, on) => {
    const L = POOL[d.leaderId];
    return `<label class="pdeck ${on ? 'on' : ''}"><input type="radio" name="${group}" value="${d.key}" ${on ? 'checked' : ''}>
      <img src="${escapeHtml(thumb(L.img))}" alt="" width="200" height="279"><span class="pdeck-name">${escapeHtml(guides[d.key]?.title || d.name)}${banStatus(d.leaderId, rules).banned ? '<span class="banned-tag" title="Banned in tournaments since the latest ban list. Still fine for practice.">Banned</span>' : ''}</span>
      <span class="meta-sub">${safeColors(L.colors).map(c => `<span class="dot ${c}"></span>`).join('')}${guides[d.key] ? difficultyMarks(guides[d.key].difficulty) : ''}</span></label>`;
  };
  root.innerHTML = `
    <h1 class="page-title">Practice game</h1>
    <p class="page-lede">Play a full game against the computer. The coach explains each step and can suggest a move.</p>
    ${resume?.ok ? `<div class="panel resume"><p><strong>You have a game in progress</strong> (turn ${resume.state.turn}).</p>
      <div class="list-links"><a class="btn btn-primary" href="#/game">Resume game</a><button type="button" class="btn abandon">Start over</button></div></div>` : ''}
    ${saved && !resume?.ok ? `<p class="bad-text">${escapeHtml(resume.error)}</p>` : ''}
    <form class="play-form">
      <h2>Your deck</h2><div class="pdecks">${Object.values(DECKS).map(d => deckCard(d, 'mine', d.key === prefs.mine)).join('')}</div>
      <h2>Opponent's deck</h2><div class="pdecks">${Object.values(DECKS).map(d => deckCard(d, 'theirs', d.key === prefs.theirs)).join('')}</div>
      <h2>Computer level</h2>
      <div class="seg level-seg" role="radiogroup">${LEVELS.map(([k, l]) => `<label><input type="radio" name="level" value="${k}" ${prefs.level === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
      <p class="muted small level-help">${LEVELS.find(l => l[0] === prefs.level)[2]}</p>
      <h2>Who goes first?</h2>
      <div class="seg" role="radiogroup">${[['random', 'Random'], ['me', 'Me'], ['them', 'Computer']].map(([k, l]) => `<label><input type="radio" name="first" value="${k}" ${prefs.first === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
      <label class="toggle"><input type="checkbox" name="coach" ${prefs.coach ? 'checked' : ''}><span>Coach on: tips, warnings and hints</span></label>
      <button type="submit" class="btn btn-primary btn-block start-game">${icon('ship', { size: 20 })}Start the game</button>
      <p class="muted small">Decks are real tournament lists, frozen so games stay the same. A deck marked Banned can't be played at events anymore, but it's still good practice.</p>
    </form>`;

  const form = root.querySelector('.play-form');
  form.addEventListener('change', () => {
    form.querySelectorAll('.pdeck').forEach(l => l.classList.toggle('on', l.querySelector('input').checked));
    root.querySelector('.level-help').textContent = LEVELS.find(l => l[0] === form.level.value)[2];
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const p = { mine: form.mine.value, theirs: form.theirs.value, level: form.level.value, coach: form.coach.checked, first: form.first.value };
    st.set('playPrefs', p);
    st.set('game', null);
    st.set('newGame', { ...p, seed: (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0 });
    go('game');
  });
  root.querySelector('.abandon')?.addEventListener('click', () => { if (confirm('Abandon the game in progress?')) { st.set('game', null); render(root); } });
}
