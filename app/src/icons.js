// The app's SF Symbols, drawn as inline SVG.
//
// A browser cannot use SF Symbols, so each one the app shows is redrawn here
// at the same weight and proportions, on a 24-unit grid, in currentColor so it
// takes the tab bar's tint the way the app's symbols take `.tint`.

const svg = (body, { fill = false, label = "" } = {}) =>
  `<svg viewBox="0 0 24 24" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'} focusable="false"` +
  ` fill="${fill ? "currentColor" : "none"}" stroke="${fill ? "none" : "currentColor"}"` +
  ` stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICONS = {
  // circle.circle
  chart: svg(`<circle cx="12" cy="12" r="9.2"/><circle cx="12" cy="12" r="4.6"/>`),
  chartFill: svg(`<path fill-rule="evenodd" d="M12 1.8a10.2 10.2 0 1 1 0 20.4 10.2 10.2 0 0 1 0-20.4Zm0 4.6a5.6 5.6 0 1 0 0 11.2 5.6 5.6 0 0 0 0-11.2Zm0 2a3.6 3.6 0 1 1 0 7.2 3.6 3.6 0 0 1 0-7.2Z"/>`, { fill: true }),
  // square.grid.2x2 (filled when selected, as the system tab bar does)
  areas: svg(`<rect x="3.2" y="3.2" width="7.4" height="7.4" rx="2"/><rect x="13.4" y="3.2" width="7.4" height="7.4" rx="2"/><rect x="3.2" y="13.4" width="7.4" height="7.4" rx="2"/><rect x="13.4" y="13.4" width="7.4" height="7.4" rx="2"/>`),
  areasFill: svg(`<rect x="2.6" y="2.6" width="8.4" height="8.4" rx="2.2"/><rect x="13" y="2.6" width="8.4" height="8.4" rx="2.2"/><rect x="2.6" y="13" width="8.4" height="8.4" rx="2.2"/><rect x="13" y="13" width="8.4" height="8.4" rx="2.2"/>`, { fill: true }),
  // sparkles
  signs: svg(`<path d="M10 7.5c.6 3.6 1.9 4.9 5.5 5.5-3.6.6-4.9 1.9-5.5 5.5-.6-3.6-1.9-4.9-5.5-5.5 3.6-.6 4.9-1.9 5.5-5.5Z"/><path d="M17.5 2.8c.3 1.6.8 2.1 2.4 2.4-1.6.3-2.1.8-2.4 2.4-.3-1.6-.8-2.1-2.4-2.4 1.6-.3 2.1-.8 2.4-2.4Z"/><path d="M6 2.6c.2 1 .5 1.3 1.5 1.5-1 .2-1.3.5-1.5 1.5-.2-1-.5-1.3-1.5-1.5 1-.2 1.3-.5 1.5-1.5Z"/>`),
  signsFill: svg(`<path d="M10 6.6c.7 4.1 2.3 5.6 6.4 6.4-4.1.7-5.6 2.3-6.4 6.4-.7-4.1-2.3-5.6-6.4-6.4 4.1-.7 5.6-2.3 6.4-6.4Z"/><path d="M17.5 2.2c.35 1.9.95 2.5 2.85 2.85-1.9.35-2.5.95-2.85 2.85-.35-1.9-.95-2.5-2.85-2.85 1.9-.35 2.5-.95 2.85-2.85Z"/><path d="M6 2c.25 1.2.6 1.55 1.8 1.8-1.2.25-1.55.6-1.8 1.8-.25-1.2-.6-1.55-1.8-1.8 1.2-.25 1.55-.6 1.8-1.8Z"/>`, { fill: true }),
  // rectangle.stack.fill
  tarot: svg(`<rect x="2.5" y="8.6" width="19" height="12.6" rx="2.6"/><path d="M5.2 5.6h13.6a1.2 1.2 0 0 1 0 2.4H5.2a1.2 1.2 0 0 1 0-2.4Zm2-3h9.6a1.1 1.1 0 0 1 0 2.2H7.2a1.1 1.1 0 0 1 0-2.2Z"/>`, { fill: true }),
  // location.north.line
  sky: svg(`<path d="M12 7.2 17.6 21 12 17.8 6.4 21 12 7.2Z" fill="currentColor"/><path d="M12 1.8v3.4"/>`),
  // slider.horizontal.3
  settings: svg(`<path d="M3 6h7.2M14.8 6H21M3 12h2.6M10.2 12H21M3 18h10.6M18.2 18H21"/><circle cx="12.5" cy="6" r="2.3"/><circle cx="7.9" cy="12" r="2.3"/><circle cx="15.9" cy="18" r="2.3"/>`),
  // bubble.right
  feedback: svg(`<path d="M6 3.8h12a3 3 0 0 1 3 3v7.4a3 3 0 0 1-3 3h-2.8l.6 3.2-4.6-3.2H6a3 3 0 0 1-3-3V6.8a3 3 0 0 1 3-3Z"/>`),
  // sidebar.left
  sidebar: svg(`<rect x="2.6" y="4" width="18.8" height="16" rx="3"/><path d="M9 4v16M5 8h1.8M5 11h1.8M5 14h1.8"/>`),
  chevronRight: svg(`<path d="m9 5 7 7-7 7"/>`),
  chevronLeft: svg(`<path d="m15 4-8 8 8 8"/>`),
  xmark: svg(`<path d="M6 6l12 12M18 6 6 18"/>`),
  lock: svg(`<path d="M7.5 10.2V7.6a4.5 4.5 0 0 1 9 0v2.6"/><rect x="5" y="10.2" width="14" height="10.6" rx="2.4" fill="currentColor"/>`),
  plusCircle: svg(`<circle cx="12" cy="12" r="9"/><path d="M12 7.8v8.4M7.8 12h8.4"/>`),
  check: svg(`<path fill-rule="evenodd" d="M12 2.4a9.6 9.6 0 1 1 0 19.2 9.6 9.6 0 0 1 0-19.2Zm4.3 6.4a1 1 0 0 0-1.4.1l-4 4.8-1.9-1.9a1 1 0 1 0-1.4 1.4l2.7 2.7a1 1 0 0 0 1.5-.1l4.6-5.6a1 1 0 0 0-.1-1.4Z"/>`, { fill: true }),
  person: svg(`<circle cx="12" cy="8" r="4"/><path d="M4 20.5c.8-4 4-6 8-6s7.2 2 8 6Z"/>`, { fill: true }),
  shuffle: svg(`<path d="M3 7h3.6c2.4 0 3.6 1.2 5 4l1 2c1.4 2.8 2.6 4 5 4H21M3 17h3.6c1.6 0 2.6-.5 3.6-1.6M14 8.6C15 7.5 16 7 17.6 7H21M18.4 4.2 21 7l-2.6 2.8M18.4 14.2 21 17l-2.6 2.8"/>`),
};

/**
 * MoonApsideGlyph: Black Moon Lilith (filled) and White Moon Selena (open)
 * share a crescent over a cross. Selena's own character isn't in most
 * system fonts, so the app draws both, and so does this.
 */
export function moonApsideGlyph(filled, size = 16) {
  return `<svg class="apside" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false">` +
    `<path d="M15.6 2.6a6.4 6.4 0 1 0 0 11.6 5.3 5.3 0 1 1 0-11.6Z" fill="${filled ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<path d="M10.4 15v6.6M7.4 18.4h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
}
