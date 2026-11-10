// TCGplayer catalog (via the tcgcsv.com daily mirror, category 68 = One Piece Card Game).
export const TCGCSV = 'https://tcgcsv.com/tcgplayer/68';

const num = v => (v === null || v === undefined || String(v).trim() === '' || Number.isNaN(Number(v)) ? null : Number(v));
const list = v => String(v || '').split(/[;/]/).map(s => s.trim()).filter(Boolean);
const bigImg = url => String(url || '').replace(/_\d+w\.jpg$/, '_in_1000x1000.jpg');

export const stripTcgHtml = s => String(s || '')
  .replace(/\r/g, '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
  .split('\n').map(l => l.trim()).filter(Boolean).join('\n');

// "Shanks (020) (Alternate Art)" -> 1 extra tag; "Shanks (020)" -> 0
const variantTags = name => (String(name).match(/\(([^)]*)\)/g) || []).filter(t => !/^\((?:[A-Z]*-?\d+[A-Z\d-]*)\)$/.test(t)).length;
export const cleanName = name => String(name || '').replace(/\s*\([^)]*\)/g, '').trim();

export const isCardGroup = g => !/playmat|sleeve|binder|storage|accessor|deck box|card case/i.test(g?.name || '');

export function tcgcsvToCards(products, prices, group = {}) {
  const price = new Map();
  for (const p of prices || []) {
    const cur = price.get(p.productId);
    if (p.marketPrice != null && (cur == null || p.subTypeName === 'Normal')) price.set(p.productId, p.marketPrice);
  }
  const byNumber = new Map();
  for (const p of products || []) {
    const ex = Object.fromEntries((p.extendedData || []).map(e => [e.name, e.value]));
    const type = ex.CardType;
    if (!ex.Number || !type || type === 'DON!!') continue;
    if (!byNumber.has(ex.Number)) byNumber.set(ex.Number, []);
    byNumber.get(ex.Number).push({ p, ex });
  }
  const out = [];
  for (const [id, recs] of byNumber) {
    recs.sort((a, b) => variantTags(a.p.name) - variantTags(b.p.name) || a.p.productId - b.p.productId);
    const { p, ex } = recs[0];
    const type = ex.CardType;
    const counter = num(ex.Counterplus);
    out.push({
      id,
      name: cleanName(p.name),
      set: id.split('-')[0],
      setName: group.groupName || null,
      rarity: ex.Rarity || null,
      colors: list(ex.Color),
      type,
      cost: type === 'Leader' ? null : num(ex.Cost),
      power: type === 'Event' || type === 'Stage' ? null : num(ex.Power),
      counter: counter ? counter : null,
      life: type === 'Leader' ? num(ex.Life) : null,
      attribute: ex.Attribute || null,
      traits: list(ex.Subtypes),
      text: stripTcgHtml(ex.Description),
      img: bigImg(p.imageUrl),
      altImgs: recs.slice(1).map(r => bigImg(r.p.imageUrl)),
      price: price.get(p.productId) ?? null,
      tcgUrl: p.url,
      _group: group.abbreviation || null,
    });
  }
  return out;
}

// Same card number can appear in many groups (reprints, promos, event packs).
// Keep the printing from the group the number belongs to, and pool every other art.
export function mergeCardLists(lists) {
  const by = new Map();
  const squash = v => String(v || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  // 2 = exact home group (ST-01 for ST01-xxx), 1 = related group (ST-01 PRE), 0 = reprint elsewhere
  const homeRank = c => (squash(c._group) === squash(c.set) ? 2 : squash(c._group).startsWith(squash(c.set)) ? 1 : 0);
  for (const c of lists.flat()) {
    const cur = by.get(c.id);
    if (!cur) { by.set(c.id, { ...c, altImgs: [...c.altImgs] }); continue; }
    const winner = homeRank(c) > homeRank(cur) ? { ...c, altImgs: [...c.altImgs] } : cur;
    const loser = winner === cur ? c : cur;
    winner.altImgs = [...new Set([...winner.altImgs, loser.img, ...loser.altImgs])].filter(i => i && i !== winner.img);
    if (winner.price == null) winner.price = loser.price;
    by.set(c.id, winner);
  }
  return [...by.values()].map(({ _group, ...c }) => c).sort((a, b) => a.id.localeCompare(b.id));
}

// Fill empty fields on catalog cards from a backup list (same card numbers).
export function fillGaps(cards, backup) {
  const b = new Map(backup.map(c => [c.id, c]));
  return cards.map(c => {
    const o = b.get(c.id);
    if (!o) return c;
    const out = { ...c };
    if (!out.colors?.length && o.colors?.length) out.colors = o.colors;
    if (!out.traits?.length && o.traits?.length) out.traits = o.traits;
    if (!out.text && o.text && !/^Disclaimer:/i.test(o.text)) out.text = o.text;
    return out;
  });
}
