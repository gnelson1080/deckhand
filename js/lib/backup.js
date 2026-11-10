// Backup code: "DH1." + base64url(UTF-8 JSON). Works in browsers and Node. Never throws on read.
const PREFIX = 'DH1.';

const toB64url = str => {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64url = s => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
};

export function makeBackup({ progress, decks, theme }) {
  return PREFIX + toB64url(JSON.stringify({ v: 1, progress, decks, theme: theme ?? null }));
}

const isProgress = p => p && Array.isArray(p.completed) && p.completed.every(Number.isInteger) && p.quiz && typeof p.quiz === 'object' && !Array.isArray(p.quiz);
const isDeck = d => d && typeof d.id === 'string' && typeof d.name === 'string' && (d.leaderId === null || typeof d.leaderId === 'string')
  && Array.isArray(d.entries) && d.entries.every(e => e && typeof e.id === 'string' && Number.isInteger(e.count) && e.count > 0 && e.count < 100);

export function readBackup(code) {
  const clean = String(code ?? '').replace(/\s+/g, '');
  if (!clean.startsWith(PREFIX)) return { ok: false, error: "That doesn't look like a Deckhand backup code. It should start with DH1." };
  let obj;
  try { obj = JSON.parse(fromB64url(clean.slice(PREFIX.length))); }
  catch { return { ok: false, error: 'This backup code is incomplete or damaged. Copy the whole code and try again.' }; }
  if (!obj || obj.v !== 1) return { ok: false, error: 'This Deckhand backup is from a newer version of the app.' };
  if (!isProgress(obj.progress) || !Array.isArray(obj.decks) || !obj.decks.every(isDeck)) return { ok: false, error: 'This backup code is incomplete or damaged. Copy the whole code and try again.' };
  return { ok: true, data: { progress: obj.progress, decks: obj.decks, theme: obj.theme === 'dark' || obj.theme === 'light' ? obj.theme : null } };
}

export function describeBackup({ progress, decks }) {
  const n = progress?.completed?.length || 0, d = decks?.length || 0;
  return `${n} lesson${n === 1 ? '' : 's'} done, ${d} deck${d === 1 ? '' : 's'}`;
}
