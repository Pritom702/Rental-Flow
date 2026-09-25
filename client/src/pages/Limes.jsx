// ============================================================
//  RentalFlow  |  Business  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: Limes — earn, top up, boost, invite
// ============================================================
// Limes are RentalFlow's credits. You earn them by doing things on the
// platform (coming back, finishing rentals here, inviting friends), buy them
// in packs, and spend them on boosts and ads. They are never cashed out.
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { play } from '../sfx.js';
import { celebrate } from '../fx.js';
import { Glyph } from '../social/glyphs.jsx';
import { setMe } from '../social/store.js';
import { say } from '../social/toast.js';
import { timeAgo } from '../social/util.jsx';
import AdsPanel from '../social/AdsPanel.jsx';

const EARN_COPY = {
  daily: ['sprout', 'Come back each day'],
  streak_week: ['flame', 'Every 7-day streak'],
  first_listing: ['rent', 'List your first item'],
  rental_completed: ['key', 'Finish a rental on RentalFlow (both of you)'],
  sale_completed: ['coin', 'Agree a sale on RentalFlow (both of you)'],
  referral: ['people', 'A friend joins with your invite'],
  report_offplatform: ['shield', 'Report a request to pay outside'],
};
const REASON = {
  daily: 'Daily check-in', streak: 'Streak bonus', first_listing: 'First listing', rental_completed: 'Rental finished',
  sale_completed: 'Sale agreed', referral: 'Invite joined', referral_welcome: 'Welcome bonus', report: 'Report',
  purchase: 'Top-up', boost: 'Boost', ad_budget: 'Ad budget', ad_refund: 'Ad refund',
};

export default function Limes() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [w, setW] = useState(null);
  const [buying, setBuying] = useState('');

  const load = useCallback(() => api.get('/market/limes').then((d) => {
    setW(d);
    setMe((m) => (m ? { ...m, limes: d.balance } : m));
  }).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  // Back from a payment.
  useEffect(() => {
    const paid = params.get('paid');
    if (paid == null) return;
    if (paid === '1') { celebrate(); say('Limes added — thank you!', 'lime'); } else say('The payment did not go through', 'warn');
    params.delete('paid');
    setParams(params, { replace: true });
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function buy(pack) {
    setBuying(pack);
    try {
      const o = await api.post('/market/orders', { pack });
      if (o.redirect) window.location.assign(o.redirect);
      else window.location.assign(o.checkout);
    } catch (e) {
      say(e.message, 'warn');
      setBuying('');
    }
  }

  async function copyInvite() {
    const link = `${window.location.origin}/join/${w.referralCode}`;
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ title: 'Join me on RentalFlow', url: link });
      else { await navigator.clipboard.writeText(link); say('Invite link copied', 'link'); }
      play('pop');
    } catch { /* cancelled */ }
  }

  if (!w) return <div className="container"><div className="page-loading" /></div>;
  return (
    <div className="container limes-page">
      <section className="limes-hero">
        <div className="lh-coin"><Glyph name="lime" size={64} /></div>
        <div className="lh-main">
          <span className="lh-kicker">Your Limes</span>
          <b className="lh-balance">{w.balance.toLocaleString()}</b>
          <span className="lh-sub">{w.earned} earned · {w.bought} bought · {w.spent} spent</span>
        </div>
        <div className="lh-actions">
          <a href="#packs" className="btn accent"><Glyph name="plus" size={16} /> Top up</a>
          <Link to="/studio" className="btn secondary"><Glyph name="clapper" size={16} /> Make an ad</Link>
        </div>
      </section>

      <div className="limes-grid">
        <section className="limes-card">
          <h2><Glyph name="sparkle" size={20} /> Earn Limes free</h2>
          <ul className="earn-list">
            {Object.entries(EARN_COPY).map(([k, [g, text]]) => (
              <li key={k}><span className="earn-ic"><Glyph name={g} size={18} /></span>{text}<b>+{w.earn[k]}</b></li>
            ))}
          </ul>
          <div className="invite">
            <div><b>Invite a friend</b><span>You get {w.earn.referral} Limes, they get {w.earn.referral_welcome}.</span></div>
            <button type="button" className="btn small" onClick={copyInvite}><Glyph name="link" size={14} /> Copy invite link</button>
          </div>
        </section>

        <section className="limes-card">
          <h2><Glyph name="rocket" size={20} /> Spend them</h2>
          <ul className="earn-list spend">
            <li><span className="earn-ic"><Glyph name="rocket" size={18} /></span>Boost a post to the top of feeds, 24 h<b>{w.prices.boost_post}</b></li>
            <li><span className="earn-ic"><Glyph name="star" size={18} /></span>Feature a listing on Browse, 24 h<b>{w.prices.boost_item}</b></li>
            <li><span className="earn-ic"><Glyph name="wanted" size={18} /></span>Highlight a "wanted" request, 24 h<b>{w.prices.boost_wanted}</b></li>
            <li><span className="earn-ic"><Glyph name="megaphone" size={18} /></span>Run your video as an ad — 10 views per Lime<b>from 20</b></li>
          </ul>
          {w.boosts.length > 0 && (
            <div className="live-boosts">
              <b>Live now</b>
              {w.boosts.map((b) => (
                <span key={`${b.kind}${b.target_id}`}><Glyph name={b.kind === 'item' ? 'star' : 'rocket'} size={14} /> {b.title || (b.kind === 'item' ? 'Listing' : 'Post')} · ends {timeAgo(b.ends_at).replace(/^(\d)/, 'in $1')}</span>
              ))}
            </div>
          )}
          <p className="muted small">Boost from the ⋯ menu on your post, or from your listing's page.</p>
        </section>
      </div>

      <section id="packs" className="packs">
        <h2>Top up</h2>
        {w.gateway === 'test' && (
          <div className="test-banner"><Glyph name="warn" size={16} /> Test mode — no real money moves. Connect the SSLCommerz store to take bKash, Nagad and card payments.</div>
        )}
        <div className="pack-row">
          {Object.entries(w.packs).map(([k, p]) => (
            <button type="button" key={k} className={`pack${p.best ? ' best' : ''}`} onClick={() => buy(k)} disabled={Boolean(buying)}>
              {p.best && <em>Best value</em>}
              <Glyph name="lime" size={40} />
              <b className="pack-credits">{p.credits.toLocaleString()}</b>
              <span className="pack-label">{p.label} · Limes</span>
              <span className="pack-price">৳{p.bdt}</span>
              <span className="pack-rate">{(p.credits / p.bdt).toFixed(2)} per taka</span>
              <span className="btn accent block">{buying === k ? 'Opening…' : 'Buy'}</span>
            </button>
          ))}
        </div>
      </section>

      <AdsPanel />

      <section className="limes-card history">
        <h2>History</h2>
        {w.history.length === 0 ? <p className="muted">Nothing yet — your first Limes arrive with your daily check-in.</p> : (
          <ul>
            {w.history.map((h, i) => (
              <li key={i}>
                <span>{REASON[h.reason] || h.reason}{h.note && <small>{h.note}</small>}</span>
                <b className={h.delta > 0 ? 'plus' : 'minus'}>{h.delta > 0 ? '+' : ''}{h.delta}</b>
                <em>{timeAgo(h.created_at)}</em>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="muted small">Limes are for use on RentalFlow only and can't be exchanged for cash. {user?.role === 'admin' && <Link to="/admin/revenue">Revenue dashboard ›</Link>}</p>
    </div>
  );
}
