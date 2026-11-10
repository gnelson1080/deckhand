// Hash router: #/view/param
export const VIEWS = ['learn', 'lesson', 'cards', 'card', 'decks', 'build', 'play', 'game', 'meta', 'deck', 'glossary', 'about'];

export function parseHash(hash) {
  const [view, ...rest] = String(hash || '').replace(/^#\/?/, '').split('/');
  if (!VIEWS.includes(view)) return { view: 'learn', param: null };
  const raw = rest.join('/');
  let param = null;
  if (raw) { try { param = decodeURIComponent(raw); } catch { param = raw; } }
  return { view, param };
}

export function onRoute(cb) {
  const fire = () => cb(parseHash(location.hash));
  addEventListener('hashchange', fire);
  fire();
}

export const go = (view, param) => { location.hash = `#/${view}${param != null ? '/' + encodeURIComponent(param) : ''}`; };
