// Hash router: #/view/param
export const VIEWS = ['learn', 'lesson', 'cards', 'card', 'meta', 'deck', 'glossary', 'about'];

export function parseHash(hash) {
  const [view, ...rest] = String(hash || '').replace(/^#\/?/, '').split('/');
  if (!VIEWS.includes(view)) return { view: 'learn', param: null };
  const raw = rest.join('/');
  return { view, param: raw ? decodeURIComponent(raw) : null };
}

export function onRoute(cb) {
  const fire = () => cb(parseHash(location.hash));
  addEventListener('hashchange', fire);
  fire();
}

export const go = (view, param) => { location.hash = `#/${view}${param != null ? '/' + encodeURIComponent(param) : ''}`; };
