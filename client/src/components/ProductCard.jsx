// ============================================================
//  RentalFlow  |  Marketplace  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: product card with a description preview
// ============================================================
// A listing in the marketplace grid.
//   Computer: rest the mouse on a card  → the product lifts up and shrinks
//                                          back, and a short description
//                                          rises into the space beneath it.
//   Phone:    press and hold a card     → the same reveal.
//   Both:     click / tap               → the product page with everything.
// Buttons inside the card (Request Booking) keep doing their own job.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusBadge, TagList, CardPhoto } from '../components.jsx';
import { morph, transitionTo } from '../transitions.js';
import { money } from '../money.js';

const HOVER_DELAY_MS = 350;
const HOLD_MS = 450;
const MOVE_TOLERANCE_PX = 10;   // a finger that moves this far is scrolling, not holding
const SHORT_CHARS = 140;

// First sentence, or the first ~140 characters cut at a word.
export function shortDescription(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return 'No description yet.';
  const sentence = /^(.{20,}?[.!?])\s/.exec(t);
  if (sentence && sentence[1].length <= SHORT_CHARS) return sentence[1];
  if (t.length <= SHORT_CHARS) return t;
  return `${t.slice(0, t.lastIndexOf(' ', SHORT_CHARS) > 60 ? t.lastIndexOf(' ', SHORT_CHARS) : SHORT_CHARS)}…`;
}

const canHover = () => {
  try { return window.matchMedia('(hover: hover) and (pointer: fine)').matches; } catch { return true; }
};

export default function ProductCard({ item, children }) {
  const navigate = useNavigate();
  const [preview, setPreview] = useState(false);
  const hoverTimer = useRef(null);
  const holdTimer = useRef(null);
  const start = useRef(null);
  const held = useRef(false);

  useEffect(() => () => { clearTimeout(hoverTimer.current); clearTimeout(holdTimer.current); }, []);

  // 3D tilt that follows the mouse (desktop only): the card leans towards the pointer.
  const cardRef = useRef(null);
  function tilt(e) {
    if (!canHover()) return;
    const el = cardRef.current;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--ry', `${(x * 10).toFixed(2)}deg`);
    el.style.setProperty('--rx', `${(-y * 10).toFixed(2)}deg`);
  }
  function untilt() {
    const el = cardRef.current;
    el?.style.setProperty('--rx', '0deg');
    el?.style.setProperty('--ry', '0deg');
  }

  // A preview opened by holding stays until the next touch anywhere.
  useEffect(() => {
    if (!preview || !held.current) return undefined;
    const close = () => { setPreview(false); held.current = false; };
    const t = setTimeout(() => document.addEventListener('touchstart', close, { once: true }), 0);
    return () => { clearTimeout(t); document.removeEventListener('touchstart', close); };
  }, [preview]);

  function open(e) {
    if (held.current) return;                             // that tap ended a long-press
    if (e.target.closest('button, a, input, select')) return;   // inner controls
    // the photo flies from this card into the product page
    cardRef.current?.querySelector('.card-photo')?.style.setProperty('view-transition-name', 'product-photo');
    transitionTo(navigate, `/product/${item.id}`, { morphId: item.id, waitFor: '.product-main-photo', state: { preview: item } });
  }

  return (
    <div
      ref={cardRef}
      onPointerMove={tilt}
      className={`card product-card${preview ? ' previewing' : ''}`}
      // coming back from this product's page: its photo flies back into this card
      style={morph.id === item.id ? { '--vt-photo': 'product-photo' } : undefined}
      role="link"
      tabIndex={0}
      aria-label={`${item.name} — open details`}
      onClick={open}
      onKeyDown={(e) => { if (e.key === 'Enter') open(e); }}
      onMouseEnter={() => {
        if (!canHover()) return;
        hoverTimer.current = setTimeout(() => setPreview(true), HOVER_DELAY_MS);
      }}
      onMouseLeave={() => { clearTimeout(hoverTimer.current); untilt(); if (!held.current) setPreview(false); }}
      onFocus={(e) => { if (e.target.matches(':focus-visible')) setPreview(true); }}   // keyboard users
      onBlur={() => setPreview(false)}
      onTouchStart={(e) => {
        const t = e.touches[0];
        start.current = { x: t.clientX, y: t.clientY };
        held.current = false;
        holdTimer.current = setTimeout(() => {
          held.current = true;
          setPreview(true);
          if (navigator.vibrate) navigator.vibrate(15);
        }, HOLD_MS);
      }}
      onTouchMove={(e) => {
        const t = e.touches[0];
        if (start.current && Math.hypot(t.clientX - start.current.x, t.clientY - start.current.y) > MOVE_TOLERANCE_PX) {
          clearTimeout(holdTimer.current);
        }
      }}
      onTouchEnd={(e) => {
        clearTimeout(holdTimer.current);
        // A long-press must not also count as a tap that opens the page.
        if (held.current) e.preventDefault();
      }}
      onContextMenu={(e) => { if (held.current || !canHover()) e.preventDefault(); }}
    >
      <CardPhoto url={item.cover_url} count={item.image_count}>
        {preview && (
          <div className="product-preview" role="tooltip">
            <p>{shortDescription(item.description)}</p>
            <span className="product-preview-hint">{canHover() ? 'Click for full details' : 'Tap for full details'} →</span>
          </div>
        )}
      </CardPhoto>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <h3>{item.name}</h3>
        <StatusBadge status={item.status} />
      </div>
      <div className="serial">Listed by <b>{item.owner_name || 'Unknown'}</b></div>
      <TagList tags={item.tags} />
      <div className="price" style={{ marginTop: 12 }}>
        {money(item.rental_price)} <span>/ day</span>
      </div>
      {children}
    </div>
  );
}
