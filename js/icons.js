// Inline SVG icons, drawn on a 24px grid with a slightly irregular hand-inked stroke.
const P = {
  compass: '<circle cx="12" cy="12" r="9.2"/><path d="M15.6 8.4l-2.2 5-5 2.2 2.2-5z"/><path d="M12 2.8v1.6M12 19.6v1.6M2.8 12h1.6M19.6 12h1.6"/>',
  scroll: '<path d="M6 4.5h10.5a2.5 2.5 0 0 1 2.5 2.5v11.2"/><path d="M6 4.5A2.5 2.5 0 0 0 3.5 7v.6H6"/><path d="M6 4.5v13.8a2.2 2.2 0 0 0 2.2 2.2h10.6a2.2 2.2 0 0 0 0-4.4H10"/><path d="M9 8.6h6.4M9 11.8h5"/>',
  spyglass: '<path d="M3.2 15.4l11.4-8.6 2.6 3.4-11.4 8.6z"/><path d="M14.6 6.8l3.3-2.5 2.6 3.4-3.3 2.5"/><path d="M6.6 17.6l1.4 3.6M9.4 15.6l2.4 5.6"/>',
  map: '<path d="M3.5 6.2l5.4-2.1 6.2 2.2 5.4-2.1v13.6l-5.4 2.1-6.2-2.2-5.4 2.1z"/><path d="M8.9 4.1v13.6M15.1 6.3v13.6"/>',
  ship: '<path d="M3 15.5h18l-2.6 4.2H5.8z"/><path d="M12 3.4v12.1"/><path d="M12 4.2c3.4 1.6 5.6 4.6 6.2 9H12"/><path d="M12 6.6c-2.4 1.4-4 3.6-4.5 6.6H12"/><path d="M12 3.4l3-1"/>',
  anchor: '<circle cx="12" cy="5" r="2"/><path d="M12 7v13.5M8 10.5h8"/><path d="M4 13.5c.4 4 3.8 7 8 7s7.6-3 8-7"/>',
  check: '<path d="M4.5 12.8l4.7 4.6L19.6 6.8"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  search: '<circle cx="10.6" cy="10.6" r="6.4"/><path d="M15.4 15.4l5 5"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.5 1.5M17.1 17.1l1.5 1.5M5.4 18.6l1.5-1.5M17.1 6.9l1.5-1.5"/>',
  moon: '<path d="M19.6 14.6A8 8 0 0 1 9.4 4.4a8 8 0 1 0 10.2 10.2z"/>',
  flag: '<path d="M5 21V3.5"/><path d="M5 4h12.5l-3 4 3 4H5"/>',
  monitor: '<rect x="2.8" y="4" width="18.4" height="12.4" rx="1.6"/><path d="M8.6 20.2h6.8M12 16.4v3.8"/>',
  phone: '<rect x="6.6" y="2.6" width="10.8" height="18.8" rx="2.2"/><path d="M10.6 18.2h2.8"/>',
  info: '<circle cx="12" cy="12" r="9.2"/><path d="M12 11v5.6M12 7.6v.2"/>',
  link: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
  alert: '<path d="M12 3.2 21.4 19.8H2.6z"/><path d="M12 9.6v4.6"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>',
};

export function icon(name, { size = 24, stroke = 1.9, label } = {}) {
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  return `<svg ${a11y} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${P[name] || ''}</svg>`;
}
