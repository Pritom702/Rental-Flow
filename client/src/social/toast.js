// ============================================================
//  RentalFlow  |  Community  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: tiny confirmation toasts
// ============================================================
// say('Link copied', '🔗') — shown by the reward layer, bottom of the screen.
export function say(text, icon = '✓') {
  window.dispatchEvent(new CustomEvent('rf:toast', { detail: { text, icon } }));
}
