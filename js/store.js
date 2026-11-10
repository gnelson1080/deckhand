// Tiny persistent store. Falls back to memory when localStorage is missing or blocked.
const PREFIX = 'deckhand:';

export function createStore(storage) {
  const mem = new Map();
  return {
    get(key, fallback = null) {
      if (mem.has(key)) return mem.get(key);
      try {
        const raw = storage?.getItem(PREFIX + key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch { return fallback; }
    },
    set(key, value) {
      mem.set(key, value);
      try { storage?.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* private mode: keep in memory */ }
    },
  };
}

let shared;
export const store = () => (shared ||= (() => { let ls = null; try { ls = globalThis.localStorage; } catch { /* blocked */ } return createStore(ls); })());
