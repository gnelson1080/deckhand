// Daily price history, one shard per set: data/prices/<SET>.json
// Shape: { dates: ['YYYY-MM-DD', ...], p: { [cardId]: (number|null)[] } }, arrays aligned to dates.
export const MAX_DAYS = 400;

export const shardKey = id => String(id).split('-')[0];

const validShard = s => s && Array.isArray(s.dates) && s.p && typeof s.p === 'object';

export function appendPrices(prev, cards, date) {
  const shard = validShard(prev) ? { dates: [...prev.dates], p: Object.fromEntries(Object.entries(prev.p).map(([k, v]) => [k, [...v]])) } : { dates: [], p: {} };
  let col = shard.dates.indexOf(date);
  if (col < 0) {
    shard.dates.push(date);
    col = shard.dates.length - 1;
    for (const k of Object.keys(shard.p)) shard.p[k].push(null);
  }
  const n = shard.dates.length;
  for (const c of cards) {
    if (!shard.p[c.id]) shard.p[c.id] = new Array(n).fill(null);
    while (shard.p[c.id].length < n) shard.p[c.id].push(null);
    shard.p[c.id][col] = typeof c.price === 'number' && Number.isFinite(c.price) ? c.price : null;
  }
  if (n > MAX_DAYS) {
    const cut = n - MAX_DAYS;
    shard.dates = shard.dates.slice(cut);
    for (const k of Object.keys(shard.p)) shard.p[k] = shard.p[k].slice(cut);
  }
  return shard;
}

// Append today's prices to every set's shard. read(key) -> shard|null, write(key, shard).
export function updatePriceHistory(cards, date, read, write) {
  const bySet = new Map();
  for (const c of cards) {
    const k = shardKey(c.id);
    if (!/^[A-Z0-9]+$/i.test(k)) continue;
    if (!bySet.has(k)) bySet.set(k, []);
    bySet.get(k).push(c);
  }
  for (const [k, list] of bySet) {
    let prev = null;
    try { prev = read(k); } catch { prev = null; }
    write(k, appendPrices(prev, list, date));
  }
  return [...bySet.keys()];
}
