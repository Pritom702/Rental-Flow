// ============================================================
//  RentalFlow  |  Business  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: promoting posts — the ad dialog and my campaigns
// ============================================================
// Any member can promote their own post (a studio video works best). The
// budget is paid in Limes up front; every 10 views use one Lime, each person is
// counted once a day, and stopping a campaign returns what is left.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { play } from '../sfx.js';
import { celebrate } from '../fx.js';
import { Glyph } from './glyphs.jsx';
import { setMe } from './store.js';
import { say } from './toast.js';

const BUDGETS = [20, 50, 100, 250];

export function PromoteDialog({ post, onClose }) {
  const [budget, setBudget] = useState(50);
  const [headline, setHeadline] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function go() {
    setBusy(true);
    setError('');
    try {
      const a = await api.post('/market/ads', { post_id: post.id, budget, headline });
      setMe((m) => (m ? { ...m, limes: a.balance } : m));
      celebrate();
      say(`Your ad is live — about ${budget * 10} views`, 'megaphone');
      onClose(true);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop" onClick={() => onClose(false)}>
      <div className="modal narrow promote" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Promote this post">
        <div className="promote-head"><span className="sg-badge"><Glyph name="megaphone" size={28} /></span><div><h2>Promote this post</h2><p className="muted">It shows between posts in the feed{post.attachments?.some((a) => a.type === 'video') ? ' and between videos in Flows' : ''}, marked Sponsored.</p></div></div>
        <label className="promote-label">Budget</label>
        <div className="budget-row">
          {BUDGETS.map((b) => (
            <button type="button" key={b} className={`budget${b === budget ? ' on' : ''}`} onClick={() => { setBudget(b); play('pop'); }} data-sfx="none">
              <b><Glyph name="lime" size={16} />{b}</b><small>≈ {(b * 10).toLocaleString()} views</small>
            </button>
          ))}
        </div>
        <label className="promote-label">Headline <span className="muted">(optional)</span></label>
        <input className="promote-input" maxLength={80} placeholder="e.g. Weekend camera kit — from ৳4,800/day" value={headline} onChange={(e) => setHeadline(e.target.value)} />
        {error && <div className="error">{error}{error.includes('Limes') && <> <Link to="/limes#packs">Top up</Link></>}</div>}
        <div className="card-actions">
          <button type="button" className="btn accent" disabled={busy} onClick={go}><Glyph name="rocket" size={16} /> {busy ? 'Starting…' : `Promote for ${budget} Limes`}</button>
          <button type="button" className="btn secondary" onClick={() => onClose(false)}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function AdsPanel() {
  const [ads, setAds] = useState(null);
  const load = useCallback(() => api.get('/market/ads').then(setAds).catch(() => setAds([])), []);
  useEffect(() => { load(); }, [load]);
  async function act(a, action) {
    try {
      const r = await api.post(`/market/ads/${a.id}/${action}`, {});
      if (r.refunded) say(`${r.refunded} Limes returned`, 'lime');
      load();
    } catch (e) { say(e.message, 'warn'); }
  }
  if (!ads) return null;
  return (
    <section className="limes-card ads-panel">
      <h2><Glyph name="megaphone" size={20} /> My ads</h2>
      {ads.length === 0 ? (
        <p className="muted">No ads yet. Make a video in the <Link to="/studio">Studio</Link> and promote it — every 10 views cost one Lime.</p>
      ) : (
        <div className="ad-list">
          {ads.map((a) => {
            const pct = Math.round((a.spent / Math.max(1, a.budget)) * 100);
            return (
              <div key={a.id} className={`ad-row ${a.status}`}>
                {a.cover ? <img src={a.cover} alt="" /> : <span className="ad-ph"><Glyph name="megaphone" size={20} /></span>}
                <div className="ad-main">
                  <b>{a.headline || a.post_body || 'Your post'}</b>
                  <span>{a.impressions.toLocaleString()} views · {a.clicks} clicks · {a.impressions ? ((a.clicks / a.impressions) * 100).toFixed(1) : '0.0'}% click rate</span>
                  <div className="ad-bar"><i style={{ width: `${pct}%` }} /></div>
                  <small>{a.spent} of {a.budget} Limes used · {a.status}</small>
                </div>
                <div className="ad-actions">
                  {a.status === 'active' && <button type="button" className="btn ghost small" onClick={() => act(a, 'pause')}>Pause</button>}
                  {a.status === 'paused' && <button type="button" className="btn ghost small" onClick={() => act(a, 'resume')}>Resume</button>}
                  {a.status !== 'finished' && <button type="button" className="btn ghost small" onClick={() => act(a, 'stop')}>Stop</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
