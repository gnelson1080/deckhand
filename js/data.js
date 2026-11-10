// Loads JSON data and content once per session.
const cache = new Map();

export function loadJSON(path) {
  if (!cache.has(path)) {
    cache.set(path, fetch(path).then(r => {
      if (!r.ok) throw new Error(`Couldn't load ${path} (${r.status})`);
      return r.json();
    }).catch(e => { cache.delete(path); throw e; }));
  }
  return cache.get(path);
}

let cardsMap;
export async function getCards() {
  if (!cardsMap) {
    const list = await loadJSON('data/cards.json');
    cardsMap = new Map(list.map(c => [c.id, c]));
  }
  return cardsMap;
}
export const getMeta = () => loadJSON('data/meta.json');
export const getUpdated = () => loadJSON('data/updated.json').catch(() => ({}));
export const getGlossary = () => loadJSON('content/glossary.json');
export const getLessonIndex = () => loadJSON('content/lessons/index.json');
export const getLesson = n => loadJSON(`content/lessons/${String(n).padStart(2, '0')}.json`);
export const getDeckGuide = leaderId => loadJSON(`content/deck-guides/${leaderId}.json`).catch(() => null);

export const tcgplayerUrl = card => card?.tcgUrl
  || `https://www.tcgplayer.com/search/one-piece-card-game/product?q=${encodeURIComponent(card?.id || '')}`;

export const formatDate = iso => {
  if (!iso) return 'unknown date';
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};
