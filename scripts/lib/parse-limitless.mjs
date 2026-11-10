// Small regex parsers for onepiece.limitlesstcg.com pages (structure checked against tests/fixtures).

const decode = s => s
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
  .replace(/[ \t]+/g, ' ')
  .split('\n').map(l => l.trim()).join('\n').trim();

const rowsOf = html => [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(m => m[1]);
const cellsOf = row => [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(m => m[1]);
const idFromImg = s => (s.match(/\/([A-Z]+\d*-\d+)_[A-Z]+\.webp/) || [])[1] || null;

export function parseMetaTable(html) {
  const out = [];
  for (const row of rowsOf(html)) {
    const c = cellsOf(row);
    if (c.length < 5 || !/deck-link/.test(c[2])) continue;
    const spans = [...c[2].matchAll(/<span[^>]*>([\s\S]*?)<\/span>/g)].map(m => decode(m[1]));
    out.push({
      rank: Number(decode(c[0])),
      deckPath: (c[2].match(/href="([^"]+)"/) || [])[1],
      leaderId: idFromImg(c[1]),
      name: spans[spans.length - 1],
      colors: spans.length > 1 ? spans[0].split('/') : [],
      points: Number(decode(c[3])),
      share: parseFloat(decode(c[4])),
    });
  }
  return out;
}

export function parseArchetypeLists(html) {
  const out = [];
  let event = null, date = null;
  for (const row of rowsOf(html)) {
    const head = row.match(/class="sub-heading"[^>]*>([\s\S]*?)<\/th>/);
    if (head) {
      const t = decode(head[1]);
      const i = t.indexOf(' - ');
      date = i > 0 ? t.slice(0, i) : null;
      event = i > 0 ? t.slice(i + 3) : t;
      continue;
    }
    const c = cellsOf(row);
    const list = row.match(/href="(\/decks\/list\/\d+)"/);
    if (c.length < 4 || !list) continue;
    out.push({ format: decode(c[0]), place: decode(c[1]), player: decode(c[2]), event, date, listPath: list[1] });
  }
  return out;
}

export function parseDecklist(html) {
  let leaderId = null;
  const cards = [];
  const cols = html.split('class="decklist-column-heading"').slice(1);
  for (const col of cols) {
    const heading = decode(col.slice(col.indexOf('>') + 1, col.indexOf('</div>')));
    for (const m of col.matchAll(/class="decklist-card" data-count="(\d+)" data-id="([^"]+)"/g)) {
      if (/^Leader/i.test(heading)) leaderId = m[2];
      else cards.push({ id: m[2], count: Number(m[1]) });
    }
  }
  return { leaderId, cards };
}

export function parseCardPage(html) {
  const tip = name => {
    const m = html.match(new RegExp(`data-tooltip="${name}">([\\s\\S]*?)</span>`));
    return m ? decode(m[1]) : null;
  };
  const sections = [...html.matchAll(/<(?:div|p) class="card-text-section">([\s\S]*?)<\/(?:div|p)>/g)].map(m => m[1]);
  const typeLine = decode((html.match(/class="card-text-type">([\s\S]*?)<\/p>/) || [, ''])[1]);
  const statLine = sections.map(decode).find(s => /Power|Cost/.test(s) && s.length < 80) || '';
  const textSection = sections.find(s => !/data-tooltip|card-text-title|Illustrated/.test(s) && !/^\s*\d+ Power/.test(decode(s)));
  const img = (html.match(/data-src="([^"]+\.webp)"/) || [])[1] || null;
  const type = tip('Category');
  const n = re => { const m = (typeLine + ' ' + statLine).match(re); return m ? Number(m[1]) : null; };
  const traits = tip('Type');
  return {
    id: decode((html.match(/class="card-text-id">([\s\S]*?)<\/span>/) || [, ''])[1]) || idFromImg(img || ''),
    name: decode((html.match(/class="card-text-name">([\s\S]*?)<\/span>/) || [, ''])[1]),
    type,
    colors: (tip('Color') || '').split('/').filter(Boolean),
    cost: type === 'Leader' ? null : n(/(\d+) Cost/),
    power: n(/(\d+) Power/),
    life: n(/(\d+) Life/),
    counter: n(/\+?(\d+) Counter/),
    attribute: tip('Attribute'),
    traits: traits ? traits.split('/').map(t => t.trim()) : [],
    text: textSection ? decode(textSection) : '',
    img,
    altImgs: [],
    legality: decode((html.match(/class="regulation-mark">([\s\S]*?)<\/div>/) || [, ''])[1]) || null,
  };
}
