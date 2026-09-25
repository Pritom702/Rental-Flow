// ============================================================
//  RentalFlow  |  Marketplace  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: RentalFlow Pay — the DEMO checkout page
// ============================================================
// Where Buy now and booking requests pay. It is a demo and says so on the
// page: no real money moves, and it does not copy any payment brand's look.
// Choose bKash, Nagad, Rocket or a card, type demo details, pay — and get a
// receipt. The server does what a real payment would (routes/payments.js).
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { money } from '../money.js';
import { play } from '../sfx.js';
import { celebrate } from '../fx.js';
import { Glyph } from '../social/glyphs.jsx';
import { Icon } from '../icons.jsx';

const METHODS = [
  { id: 'bkash', label: 'bKash', kind: 'wallet' },
  { id: 'nagad', label: 'Nagad', kind: 'wallet' },
  { id: 'rocket', label: 'Rocket', kind: 'wallet' },
  { id: 'card', label: 'Card', kind: 'card' },
];
const dateOf = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export default function Pay() {
  const { tran } = useParams();
  const navigate = useNavigate();
  const [p, setP] = useState(null);
  const [error, setError] = useState('');
  const [method, setMethod] = useState('bkash');
  const [account, setAccount] = useState('');
  const [pin, setPin] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => { api.get(`/payments/${tran}`).then(setP).catch((e) => setError(e.message)); }, [tran]);

  const m = METHODS.find((x) => x.id === method);
  const digits = account.replace(/\D/g, '');
  const ready = m.kind === 'card'
    ? digits.length >= 12 && /^\d{2}\/\d{2}$/.test(expiry) && /^\d{3,4}$/.test(cvc)
    : /^01[3-9]\d{8}$/.test(digits) && /^\d{4,5}$/.test(pin);

  async function pay(outcome = 'paid') {
    setFormError('');
    setBusy(true);
    try {
      // a moment of "talking to the provider", as a real checkout would take
      if (outcome === 'paid') await new Promise((r) => setTimeout(r, 1400));
      const r = await api.post(`/payments/${tran}/complete`, { method, account: digits, outcome });
      setP((x) => ({ ...x, ...r }));
      if (r.status === 'paid') { play('success'); celebrate(); }
    } catch (e) { setFormError(e.message); }
    setBusy(false);
  }

  if (error) return <div className="pay-page"><div className="pay-card"><p className="error">{error}</p><Link to="/feed">Back to RentalFlow</Link></div></div>;
  if (!p) return <div className="pay-page"><div className="page-loading" /></div>;
  const a = p.about || {};

  return (
    <div className="pay-page">
      <div className="pay-card">
        <div className="pay-head">
          <span className="pay-brand"><img src="/brand/logo-tile.svg" alt="" width="30" height="30" /> RentalFlow <b>Pay</b></span>
          <span className="pay-demo">DEMO · no real money</span>
        </div>

        <div className="pay-what">
          {a.image ? <img src={a.image} alt="" /> : <span className="pay-what-ph"><Glyph name={p.purpose === 'sale' ? 'sell' : 'rent'} size={26} /></span>}
          <div>
            <b translate="no">{a.title}</b>
            <span className="muted small">
              {p.purpose === 'sale' ? 'Buying from ' : 'Renting from '}<span translate="no">{a.to}</span>
              {a.dates && ` · ${dateOf(a.dates[0])} – ${dateOf(a.dates[1])}`}
            </span>
          </div>
        </div>

        <div className="pay-lines">
          {(p.breakdown || []).map((l) => <div key={l.label}><span>{l.label}</span><span>{money(l.amount)}</span></div>)}
          <div className="pay-total"><span>Total</span><b>{money(p.amount)}</b></div>
          {p.purpose === 'booking' && <p className="muted small">The deposit comes back when the item is returned safely. If the owner turns the request down, everything is refunded.</p>}
          {p.purpose === 'sale' && <p className="muted small">RentalFlow holds the money until you have the item — you are covered if it never arrives.</p>}
        </div>

        {p.status === 'paid' ? (
          <div className="pay-done">
            <span className="pay-tick"><Icon name="check" size={34} /></span>
            <h2>Payment successful</h2>
            <div className="pay-receipt">
              <div><span>Amount</span><b>{money(p.amount)}</b></div>
              <div><span>Paid with</span><b>{METHODS.find((x) => x.id === p.method)?.label} {p.account}</b></div>
              <div><span>Transaction</span><b className="mono">{p.tran_id}</b></div>
              <div><span>Date</span><b>{new Date(p.paid_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</b></div>
            </div>
            <button type="button" className="btn accent lg block" onClick={() => navigate(a.done)}>{a.doneLabel}</button>
          </div>
        ) : p.status !== 'pending' ? (
          <div className="pay-done">
            <h2>{p.status === 'refunded' ? 'Refunded' : 'Payment not completed'}</h2>
            <p className="muted">{p.status === 'refunded' ? 'This payment was refunded.' : 'Nothing was charged. You can try again.'}</p>
            <button type="button" className="btn secondary block" onClick={() => navigate(a.done)}>{a.doneLabel}</button>
          </div>
        ) : (
          <form className="pay-form" onSubmit={(e) => { e.preventDefault(); if (ready && !busy) pay(); }}>
            <div className="pay-methods" role="radiogroup" aria-label="Pay with">
              {METHODS.map((x) => (
                <button type="button" key={x.id} role="radio" aria-checked={method === x.id} className={`pay-method${method === x.id ? ' on' : ''}`}
                  onClick={() => { setMethod(x.id); setFormError(''); }} disabled={busy}>
                  <Glyph name={x.kind === 'card' ? 'ticket' : 'coin'} size={18} />{x.label}
                </button>
              ))}
            </div>
            {m.kind === 'wallet' ? (
              <>
                <label>{`${m.label} account number`}</label>
                <input inputMode="numeric" autoComplete="off" placeholder="01XXXXXXXXX" value={account} maxLength={14} onChange={(e) => setAccount(e.target.value)} disabled={busy} />
                <label>PIN <span className="muted">(demo — any 4 or 5 digits)</span></label>
                <input type="password" inputMode="numeric" autoComplete="off" placeholder="••••" value={pin} maxLength={5} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} disabled={busy} />
              </>
            ) : (
              <>
                <label>Card number <span className="muted">(demo — e.g. 4242 4242 4242 4242)</span></label>
                <input inputMode="numeric" autoComplete="off" placeholder="4242 4242 4242 4242" value={account} maxLength={23}
                  onChange={(e) => setAccount(e.target.value.replace(/[^\d ]/g, ''))} disabled={busy} />
                <div className="pay-row">
                  <div><label>Expiry</label><input inputMode="numeric" placeholder="MM/YY" value={expiry} maxLength={5}
                    onChange={(e) => { const d = e.target.value.replace(/\D/g, '').slice(0, 4); setExpiry(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d); }} disabled={busy} /></div>
                  <div><label>CVC</label><input type="password" inputMode="numeric" placeholder="123" value={cvc} maxLength={4} onChange={(e) => setCvc(e.target.value.replace(/\D/g, ''))} disabled={busy} /></div>
                </div>
              </>
            )}
            {formError && <div className="error">{formError}</div>}
            <button className="btn accent lg block pay-go" disabled={!ready || busy}>
              {busy ? <><span className="pay-spin" /> {`Paying with ${m.label}…`}</> : `Pay ${money(p.amount)}`}
            </button>
            <div className="pay-foot">
              <button type="button" className="linklike" disabled={busy} onClick={() => pay('cancelled').then(() => navigate(a.done))}>Cancel</button>
              <button type="button" className="linklike muted" disabled={busy} onClick={() => pay('failed')}>Try a failed payment</button>
            </div>
            <p className="muted small pay-note">This is a demo of how paying on RentalFlow works. Nothing is charged and your details are not stored — only the last digits appear on the receipt.</p>
          </form>
        )}
      </div>
    </div>
  );
}
