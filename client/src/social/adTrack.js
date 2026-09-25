// ============================================================
//  RentalFlow  |  Business  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: counting ad views and clicks
// ============================================================
// A sponsored post counts as viewed once at least half of it has been on
// screen for a full second; the server counts each person once a day.
import { getToken } from '../api.js';

function viewerId() {
  try {
    const t = getToken();
    if (t) return `u${JSON.parse(atob(t.split('.')[1])).id}`;
    let id = localStorage.getItem('rentalflow_viewer');
    if (!id) { id = `a${Math.random().toString(36).slice(2, 12)}`; localStorage.setItem('rentalflow_viewer', id); }
    return id;
  } catch { return `a${Math.random().toString(36).slice(2, 12)}`; }
}

const sent = new Set();
export function adEvent(campaignId, kind) {
  const key = `${campaignId}:${kind}`;
  if (sent.has(key)) return;
  sent.add(key);
  fetch(`/api/market/ads/${campaignId}/event`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
    body: JSON.stringify({ kind, viewer: viewerId() }),
  }).catch(() => {});
}

export function watchAd(el, campaignId) {
  if (!el || !campaignId) return () => {};
  let timer = null;
  const io = new IntersectionObserver(([e]) => {
    if (e.intersectionRatio >= 0.5) timer = setTimeout(() => { adEvent(campaignId, 'view'); io.disconnect(); }, 1000);
    else clearTimeout(timer);
  }, { threshold: [0, 0.5, 1] });
  io.observe(el);
  return () => { clearTimeout(timer); io.disconnect(); };
}
