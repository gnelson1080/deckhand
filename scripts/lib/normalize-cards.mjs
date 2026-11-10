// Turns raw optcgapi.com records into one clean Card per printed card number.

const num = v => {
  if (v === null || v === undefined) return null;
  const n = Number(String(v).replace(/[^\d.-]/g, ''));
  return String(v).trim() === '' || Number.isNaN(n) ? null : n;
};

const clean = v => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' || s === 'NULL' || s === '-' ? null : s;
};

export const splitColors = s => (clean(s) || '').split(/[\s/]+/).filter(Boolean);
export const splitTraits = s => (clean(s) || '').split('/').map(t => t.trim()).filter(Boolean);

function toCard(r) {
  const type = clean(r.card_type);
  const counter = num(r.counter_amount);
  return {
    id: r.card_set_id,
    name: clean(r.card_name),
    set: clean(r.set_id),
    setName: clean(r.set_name),
    rarity: clean(r.rarity),
    colors: splitColors(r.card_color),
    type,
    cost: type === 'Leader' ? null : num(r.card_cost),
    power: type === 'Event' ? null : num(r.card_power),
    counter: counter ? counter : null,
    life: type === 'Leader' ? num(r.life) : null,
    attribute: clean(r.attribute),
    traits: splitTraits(r.sub_types),
    text: clean(r.card_text) || '',
    img: r.card_image,
    altImgs: [],
    price: num(r.market_price),
  };
}

export function normalizeCards(raw) {
  const groups = new Map();
  for (const r of raw) {
    if (!r || !r.card_set_id) continue;
    if (!groups.has(r.card_set_id)) groups.set(r.card_set_id, []);
    groups.get(r.card_set_id).push(r);
  }
  const out = [];
  for (const [id, recs] of groups) {
    const base = recs.find(r => r.card_image_id === id) || recs[0];
    const card = toCard(base);
    card.altImgs = [...new Set(recs.filter(r => r !== base).map(r => r.card_image).filter(i => i && i !== card.img))];
    out.push(card);
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}
