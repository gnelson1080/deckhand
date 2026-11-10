// Numbers about a decklist: cost curve, counters, price. Pure.
export function deckStats(list, cards) {
  const curve = new Map();
  let counters = 0, counterPower = 0, price = 0, priced = 0, total = 0;
  const byType = { Character: [], Event: [], Stage: [], Other: [] };
  for (const { id, count } of list) {
    const c = cards.get(id);
    total += count;
    if (!c) { byType.Other.push({ id, count, card: null }); continue; }
    (byType[c.type] || byType.Other).push({ id, count, card: c });
    if (c.cost != null) { const k = Math.min(c.cost, 10); curve.set(k, (curve.get(k) || 0) + count); }
    if (c.counter) { counters += count; counterPower += c.counter * count; }
    if (c.price != null) { price += c.price * count; priced += count; }
  }
  const maxCost = Math.max(7, ...curve.keys());
  const curveArr = Array.from({ length: maxCost + 1 }, (_, k) => ({ cost: k, count: curve.get(k) || 0 }));
  for (const k of Object.keys(byType)) byType[k].sort((a, b) => (a.card?.cost ?? 99) - (b.card?.cost ?? 99) || a.id.localeCompare(b.id));
  return { total, curve: curveArr, counters, counterPower, price: Math.round(price * 100) / 100, pricedShare: total ? priced / total : 0, byType };
}
