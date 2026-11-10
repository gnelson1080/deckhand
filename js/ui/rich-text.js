// Turns card/lesson text into HTML where game keywords are tappable buttons.

export const escapeHtml = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const norm = s => s.toLowerCase().replace(/\s+/g, ' ').replace(/’/g, "'").trim();

export function buildTermIndex(glossary) {
  const exact = new Map();
  const patterns = [];
  for (const g of glossary || []) {
    for (const k of [g.term, ...(g.aliases || [])]) exact.set(norm(k), g.term);
    if (g.pattern) patterns.push([new RegExp(`^(?:${g.pattern})$`, 'i'), g.term]);
  }
  return { exact, patterns };
}

export function findTerm(idx, text) {
  const k = norm(text);
  if (idx.exact.has(k)) return idx.exact.get(k);
  for (const [re, term] of idx.patterns) if (re.test(text)) return term;
  return null;
}

const btn = (term, label, extra = '') =>
  `<button type="button" class="kw${extra}" data-term="${escapeHtml(term)}">${escapeHtml(label)}</button>`;

// [Keyword] | {Type} | DON!! -N (unbracketed)
const TOKEN = /\[([^\]\n]{1,40})\]|\{([^}\n]{1,40})\}|(DON!! ?[−-]\d+)/g;

export function richText(text, idx) {
  let out = '';
  let last = 0;
  for (const m of String(text ?? '').matchAll(TOKEN)) {
    out += escapeHtml(text.slice(last, m.index));
    last = m.index + m[0].length;
    if (m[1] !== undefined) {
      const term = findTerm(idx, m[1]);
      out += term ? btn(term, m[0]) : escapeHtml(m[0]);
    } else if (m[2] !== undefined) {
      const term = findTerm(idx, 'Trait');
      out += term ? btn(term, m[2], ' kw-trait') : escapeHtml(m[0]);
    } else {
      const term = findTerm(idx, m[3]);
      out += term ? btn(term, m[3]) : escapeHtml(m[3]);
    }
  }
  out += escapeHtml(String(text ?? '').slice(last));
  return out.replace(/\n/g, '<br>');
}

// Plain-English lines for every keyword found in a card's text (used on card detail).
export function termsIn(text, idx) {
  const found = [];
  for (const m of String(text ?? '').matchAll(TOKEN)) {
    const term = m[1] !== undefined ? findTerm(idx, m[1]) : m[3] ? findTerm(idx, m[3]) : null;
    if (term && !found.includes(term)) found.push(term);
  }
  return found;
}

// Links from third-party data: https only.
export const safeUrl = u => (/^https:\/\//i.test(String(u ?? '').trim()) ? String(u).trim() : '#');

export const GAME_COLORS = ['Red', 'Green', 'Blue', 'Purple', 'Black', 'Yellow'];
export const safeColors = cs => (Array.isArray(cs) ? cs.filter(c => GAME_COLORS.includes(c)) : []);
