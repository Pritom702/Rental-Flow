// ============================================================
//  RentalFlow  |  Sprint 1  |  Owner: M4 - Radowanul Haque (Radowan)
//  GitHub: @___  |  Part: Inline SVG icon set
// ============================================================
// Original inline SVG icons, hand-written for RentalFlow (stroke style, 1.75px).
// Kept in one place so sizing/stroke stay consistent. Not copied from any kit.
export function Icon({ name, size = 20, className = '' }) {
  const p = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round',
    strokeLinejoin: 'round', className, 'aria-hidden': true,
  };
  switch (name) {
    case 'search':
      return <svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>;
    case 'package':
      return <svg {...p}><path d="M12 2 3 7v10l9 5 9-5V7z" /><path d="M3 7l9 5 9-5" /><path d="M12 12v10" /></svg>;
    case 'shield':
      return <svg {...p}><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /><path d="m9 12 2 2 4-4" /></svg>;
    case 'bolt':
      return <svg {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg>;
    case 'plus':
      return <svg {...p}><path d="M12 5v14M5 12h14" /></svg>;
    case 'tag':
      return <svg {...p}><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" /><circle cx="7.5" cy="7.5" r="1.4" /></svg>;
    case 'calendar':
      return <svg {...p}><rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M3 9h18M8 2.5v4M16 2.5v4" /></svg>;
    case 'arrow-right':
      return <svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
    case 'camera':
      return <svg {...p}><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.2" /></svg>;
    case 'tool':
      return <svg {...p}><path d="M14.5 6.5a3.5 3.5 0 0 0 4.6 4.6L21 13l-8 8-2-2 1.9-1.9a3.5 3.5 0 0 0-4.6-4.6L3 6l3-3 8.5 3.5z" /></svg>;
    case 'sparkles':
      return <svg {...p}><path d="M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15l-1.8-4.2L5.5 9l4.7-1.3z" /><path d="M19 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" /></svg>;
    case 'user':
      return <svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" /></svg>;
    case 'logout':
      return <svg {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></svg>;
    case 'grid':
      return <svg {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>;
    case 'wallet':
      return <svg {...p}><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18" /><circle cx="16.5" cy="14" r="1.3" /></svg>;
    case 'refresh':
      return <svg {...p}><path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v4h-4" /></svg>;
    case 'check':
      return <svg {...p}><path d="m5 12 4 4L19 6" /></svg>;
    default:
      return null;
  }
}

// Map a category name to a fitting icon (best-effort by keyword).
export function categoryIcon(name = '') {
  const n = name.toLowerCase();
  if (n.includes('camera')) return 'camera';
  if (n.includes('lens')) return 'camera';
  if (n.includes('tool')) return 'tool';
  if (n.includes('light')) return 'bolt';
  if (n.includes('audio') || n.includes('mic')) return 'sparkles';
  if (n.includes('drone')) return 'bolt';
  if (n.includes('event') || n.includes('party')) return 'sparkles';
  if (n.includes('computer') || n.includes('laptop')) return 'grid';
  if (n.includes('game') || n.includes('console')) return 'grid';
  if (n.includes('music')) return 'sparkles';
  if (n.includes('garden')) return 'tool';
  return 'package';
}
