import { getGlossary } from '../data.js';
import { escapeHtml, richText } from '../ui/rich-text.js';
import { termIndex } from '../ui/define.js';
import { icon } from '../icons.js';

const GROUP_ORDER = ['Card types', 'Table areas', 'Card states', 'Card stats', 'Turn', 'Battle', 'Keywords', 'Deck building', 'Common phrases'];

export async function render(root, param) {
  root.innerHTML = `<h1 class="page-title">Glossary</h1>
    <p class="page-lede">Every word the game uses, in plain English. You can also tap any underlined word elsewhere in the app.</p>
    <label class="search-field">${icon('search', { size: 20 })}<span class="visually-hidden">Search the glossary</span>
      <input type="search" placeholder="Search words, like blocker" autocomplete="off" enterkeyhint="search"></label>
    <nav class="glossary-groups" aria-label="Glossary sections"></nav>
    <div class="glossary-list"></div>`;
  const [glossary, idx] = await Promise.all([getGlossary(), termIndex()]);
  const list = root.querySelector('.glossary-list');
  const nav = root.querySelector('.glossary-groups');
  const input = root.querySelector('input');
  const groups = GROUP_ORDER.filter(g => glossary.some(x => x.group === g));
  nav.innerHTML = groups.map(g => `<a class="chip" href="#" data-jump="${escapeHtml(g)}">${escapeHtml(g)}</a>`).join('');
  nav.addEventListener('click', e => {
    const a = e.target.closest('[data-jump]'); if (!a) return;
    e.preventDefault();
    root.querySelector(`[data-group="${CSS.escape(a.dataset.jump)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  const entry = g => `<details class="term" id="term-${escapeHtml(g.term.replace(/\W+/g, '-'))}" data-term="${escapeHtml(g.term)}">
      <summary><span class="term-name">${escapeHtml(g.term)}</span><span class="term-short">${escapeHtml(g.short)}</span></summary>
      <div class="term-body">${g.long ? `<p>${richText(g.long, idx)}</p>` : ''}
        ${g.example ? `<a href="#/card/${encodeURIComponent(g.example)}">See an example card</a>` : ''}
        ${g.aliases.length ? `<p class="muted term-aliases">Also written as: ${g.aliases.map(escapeHtml).join(', ')}</p>` : ''}</div>
    </details>`;

  const draw = q => {
    const needle = q.trim().toLowerCase();
    const match = g => !needle || [g.term, ...g.aliases, g.short].some(s => s.toLowerCase().includes(needle));
    const html = groups.map(grp => {
      const items = glossary.filter(g => g.group === grp && match(g));
      return items.length ? `<section class="term-group" data-group="${escapeHtml(grp)}"><h2>${escapeHtml(grp)}</h2>${items.map(entry).join('')}</section>` : '';
    }).join('');
    list.innerHTML = html || `<p class="empty">No word matches "${escapeHtml(q)}". Try a shorter search, like "DON".</p>`;
    nav.hidden = !!needle;
  };
  draw('');
  input.addEventListener('input', () => draw(input.value));

  // Smooth open/close height animation
  list.addEventListener('click', e => {
    const s = e.target.closest('summary'); if (!s) return;
    const d = s.parentElement;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    e.preventDefault();
    const body = d.querySelector('.term-body');
    if (d.open) {
      body.animate([{ height: body.scrollHeight + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 200, easing: 'ease-in' }).onfinish = () => { d.open = false; };
    } else {
      d.open = true;
      body.animate([{ height: '0px', opacity: 0 }, { height: body.scrollHeight + 'px', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
  });

  if (param) {
    const d = list.querySelector(`details[data-term="${CSS.escape(param)}"]`);
    if (d) { d.open = true; d.classList.add('flash'); setTimeout(() => d.scrollIntoView({ block: 'center' }), 50); }
  }
}
