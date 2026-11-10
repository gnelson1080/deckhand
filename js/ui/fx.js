// Small feedback effects. All of them step aside under reduced motion.
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export const buzz = pattern => { try { navigator.vibrate?.(pattern); } catch { /* not supported */ } };

export function shake(el) {
  if (reduced() || !el) return;
  el.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-7px)' }, { transform: 'translateX(7px)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(0)' }], { duration: 360, easing: 'ease-out' });
}

// Ink stamp that thumps onto an element and fades.
export function stamp(host, text, { tone = 'good', stay = 1400 } = {}) {
  if (!host) return;
  const s = document.createElement('span');
  s.className = `stamp stamp-${tone}`;
  s.textContent = text;
  s.setAttribute('aria-hidden', 'true');
  host.style.position ||= 'relative';
  host.append(s);
  if (reduced()) { setTimeout(() => s.remove(), stay); return; }
  s.animate([
    { opacity: 0, transform: 'translate(-50%,-50%) scale(2.4) rotate(-16deg)' },
    { opacity: 1, transform: 'translate(-50%,-50%) scale(.9) rotate(-9deg)', offset: .55 },
    { opacity: 1, transform: 'translate(-50%,-50%) scale(1) rotate(-9deg)' },
  ], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
  setTimeout(() => s.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' }).onfinish = () => s.remove(), stay);
}

// Paper-scrap confetti: small torn pieces of chart paper and signal-flag colors.
export function confetti({ duration = 1300, count = 70 } = {}) {
  if (reduced()) return;
  const c = document.createElement('canvas');
  c.className = 'confetti';
  const dpr = Math.min(devicePixelRatio || 1, 2);
  c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  document.body.append(c);
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  const css = getComputedStyle(document.documentElement);
  const colors = ['--flag-red', '--flag-yellow', '--sea', '--paper', '--ink'].map(v => css.getPropertyValue(v).trim() || '#cf2330');
  const bits = Array.from({ length: count }, () => ({
    x: innerWidth / 2 + (Math.random() - .5) * 80, y: innerHeight * .55,
    vx: (Math.random() - .5) * 11, vy: -Math.random() * 15 - 6,
    w: 6 + Math.random() * 8, h: 4 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - .5) * .4,
    col: colors[Math.floor(Math.random() * colors.length)],
  }));
  const t0 = performance.now();
  const frame = t => {
    const k = (t - t0) / duration;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const b of bits) {
      b.vy += .45; b.vx *= .99; b.x += b.vx; b.y += b.vy; b.r += b.vr;
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k * k); ctx.translate(b.x, b.y); ctx.rotate(b.r);
      ctx.fillStyle = b.col;
      ctx.beginPath(); ctx.moveTo(-b.w / 2, -b.h / 2); ctx.lineTo(b.w / 2, -b.h / 2 + 1); ctx.lineTo(b.w / 2 - 1, b.h / 2); ctx.lineTo(-b.w / 2 + 1, b.h / 2 - 1); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    if (k < 1) requestAnimationFrame(frame); else c.remove();
  };
  requestAnimationFrame(frame);
}
