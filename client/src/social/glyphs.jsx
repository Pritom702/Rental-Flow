// ============================================================
//  RentalFlow  |  Community  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: RentalFlow's own glyphs (reactions, badges, UI)
// ============================================================
// Hand-drawn two-tone icons in the Lime style, used instead of emoji so the
// community looks like RentalFlow and nothing else: an outline in the text
// colour (currentColor) with a lime fill (--g-fill), on a 24 × 24 grid.
//
// Reactions are "sparks", RentalFlow's own set:
//   spark    the brand bolt — the everyday "yes!"
//   want     a magnet — "I want this" (the rental-native reaction)
//   genius   a bulb — useful, clever
//   wow      a starburst
//   lol      a squinting grin
//   adore    a heart with a new leaf
//
// The same drawings are exported as SVG strings (glyphSvg) so the burst
// effect in fx.js can throw them around without React.
// Outline colour: the text colour by default; filled stickers (sparks,
// medallions) set --g-line to forest so they read the same in dark mode.
const S = 'var(--g-line, currentColor)';
const F = 'var(--g-fill, #C6F24E)';
const D = 'var(--g-dark, #10291D)';   // for small solid details on a lime fill
const line = (d, w = 1.7) => `<path d="${d}" fill="none" stroke="${S}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const solid = (d, fill = F, w = 1.6) => `<path d="${d}" fill="${fill}" stroke="${S}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
const dot = (cx, cy, r, fill = S) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;

const G = {
  // ---------------------------------------------------------------- reactions
  spark: solid('M13.6 2.2 5 13.4h6.3L10 21.8l9-12.3h-6.4z'),
  want: solid('M4.8 4.2h4.4v7.6a2.8 2.8 0 0 0 5.6 0V4.2h4.4v7.6a7.2 7.2 0 0 1-14.4 0z')
    + line('M4.8 7.8h4.4M14.8 7.8h4.4') + line('M8.5 1.6l-.6 1M12 1.2v1.1M15.5 1.6l.6 1', 1.4),
  genius: solid('M12 2.6a6.6 6.6 0 0 0-3.9 11.9c.7.5 1.1 1.3 1.1 2.1v.9h5.6v-.9c0-.8.4-1.6 1.1-2.1A6.6 6.6 0 0 0 12 2.6z')
    + line('M9.7 20.1h4.6M10.6 22.2h2.8') + line('M10.3 10.2l1.7 1.7 1.7-1.7M12 11.9v5', 1.4),
  wow: solid('M12 1.8l2.4 5.3 5.6-1.7-2.1 5.5 4.5 3.3-5.7.9.3 5.8L12 17.6l-5 3.3.3-5.8-5.7-.9 4.5-3.3-2.1-5.5 5.6 1.7z')
    + `<ellipse cx="12" cy="12.3" rx="1.7" ry="2.1" fill="${D}"/>`,
  lol: solid('M12 2.6a9.4 9.4 0 1 1 0 18.8 9.4 9.4 0 0 1 0-18.8z')
    + line('M7.4 8.9l2.2 1.3-2.2 1.3M16.6 8.9l-2.2 1.3 2.2 1.3', 1.6)
    + `<path d="M7.3 13.8h9.4a4.7 4.7 0 0 1-9.4 0z" fill="${D}"/>`,
  adore: solid('M12 20.6S3.4 15.3 3.4 9.4a4.4 4.4 0 0 1 8.6-1.8 4.4 4.4 0 0 1 8.6 1.8c0 5.9-8.6 11.2-8.6 11.2z')
    + `<path d="M12 7.6c-.1-2.7 1.5-4.6 4.4-5.1-.1 2.8-1.7 4.6-4.4 5.1z" fill="${D}"/>`,

  // ---------------------------------------------------------------- actions
  chat: line('M4 6a2.6 2.6 0 0 1 2.6-2.6h10.8A2.6 2.6 0 0 1 20 6v7.6a2.6 2.6 0 0 1-2.6 2.6H10.4L5.8 20v-3.8A2.6 2.6 0 0 1 4 13.6z')
    + dot(8.6, 9.8, 1.2, F) + dot(12, 9.8, 1.2, F) + dot(15.4, 9.8, 1.2, F),
  pass: solid('M20.8 3.2 3.4 10.4l6.9 2.6 2.6 6.9z', F, 1.6) + line('M10.3 13l4.9-4.9'),
  keep: line('M6.4 3.4h11.2v17.2L12 16.5l-5.6 4.1z'),
  'keep-on': solid('M6.4 3.4h11.2v17.2L12 16.5l-5.6 4.1z'),
  more: dot(5.5, 12, 1.8) + dot(12, 12, 1.8) + dot(18.5, 12, 1.8),
  link: line('M10 14a4 4 0 0 0 5.7 0l3.2-3.2a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0L5.1 13.2a4 4 0 0 0 5.7 5.7l1-1'),
  flag: line('M5 21V4') + solid('M5 4.2h11.6l-2.4 4 2.4 4H5z'),
  trash: line('M4.5 6.5h15M9.5 6.5V4.2h5v2.3M6.5 6.5l1 13.3h9l1-13.3M10.3 10v6.5M13.7 10v6.5'),
  eye: line('M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z') + `<circle cx="12" cy="12" r="3.1" fill="${F}" stroke="${S}" stroke-width="1.6"/>`,
  check: line('m5 12.5 4.4 4.4L19 7.3', 2),
  close: line('M6 6l12 12M18 6 6 18', 2),
  plus: line('M12 5v14M5 12h14', 2),
  play: solid('M8 5.2v13.6L19 12z'),
  'sound-on': line('M4 9.3v5.4h3.6l4.9 4V5.3l-4.9 4z') + line('M16 8.8a4.5 4.5 0 0 1 0 6.4M18.6 6.3a8 8 0 0 1 0 11.4'),
  'sound-off': line('M4 9.3v5.4h3.6l4.9 4V5.3l-4.9 4z') + line('m16.5 9.5 5 5M21.5 9.5l-5 5'),
  search: line('M10.8 17.6a6.8 6.8 0 1 0 0-13.6 6.8 6.8 0 0 0 0 13.6zM20 20l-4.4-4.4'),

  // ---------------------------------------------------------------- kinds of post
  post: solid('M4 20l1-4.6L15.6 4.8a2.1 2.1 0 0 1 3 3L8 18.4z') + line('M13.6 6.8l3 3'),
  showcase: line('M3.4 6.6h12.8v12.2H3.4z') + line('M3.4 16l4-4 3 3 2-2 3.8 3.8') + solid('M19.2 2.2l.9 2.2 2.2.9-2.2.9-.9 2.2-.9-2.2-2.2-.9 2.2-.9z', F, 1.2),
  question: line('M4 6a2.6 2.6 0 0 1 2.6-2.6h10.8A2.6 2.6 0 0 1 20 6v7.6a2.6 2.6 0 0 1-2.6 2.6H10.4L5.8 20v-3.8A2.6 2.6 0 0 1 4 13.6z')
    + line('M10 8.1a2.1 2.1 0 1 1 2.9 1.9c-.6.3-.9.7-.9 1.2v.3', 1.6) + dot(12, 13.4, 1.05),
  guide: solid('M3 5.4c3-1 6-.8 9 1 3-1.8 6-2 9-1v13.2c-3-1-6-.8-9 1-3-1.8-6-2-9-1z') + line('M12 6.4v13.2'),
  wanted: `<circle cx="6.6" cy="15.6" r="3.6" fill="${F}" stroke="${S}" stroke-width="1.6"/><circle cx="17.4" cy="15.6" r="3.6" fill="${F}" stroke="${S}" stroke-width="1.6"/>`
    + line('M10.2 15.2h3.6M3.4 13.4 6.3 5h3.2l.6 7.2M20.6 13.4 17.7 5h-3.2l-.6 7.2'),
  poll: `<rect x="3.6" y="11" width="4.2" height="9" rx="1.2" fill="${F}" stroke="${S}" stroke-width="1.6"/><rect x="9.9" y="4" width="4.2" height="16" rx="1.2" fill="${F}" stroke="${S}" stroke-width="1.6"/><rect x="16.2" y="14" width="4.2" height="6" rx="1.2" fill="${F}" stroke="${S}" stroke-width="1.6"/>`,
  sell: solid('M3 12.2V4.6A1.6 1.6 0 0 1 4.6 3h7.6l8.9 8.9a1.6 1.6 0 0 1 0 2.3l-6.9 6.9a1.6 1.6 0 0 1-2.3 0z') + `<circle cx="7.7" cy="7.7" r="1.6" fill="${S}"/>`,
  media: line('M3.4 5.4h17.2v13.2H3.4z') + `<circle cx="8.4" cy="9.6" r="1.8" fill="${F}" stroke="${S}" stroke-width="1.5"/>` + solid('M3.4 18.6l5.6-5.4 3.4 3.1 3.1-2.9 5.1 5.2z'),
  file: line('M20 11.4l-7.9 7.9a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8'),
  rent: solid('M12 2.6 3.4 7.4v9.2l8.6 4.8 8.6-4.8V7.4z') + line('M3.4 7.4 12 12.2l8.6-4.8M12 12.2v9.2'),

  // ---------------------------------------------------------------- rewards + badges
  flame: solid('M12 21.8c-4 0-7.1-2.8-7.1-6.7 0-3.4 2.4-5.5 3.7-8.1.5 1.5 1.3 2.6 2.4 3.1.2-3.3 1.9-6 4.7-7.5-.3 3.1 1 4.9 2.5 6.8 1 1.3 1.9 2.9 1.9 5.5 0 4.1-3.8 6.9-8.1 6.9z')
    + `<path d="M12 21.8c-1.7 0-3-1.2-3-2.9 0-1.6 1.2-2.5 1.8-3.8.5 1 1.1 1.5 1.8 1.7.2-1.5.9-2.6 2-3.3.1 1.5.9 2.3 1.4 3.2.4.7.8 1.3.8 2.3 0 1.7-1.5 2.8-4.8 2.8z" fill="${D}" opacity=".9"/>`,
  sprout: line('M12 21.4v-8.6') + solid('M12 13c0-3.6-2.5-6.2-6.8-6.2 0 3.7 2.6 6.2 6.8 6.2z') + solid('M12 11.2c0-3.2 2.1-5.8 6.3-5.8 0 3.4-2.4 5.8-6.3 5.8z'),
  shield: solid('M12 2.8l7.4 3.1v6c0 4.6-3 7.8-7.4 9.3-4.4-1.5-7.4-4.7-7.4-9.3v-6z') + line('m8.6 12 2.4 2.4 4.6-4.6', 1.9),
  box: solid('M12 2.6 3.4 7.4v9.2l8.6 4.8 8.6-4.8V7.4z') + line('M3.4 7.4 12 12.2l8.6-4.8M12 12.2v9.2'),
  store: solid('M3.6 9.2 5 3.8h14l1.4 5.4a2.9 2.9 0 0 1-5.6.8 2.9 2.9 0 0 1-5.6 0 2.9 2.9 0 0 1-5.6-.8z') + line('M5 11.2v9h14v-9M10 20.2v-5h4v5'),
  coin: `<circle cx="12" cy="12" r="8.8" fill="${F}" stroke="${S}" stroke-width="1.6"/><circle cx="12" cy="12" r="5.8" fill="none" stroke="${S}" stroke-width="1.2" stroke-dasharray="1.6 1.6"/>` + line('M12 8.6v6.8M10.2 10.2h2.6a1.3 1.3 0 0 1 0 2.6h-1.6a1.3 1.3 0 0 0 0 2.6h2.6', 1.4),
  ticket: solid('M3.2 7.6A1.6 1.6 0 0 1 4.8 6h14.4a1.6 1.6 0 0 1 1.6 1.6v2.2a2.2 2.2 0 0 0 0 4.4v2.2a1.6 1.6 0 0 1-1.6 1.6H4.8a1.6 1.6 0 0 1-1.6-1.6v-2.2a2.2 2.2 0 0 0 0-4.4z') + line('M14.6 6v12', 1.4),
  key: `<circle cx="8" cy="12" r="4.6" fill="${F}" stroke="${S}" stroke-width="1.6"/>` + dot(8, 12, 1.4) + line('M12.6 12h8.4M18.4 12v3.2M15.8 12v2.2'),
  compass: `<circle cx="12" cy="12" r="9" fill="none" stroke="${S}" stroke-width="1.6"/>` + solid('m15.8 8.2-2.2 5.4-5.4 2.2 2.2-5.4z'),
  wave: line('M6.4 12.8V7.4a1.4 1.4 0 0 1 2.8 0v4M9.2 11.2V5.6a1.4 1.4 0 0 1 2.8 0v5.6M12 10.8V6.4a1.4 1.4 0 0 1 2.8 0v5.8M14.8 12.2V9a1.4 1.4 0 0 1 2.8 0v4.4c0 4-2.6 7-6.4 7-2.6 0-4.3-1.3-5.4-3.4l-2-3.8a1.4 1.4 0 0 1 2.4-1.4l1 1.6'),
  camera: solid('M3.4 8.2A1.8 1.8 0 0 1 5.2 6.4h2.4l1.5-2.2h5.8l1.5 2.2h2.4a1.8 1.8 0 0 1 1.8 1.8v9.8a1.8 1.8 0 0 1-1.8 1.8H5.2A1.8 1.8 0 0 1 3.4 18z') + `<circle cx="12" cy="13" r="3.6" fill="${D}" stroke="${S}" stroke-width="1.4"/>`,
  star: solid('M12 2.8l2.8 5.8 6.3.8-4.6 4.4 1.1 6.3L12 17.1l-5.6 3 1.1-6.3-4.6-4.4 6.3-.8z'),
  people: `<circle cx="9" cy="8.4" r="3.4" fill="${F}" stroke="${S}" stroke-width="1.6"/><circle cx="16.6" cy="9.4" r="2.6" fill="${F}" stroke="${S}" stroke-width="1.6"/>` + line('M2.8 20.2c0-3.6 2.8-5.8 6.2-5.8s6.2 2.2 6.2 5.8M15 14.6c3.2-.4 6 1.4 6 4.8'),
  bolt: solid('M13.6 2.2 5 13.4h6.3L10 21.8l9-12.3h-6.4z'),
  crown: solid('M3.4 7.4l4.4 4 4.2-7 4.2 7 4.4-4-1.8 11.2H5.2z') + line('M5.2 21h13.6'),
  medal: line('M8.2 2.8 10.6 9M15.8 2.8 13.4 9') + `<circle cx="12" cy="14.8" r="6" fill="${F}" stroke="${S}" stroke-width="1.6"/>` + solid('m12 11.6 1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3z', D, 0),
  trophy: solid('M7 3.6h10v5.2a5 5 0 0 1-10 0z') + line('M7 5.6H4.4a2.6 2.6 0 0 0 2.8 3.6M17 5.6h2.6a2.6 2.6 0 0 1-2.8 3.6M12 13.8v3.4M8.4 20.6h7.2M9.4 17.2h5.2v3.4H9.4z'),
  trend: line('M3 16.6l5.4-5.4 4 3.2 8.2-8.2') + line('M15.2 6.2h5.4v5.4') + dot(3, 16.6, 1.4, F),
  warn: solid('M12 3.2 2.6 19.6h18.8z') + line('M12 9.6v4.6M12 16.9v.1', 2),
  ban: `<circle cx="12" cy="12" r="8.8" fill="${F}" stroke="${S}" stroke-width="1.6"/>` + line('M5.9 18.1 18.1 5.9', 2),
  sparkle: solid('M12 2.4l2 5.6 5.6 2-5.6 2-2 5.6-2-5.6-5.6-2 5.6-2z') + solid('M19 15.6l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8z', F, 1.2),
  gift: solid('M3.8 8.6h16.4v3.6H3.8z') + solid('M5.2 12.2h13.6v8.4H5.2z') + line('M12 8.6v12M12 8.6c-1.4-3.6-5.6-4.4-5.6-1.8 0 1.4 2.4 1.8 5.6 1.8zM12 8.6c1.4-3.6 5.6-4.4 5.6-1.8 0 1.4-2.4 1.8-5.6 1.8z'),
  lock: solid('M5.6 10.6h12.8v9.8H5.6z') + line('M8.4 10.6V7.8a3.6 3.6 0 0 1 7.2 0v2.8'),
};

export const GLYPH_NAMES = Object.keys(G);

// SVG markup for a glyph (a trusted, fixed string — never user content).
export function glyphSvg(name, size = 24) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${G[name] || G.spark}</svg>`;
}

export function Glyph({ name, size = 20, className = '', title }) {
  return (
    <span
      className={`glyph g-${name} ${className}`}
      style={{ width: size, height: size }}
      title={title}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      // The markup comes from the fixed table above, not from any user.
      dangerouslySetInnerHTML={{ __html: glyphSvg(name, size) }}
    />
  );
}

// A badge as a medallion: the glyph on a lime coin with a ring.
export function Medallion({ name, size = 44, locked = false }) {
  return (
    <span className={`medallion${locked ? ' locked' : ''}`} style={{ width: size, height: size }}>
      <Glyph name={locked ? 'lock' : name} size={Math.round(size * 0.56)} />
    </span>
  );
}
