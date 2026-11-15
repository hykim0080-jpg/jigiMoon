// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// size references beside the MAST pole, k px per metre: an astronaut (1.8 m) and a generic small lander (4 m)
export function SCALE_FIGS(k) {
  const a = 1.8 * k, l = 4 * k, lw = 3.6 * k;
  return `<svg width="${(0.7 * k).toFixed(1)}" height="${a.toFixed(1)}" viewBox="0 0 7 18"><circle cx="3.5" cy="2.2" r="2"/><path d="M1 5h5l.6 6H5.2l-.3 7H3.9l-.4-5-.4 5H2.1l-.3-7H.4z"/></svg>`
    + `<svg width="${lw.toFixed(1)}" height="${l.toFixed(1)}" viewBox="0 0 36 40"><path d="M10 6h16l3 16H7z"/><path d="M7 22h22v6H7z"/><path d="M9 28 2 40h3l7-12zM27 28l7 12h-3l-7-12z"/><path d="M17 0h2v6h-2z"/></svg>`;
}
