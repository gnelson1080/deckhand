// Computer vs. phone layout. The reader picks once; we only suggest.
export const LAYOUTS = ['desktop', 'mobile'];
export const suggestLayout = ({ width, coarse }) => (width >= 1024 && !coarse ? 'desktop' : 'mobile');
export const readLayout = st => { const v = st.get('layout', null); return LAYOUTS.includes(v) ? v : null; };
export const isDesktop = () => globalThis.document?.documentElement.dataset.layout === 'desktop';
