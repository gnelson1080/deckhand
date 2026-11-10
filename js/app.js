import { onRoute } from './router.js';
import { store } from './store.js';
import { icon } from './icons.js';
import { installDefineHandler } from './ui/define.js';

const TABS = {
  learn: { label: 'Learn', icon: 'compass', views: ['learn', 'lesson', 'about'] },
  cards: { label: 'Cards', icon: 'scroll', views: ['cards', 'card'] },
  decks: { label: 'Decks', icon: 'anchor', views: ['decks', 'build'] },
  meta: { label: 'Meta', icon: 'spyglass', views: ['meta', 'deck'] },
  glossary: { label: 'Glossary', icon: 'map', views: ['glossary'] },
};
const ORDER = ['learn', 'lesson', 'cards', 'card', 'decks', 'build', 'meta', 'deck', 'glossary', 'about'];

const views = {
  learn: () => import('./views/learn.js'),
  lesson: () => import('./views/lesson.js'),
  cards: () => import('./views/cards.js'),
  card: () => import('./views/card.js'),
  decks: () => import('./views/decks.js'),
  build: () => import('./views/build.js'),
  meta: () => import('./views/meta.js'),
  deck: () => import('./views/deck.js'),
  glossary: () => import('./views/glossary.js'),
  about: () => import('./views/about.js'),
};

const root = document.getElementById('view');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

// Tabs
const tabEls = [...document.querySelectorAll('.tab')];
for (const el of tabEls) {
  const t = TABS[el.dataset.tab];
  el.innerHTML = `${icon(t.icon, { size: 26 })}<span>${t.label}</span>`;
}
const flag = document.querySelector('.tab-flag');
function markTab(view) {
  const key = Object.keys(TABS).find(k => TABS[k].views.includes(view)) || 'learn';
  tabEls.forEach((el, i) => {
    const on = el.dataset.tab === key;
    if (on) { el.setAttribute('aria-current', 'page'); flag.style.transform = `translateX(${i * 100}%)`; }
    else el.removeAttribute('aria-current');
  });
}

// Theme
const themeBtn = document.getElementById('theme-toggle');
const prefersDark = matchMedia('(prefers-color-scheme: dark)');
const isDark = () => (document.documentElement.dataset.theme || (prefersDark.matches ? 'dark' : 'light')) === 'dark';
function paintThemeBtn() {
  themeBtn.innerHTML = icon(isDark() ? 'sun' : 'moon');
  themeBtn.setAttribute('aria-label', isDark() ? 'Switch to light theme' : 'Switch to dark theme');
}
const saved = store().get('theme', null);
if (saved) document.documentElement.dataset.theme = saved;
paintThemeBtn();
themeBtn.addEventListener('click', () => {
  const next = isDark() ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  store().set('theme', next);
  paintThemeBtn();
});
prefersDark.addEventListener?.('change', paintThemeBtn);

// Routing + page transitions
let cleanup = null;
let lastIndex = -1;
let token = 0;
async function show({ view, param }) {
  const my = ++token;
  markTab(view);
  let mod;
  try { mod = await views[view](); } catch (e) { mod = { render: el => { el.innerHTML = `<p class="empty">This page didn't load. Check your connection and try again.</p>`; } }; }
  if (my !== token) return;
  const idx = ORDER.indexOf(view);
  document.documentElement.classList.toggle('back', idx < lastIndex);
  lastIndex = idx;
  const swap = async () => {
    if (typeof cleanup === 'function') cleanup();
    cleanup = null;
    root.replaceChildren();
    window.scrollTo(0, 0);
    cleanup = await mod.render(root, param);
  };
  if (document.startViewTransition && !reduceMotion.matches) {
    // Fast taps can interrupt a page-turn animation; that's expected, not an error.
    const t = document.startViewTransition(swap);
    for (const p of [t.ready, t.finished, t.updateCallbackDone]) p?.catch?.(() => {});
  } else {
    await swap();
    if (!reduceMotion.matches) { root.classList.remove('page-enter'); void root.offsetWidth; root.classList.add('page-enter'); }
  }
}
installDefineHandler();
// Back links go to the previous screen when there is one (e.g. card opened from a deck).
let navCount = 0;
addEventListener('hashchange', () => navCount++);
document.addEventListener('click', e => {
  const a = e.target.closest('a[data-back]');
  if (a && navCount > 0) { e.preventDefault(); history.back(); }
});
onRoute(show);

addEventListener('beforeinstallprompt', e => { e.preventDefault(); window.__installPrompt = e; });

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
