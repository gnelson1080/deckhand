// Card search + filters. Pure: works in the browser and in Node tests.
const fold = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const keyCache = new WeakMap();
const keyOf = c => {
  let k = keyCache.get(c);
  if (k === undefined) { k = fold([c.name, c.id, ...(c.traits || [])].join(' | ')); keyCache.set(c, k); }
  return k;
};

export function searchCards(cards, { q = '', colors = [], types = [], costMin = null, costMax = null, set = '' } = {}) {
  const needle = fold(q).trim();
  const hasCost = costMin != null || costMax != null;
  const out = [];
  for (const c of cards) {
    if (needle && !keyOf(c).includes(needle)) continue;
    if (colors.length && !c.colors?.some(x => colors.includes(x))) continue;
    if (types.length && !types.includes(c.type)) continue;
    if (hasCost) {
      if (c.cost == null) continue;
      if (costMin != null && c.cost < costMin) continue;
      if (costMax != null && c.cost > costMax) continue;
    }
    if (set && !c.id.startsWith(set + '-')) continue;
    out.push(c);
  }
  return out.sort((a, b) => String(a.name).localeCompare(String(b.name)) || a.id.localeCompare(b.id));
}

export const thumb = img => String(img || '').replace(/_in_1000x1000\.jpg$/, '_200w.jpg');

export const setsOf = cards => [...new Set(cards.map(c => c.id.split('-')[0]))].sort((a, b) => {
  const r = s => ({ OP: 0, EB: 1, ST: 2, PRB: 3, P: 4 }[s.replace(/\d+$/, '')] ?? 5);
  return r(a) - r(b) || b.localeCompare(a, undefined, { numeric: true });
});

// Default browse order: what tournament players actually use, then newest sets.
export function popularFirst(cards, meta) {
  const score = new Map();
  for (const d of meta?.decks || []) {
    const w = d.points || 1;
    score.set(d.leaderId, (score.get(d.leaderId) || 0) + 1000 * w);
    for (const l of d.lists || []) for (const c of l.cards) score.set(c.id, (score.get(c.id) || 0) + c.count * w);
  }
  const setRank = id => {
    const s = id.split('-')[0];
    const kind = { OP: 0, EB: 1, PRB: 2, ST: 3, P: 4 }[s.replace(/\d+$/, '')] ?? 5;
    return kind * 1000 - (parseInt(s.replace(/\D/g, ''), 10) || 0);
  };
  return [...cards].sort((a, b) => (score.get(b.id) || 0) - (score.get(a.id) || 0) || setRank(a.id) - setRank(b.id) || a.id.localeCompare(b.id));
}
