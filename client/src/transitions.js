// ============================================================
//  RentalFlow  |  Design system  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: page transitions
// ============================================================
// Moving between pages uses the browser's View Transitions: the old page
// slips away as the new one rises, while the sidebar, top bar and tab bar hold
// still. Opening a product goes further — its photo flies from the card into
// the product page (and back again).
// Browsers without View Transitions, and people who ask for reduced motion,
// get the plain fade-up entrance instead.
import { flushSync } from 'react-dom';

export const morph = { id: null };          // the product whose photo is flying right now

const supported = () => typeof document !== 'undefined' && 'startViewTransition' in document
  && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Resolve once `selector` is on screen (the new page has its content), or after `ms`.
function whenPresent(selector, ms) {
  return new Promise((resolve) => {
    const end = performance.now() + ms;
    // (a timer, not requestAnimationFrame: frames are paused while a transition waits)
    const look = () => (document.querySelector(selector) || performance.now() > end ? resolve() : setTimeout(look, 16));
    look();
  });
}

let running = null;
export function transitionTo(navigate, to, { morphId = null, waitFor = '.page-enter > :not(.page-loading)', state } = {}) {
  if (!supported()) { navigate(to, { state }); return; }
  running?.skipTransition();
  morph.id = morphId;
  const root = document.documentElement;
  root.classList.add('vt-nav');
  running = document.startViewTransition(async () => {
    flushSync(() => navigate(to, { state }));
    await whenPresent(waitFor, 700);
  });
  running.ready.catch(() => {});                   // a skipped transition is not an error
  running.finished.finally(() => {
    root.classList.remove('vt-nav');
    morph.id = null;
    running = null;
  });
}

// Every ordinary click on an in-app link goes through a transition.
export function installLinkTransitions(navigate) {
  const onClick = (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    if (a.matches('.orbit-tile') && (!a.matches('.front') || a.closest('[data-dragged]'))) return;   // the carousel decides
    const url = new URL(a.href, window.location.href);
    if (url.origin !== window.location.origin || url.pathname.startsWith('/api') || url.pathname.startsWith('/uploads')) return;
    const to = url.pathname + url.search + url.hash;
    if (to === window.location.pathname + window.location.search + window.location.hash) return;
    e.preventDefault();
    const product = /^\/product\/(\d+)/.exec(url.pathname);
    const back = product ? null : /^\/browse/.test(url.pathname) && /^\/product\/(\d+)/.exec(window.location.pathname);
    if (product) {                                       // fly the clicked listing's photo in
      (a.matches('.orbit-tile') ? a.querySelector('img') : a.querySelector('.strip-photo, .card-photo'))?.style.setProperty('view-transition-name', 'product-photo');
      transitionTo(navigate, to, { morphId: Number(product[1]), waitFor: '.product-main-photo' });
    } else if (back) {                                   // and back into its card
      transitionTo(navigate, to, { morphId: Number(back[1]), waitFor: '.product-card' });
    } else {
      transitionTo(navigate, to);
    }
  };
  // Capture phase, so this runs before React Router's own link handler (which
  // then sees the event as handled and stays out of the way).
  document.addEventListener('click', onClick, true);
  return () => document.removeEventListener('click', onClick, true);
}
