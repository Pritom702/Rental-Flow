// ============================================================
//  RentalFlow  |  Business  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: admin revenue dashboard
// ============================================================
// Where RentalFlow's money comes from: rental fees and damage protection,
// the fee on sales agreed in chat, Limes sold, and what Limes pay for (boosts
// and ads). Plus the people who keep trying to take deals off the platform.
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { money } from '../money.js';
import { Glyph } from '../social/glyphs.jsx';

export default function Revenue() {
  const [r, setR] = useState(null);
  useEffect(() => { api.get('/market/admin/revenue').then(setR).catch(() => setR(false)); }, []);
  if (r === false) return <div className="container"><div className="error">Could not load revenue.</div></div>;
  if (!r) return <div className="container"><div className="page-loading" /></div>;

  const max = Math.max(1, ...r.daily.map((d) => d.rentals + d.limes + d.sales));
  const limesValue = Math.round((r.ads.spent + r.boosts.credits) * r.bdtPerLime);
  const tiles = [
    { g: 'coin', label: 'Earned so far', value: money(r.totals.earned), hint: 'Fees on finished rentals + protection + sale fees + Limes sold' },
    { g: 'ticket', label: 'In the pipeline', value: money(r.totals.pipeline), hint: `Fees on ${r.bookings.pipeline.n} bookings not finished yet` },
    { g: 'rent', label: 'Rentals finished', value: r.bookings.completed.n, hint: `${money(r.bookings.completed.gmv)} rented through RentalFlow` },
    { g: 'sell', label: 'Sales agreed', value: r.sales.n, hint: `${money(r.sales.gmv)} sold · ${money(r.sales.fees)} in fees` },
    { g: 'lime', label: 'Limes sold', value: money(r.limes.bdt), hint: `${r.limes.orders} orders · ${r.limes.credits.toLocaleString()} Limes` },
    { g: 'megaphone', label: 'Ads + boosts', value: `${(r.ads.spent + r.boosts.credits).toLocaleString()} Limes`, hint: `≈ ${money(limesValue)} of paid attention` },
  ];
  return (
    <div className="container revenue">
      <div className="page-head"><div><h1>Revenue</h1><div className="sub">How RentalFlow earns — every number comes from the live database.</div></div></div>
      <div className="rev-tiles">
        {tiles.map((t) => (
          <div key={t.label} className="rev-tile">
            <span className="rev-ic"><Glyph name={t.g} size={22} /></span>
            <span className="rev-label">{t.label}</span>
            <b className="rev-value">{t.value}</b>
            <span className="rev-hint">{t.hint}</span>
          </div>
        ))}
      </div>

      <section className="rev-card">
        <h2>Last 30 days</h2>
        <div className="rev-legend"><span className="k-r">Rental fees</span><span className="k-l">Limes sold</span><span className="k-s">Sale fees</span></div>
        <div className="rev-chart" role="img" aria-label="Revenue per day for the last 30 days">
          {r.daily.map((d) => (
            <div key={d.day} className="rev-day" title={`${d.day}: rentals ${money(d.rentals)}, Limes ${money(d.limes)}, sales ${money(d.sales)}`}>
              <i className="k-s" style={{ height: `${(d.sales / max) * 100}%` }} />
              <i className="k-l" style={{ height: `${(d.limes / max) * 100}%` }} />
              <i className="k-r" style={{ height: `${(d.rentals / max) * 100}%` }} />
            </div>
          ))}
        </div>
      </section>

      <div className="rev-two">
        <section className="rev-card">
          <h2>Ads</h2>
          <dl className="rev-dl">
            <div><dt>Campaigns</dt><dd>{r.ads.campaigns}</dd></div>
            <div><dt>Views</dt><dd>{r.ads.views.toLocaleString()}</dd></div>
            <div><dt>Clicks</dt><dd>{r.ads.clicks.toLocaleString()}</dd></div>
            <div><dt>Click rate</dt><dd>{r.ads.views ? ((r.ads.clicks / r.ads.views) * 100).toFixed(1) : '0.0'}%</dd></div>
            <div><dt>Limes spent</dt><dd>{r.ads.spent.toLocaleString()}</dd></div>
            <div><dt>Boosts bought</dt><dd>{r.boosts.n}</dd></div>
          </dl>
        </section>
        <section className="rev-card">
          <h2>Keeping deals on RentalFlow</h2>
          <p className="muted small">Each time someone shares a number or suggests paying outside before a deal is on the platform, it is hidden and counted.</p>
          <dl className="rev-dl"><div><dt>Members flagged</dt><dd>{r.leak.members}</dd></div><div><dt>Attempts caught</dt><dd>{r.leak.flags}</dd></div></dl>
          {r.flagged.length > 0 && (
            <ul className="rev-flagged">{r.flagged.map((u) => <li key={u.id}><b>{u.name}</b><span>{u.email}</span><em>{u.offplatform_flags}</em></li>)}</ul>
          )}
        </section>
      </div>
    </div>
  );
}
