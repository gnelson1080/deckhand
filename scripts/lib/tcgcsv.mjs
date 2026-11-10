// TCGplayer catalog (via the tcgcsv.com daily mirror, category 68 = One Piece Card Game).
export const TCGCSV = 'https://tcgcsv.com/tcgplayer/68';

const num = v => (v === null || v === undefined || String(v).trim() === '' || Number.isNaN(Number(v)) ? null : Number(v));
const list = v => String(v || '').split(/[;/]/).map(s => s.trim()).filter(Boolean);
const bigImg = url => String(url || '').replace(/_\d+w\.jpg$/, '_in_1000x1000.jpg');

export const stripTcgHtml = s => String(s || '')
  .replace(/\r/g, '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<span[^>]*color:\s*red[^>]*>[\s\S]*?<\/span>/gi, '')
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
  .replace(/\s*Disclaimer:[^\n]*/g, '')
  .split('\n').map(l => l.trim()).filter(Boolean).join('\n');

// Printing tags TCGplayer adds to product names. Character aliases like "Mr.1 (Daz.Bonez)" are kept.
const VARIANT_RE = /alternate art|parallel|\bsp\b|\btr\b|foil|full art|manga|box topper|wanted poster|reprint|treasure|gold|super alt|oda stamped|signature/i;
const EVENT_RE = /pack|regional|deck|collection|cup|edition|fest|vol\.?|promo|film|event|anniversary|championship|tournament|release|kit|party|participant|winner|judge|set|exclusive|celebration|battle|gift|top players|finalist|store|convention|stamped|online|offline|\d{4}/i;
const NUM_RE = /^(?:[A-Z]*-?\d+[A-Z\d-]*)$/;
const tagsOf = name => (String(name).match(/\(([^)]*)\)|\[([^\]]*)\]/g) || []).map(t => t.slice(1, -1).trim());
const printTags = name => tagsOf(name).filter(t => !NUM_RE.test(t) && (VARIANT_RE.test(t) || EVENT_RE.test(t)));
export const isVariantName = name => tagsOf(name).some(t => VARIANT_RE.test(t));
export const artLabel = name => printTags(name).join(' · ') || 'Original';
export const cleanName = name => {
  let out = String(name || '').replace(/\s+-\s+[A-Z]*\d*-\d+\b/g, '');
  for (const t of tagsOf(out)) if (NUM_RE.test(t) || VARIANT_RE.test(t) || EVENT_RE.test(t)) out = out.replace(new RegExp(`\\s*[\\(\\[]${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\)\\]]`), '');
  return out.replace(/\s+/g, ' ').trim();
};

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
    recs.sort((a, b) => isVariantName(a.p.name) - isVariantName(b.p.name) || printTags(a.p.name).length - printTags(b.p.name).length || a.p.productId - b.p.productId);
    const { p, ex } = recs[0];
    const type = ex.CardType;
    const counter = num(ex.Counterplus);
    out.push({
      id,
      name: cleanName(p.name),
      set: id.split('-')[0],
      setName: group.groupName || null,
      rarity: ex.Rarity || null,
      colors: list(ex.Color).filter(x => ['Red', 'Green', 'Blue', 'Purple', 'Black', 'Yellow'].includes(x)),
      type,
      cost: type === 'Leader' ? null : num(ex.Cost),
      power: type === 'Event' || type === 'Stage' ? null : num(ex.Power),
      counter: counter ? counter : null,
      life: type === 'Leader' ? num(ex.Life) : null,
      attribute: ex.Attribute || null,
      traits: list(ex.Subtypes),
      text: stripTcgHtml(ex.Description),
      img: bigImg(p.imageUrl),
      imgLabel: artLabel(p.name),
      altImgs: recs.slice(1).map(r => bigImg(r.p.imageUrl)),
      altLabels: recs.slice(1).map(r => artLabel(r.p.name)),
      price: price.get(p.productId) ?? null,
      tcgUrl: p.url,
      _group: group.abbreviation || null,
      _groupName: group.groupName || null,
      _variant: isVariantName(p.name),
    });
  }
  return out;
}

// Same card number can appear in many groups (reprints, promos, event packs).
// Keep the printing from the group the number belongs to, and pool every other art.
export function mergeCardLists(lists) {
  const by = new Map();
  const squash = v => String(v || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  // 3 = exact home group (ST-01 for ST01-xxx), 2 = group named after it (ST-01 PRE, OP15-EB04, OP-PR for P-),
  // 0 = reprint elsewhere. A standard printing always beats an SP/foil/reprint.
  const homeRank = c => {
    const g = squash(c._group), s = squash(c.set);
    if (g === s) return 3;
    if (s === 'P') return g === 'OPPR' ? 2 : 0;
    if (g.startsWith(s) || (s.length > 2 && g.includes(s))) return 2;
    return 0;
  };
  const score = c => (c._variant ? 0 : 10) + homeRank(c);
  const label = c => {
    const l = c.imgLabel || 'Original';
    return homeRank(c) >= 2 || !c._groupName ? l : `${l === 'Original' ? 'Reprint' : l} · ${c._groupName}`;
  };
  const arts = c => [[c.img, label(c)], ...(c.altImgs || []).map((img, i) => [img, c.altLabels?.[i] ? (homeRank(c) >= 2 || !c._groupName ? c.altLabels[i] : `${c.altLabels[i]} · ${c._groupName}`) : 'Alternate art'])];
  for (const c of lists.flat()) {
    const cur = by.get(c.id);
    if (!cur) { by.set(c.id, { card: c, arts: arts(c) }); continue; }
    const win = score(c) > score(cur.card) ? c : cur.card;
    const all = win === c ? [...arts(c), ...cur.arts] : [...cur.arts, ...arts(c)];
    if (win.price == null) win.price = (win === c ? cur.card : c).price;
    by.set(c.id, { card: win, arts: all });
  }
  return [...by.values()].map(({ card, arts: all }) => {
    const { _group, _groupName, _variant, ...c } = card;
    const seen = new Set([c.img]);
    const rest = all.filter(([img]) => img && !seen.has(img) && seen.add(img));
    return { ...c, imgLabel: c.imgLabel || 'Original', altImgs: rest.map(a => a[0]), altLabels: rest.map(a => a[1]) };
  }).sort((a, b) => a.id.localeCompare(b.id));
}

// Fill empty fields on catalog cards from a backup list (same card numbers).
export function fillGaps(cards, backup) {
  const b = new Map(backup.map(c => [c.id, c]));
  return cards.map(c => {
    const o = b.get(c.id) || {};
    const out = { ...c };
    if (!out.colors?.length && o.colors?.length) out.colors = o.colors;
    if (!out.traits?.length && o.traits?.length) out.traits = o.traits;
    if (!out.text && o.text && !/^Disclaimer:/i.test(o.text)) out.text = o.text;
    // Every Character has printed power; a missing one plus a backup that says Event means a mislabeled Event.
    if (out.type === 'Character' && out.power == null && o.type && o.type !== 'Character') out.type = o.type;
    if (out.type === 'Leader') { if (out.life == null && o.life != null) out.life = o.life; out.cost = null; }
    else if (out.cost == null && o.cost != null) out.cost = o.cost;
    if (out.type === 'Leader' || out.type === 'Character') {
      if (out.power == null) out.power = o.power ?? 0;
    } else out.power = null;
    if (out.type === 'Character' && out.counter == null && o.counter) out.counter = o.counter;
    return out;
  });
}
