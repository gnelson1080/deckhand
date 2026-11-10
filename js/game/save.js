// Save / resume a practice game. Only saved at stable moments (no effect half-resolved).
import { VERSION } from './engine.js';

export function saveGame(state, meta = {}) {
  if (state.stack?.length) return null;
  return JSON.stringify({ v: VERSION, meta, state });
}

export function loadGame(str, pool) {
  let obj;
  try { obj = JSON.parse(str); } catch { return { ok: false, error: "This saved game can't continue. Start a new one." }; }
  if (!obj || obj.v !== VERSION || !obj.state?.players) return { ok: false, error: "This saved game can't continue after an app update. Start a new one." };
  const ids = [];
  for (const P of obj.state.players) {
    if (!P?.leader) return { ok: false, error: "This saved game can't continue. Start a new one." };
    ids.push(P.leader.id, ...[P.deck, P.hand, P.life, P.trash, P.chars].flatMap(z => (Array.isArray(z) ? z.map(c => c.id) : [])), ...(P.stage ? [P.stage.id] : []));
  }
  if (ids.some(id => !pool[id])) return { ok: false, error: "This saved game can't continue because the practice decks were updated. Start a new one." };
  return { ok: true, state: obj.state, meta: obj.meta || {} };
}
