// ============================================================
//  RentalFlow  |  Community  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: tiny confirmation toasts
// ============================================================
// say('Link copied', 'link') — shown by the reward layer, bottom of the screen.
// `icon` is a glyph name from glyphs.jsx.
export function say(text, icon = 'check') {
  window.dispatchEvent(new CustomEvent('rf:toast', { detail: { text, icon } }));
}
