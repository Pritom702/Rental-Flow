// ============================================================
//  RentalFlow  |  Design system  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: pop-ups drawn over the whole page
// ============================================================
// A full-screen pop-up (photo viewer, dialog, sheet) must cover the whole
// screen. If it is drawn inside a card that is moved with a CSS transform —
// our cards lift a little on hover — the browser pins "position: fixed" to that
// card instead of the screen, and the pop-up ends up cropped inside it.
// Drawing pop-ups at the end of <body> avoids that everywhere.
import { createPortal } from 'react-dom';

export default function Portal({ children }) {
  if (typeof document === 'undefined') return children;
  // Clicks inside the pop-up must not also reach the card that opened it
  // (React passes portal events up to the component that rendered them).
  return createPortal(<div className="portal-root" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>{children}</div>, document.body);
}
