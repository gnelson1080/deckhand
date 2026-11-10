// Saved decks, kept in the app store under "decks".
const valid = d => d && typeof d === 'object' && typeof d.id === 'string' && Array.isArray(d.entries);
const newId = () => 'd_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function createDecks(store) {
  const read = () => { const v = store.get('decks', []); return Array.isArray(v) ? v.filter(valid) : []; };
  const write = list => store.set('decks', list);
  return {
    list: () => read().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))),
    get: id => structuredClone(read().find(d => d.id === id) || null),
    save(deck) {
      const list = read();
      const d = { name: 'Untitled deck', leaderId: null, entries: [], ...structuredClone(deck), id: deck.id || newId(), updatedAt: new Date().toISOString() };
      const i = list.findIndex(x => x.id === d.id);
      if (i >= 0) list[i] = d; else list.push(d);
      write(list);
      return structuredClone(d);
    },
    remove(id) { write(read().filter(d => d.id !== id)); },
    duplicate(id) {
      const src = read().find(d => d.id === id);
      if (!src) return null;
      return this.save({ ...structuredClone(src), id: undefined, name: `${src.name} (copy)` });
    },
  };
}
