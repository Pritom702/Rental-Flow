// ============================================================
//  RentalFlow  |  Design system  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: little moments of delight
// ============================================================
//   ripples     a soft ring spreads from wherever a button is pressed
//   celebrate() the success chime plus a short burst of confetti
//   magnetic    (mouse only) main buttons lean towards the pointer
// All of it is skipped for people who ask their device to reduce motion.
import { play } from './sfx.js';

const calm = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

export function installRipples() {
  document.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || calm()) return;
    const btn = e.target.closest('.btn, .theme-toggle, .orbit-caption button');
    if (!btn || btn.disabled) return;
    const r = btn.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2.2;
    const dot = document.createElement('span');
    dot.className = 'ripple';
    dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    btn.appendChild(dot);
    dot.addEventListener('animationend', () => dot.remove(), { once: true });
  }, { capture: true, passive: true });
}

// Confetti: ~60 small pieces thrown up from the middle of the screen, drawn on
// a throwaway canvas that removes itself after about 1.6 seconds.
const COLOURS = ['#C6F24E', '#10291D', '#F5F1E8', '#9ACD2B', '#2F7D4F'];
function confetti() {
  const canvas = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth; const h = window.innerHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  canvas.className = 'confetti';
  document.body.appendChild(canvas);
  const g = canvas.getContext('2d');
  g.scale(dpr, dpr);
  const bits = Array.from({ length: 60 }, () => ({
    x: w / 2 + (Math.random() - 0.5) * 80,
    y: h * 0.62,
    vx: (Math.random() - 0.5) * 13,
    vy: -9 - Math.random() * 9,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.4,
    s: 5 + Math.random() * 6,
    c: COLOURS[Math.floor(Math.random() * COLOURS.length)],
  }));
  const start = performance.now();
  const draw = (now) => {
    const t = now - start;
    g.clearRect(0, 0, w, h);
    g.globalAlpha = Math.max(0, 1 - Math.max(0, t - 1000) / 600);
    bits.forEach((b) => {
      b.vy += 0.42; b.vx *= 0.985; b.x += b.vx; b.y += b.vy; b.r += b.vr;
      g.save(); g.translate(b.x, b.y); g.rotate(b.r);
      g.fillStyle = b.c; g.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2);
      g.restore();
    });
    if (t < 1600) requestAnimationFrame(draw); else canvas.remove();
  };
  requestAnimationFrame(draw);
}

export function celebrate() {
  play('success');
  if (!calm()) confetti();
}

const finePointer = () => {
  try { return window.matchMedia('(hover: hover) and (pointer: fine)').matches; } catch { return false; }
};

const MAGNETIC = '.btn.lg, .search-pill .btn, .orbit-caption button, .cta-band-x .btn, .pubnav .btn';
export function installMagnetic() {
  if (!finePointer() || calm()) return;
  let current = null;
  const release = () => { if (current) { current.style.translate = ''; current = null; } };
  document.addEventListener('pointermove', (e) => {
    const el = e.target.closest?.(MAGNETIC);
    if (el !== current) release();
    if (!el || el.disabled) return;
    current = el;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    el.style.translate = `${(dx * 0.22).toFixed(1)}px ${(dy * 0.3).toFixed(1)}px`;
  }, { passive: true });
  document.addEventListener('pointerout', (e) => { if (current && !current.contains(e.relatedTarget)) release(); }, { passive: true });
}
