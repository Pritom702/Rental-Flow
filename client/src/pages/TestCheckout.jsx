// ============================================================
//  RentalFlow  |  Business  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: the TEST checkout for Limes
// ============================================================
// Stands in for the payment gateway until the SSLCommerz store is connected.
// It says plainly that it is a test and that no money moves — it is not made
// to look like any real payment brand.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { Glyph } from '../social/glyphs.jsx';

export default function TestCheckout() {
  const { tran } = useParams();
  const navigate = useNavigate();
  const [o, setO] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { api.get(`/market/orders/${tran}`).then(setO).catch((e) => setError(e.message)); }, [tran]);

  async function answer(outcome) {
    setBusy(true);
    try {
      const r = await api.post(`/market/orders/${tran}/test-pay`, { outcome });
      navigate(`/limes?paid=${r.status === 'paid' ? 1 : 0}`, { replace: true });
    } catch (e) { setError(e.message); setBusy(false); }
  }

  if (error) return <div className="container"><div className="error">{error}</div><Link to="/limes">Back to Limes</Link></div>;
  if (!o) return <div className="container"><div className="page-loading" /></div>;
  return (
    <div className="container checkout-test">
      <div className="ct-card">
        <div className="ct-flag">TEST MODE · no real money</div>
        <Glyph name="lime" size={56} />
        <h1>{o.credits.toLocaleString()} Limes</h1>
        <div className="ct-amount">৳{o.amount_bdt}</div>
        <div className="muted small">Order {o.tran_id}</div>
        {o.status === 'pending' ? (
          <div className="ct-actions">
            <button type="button" className="btn accent lg block" disabled={busy} onClick={() => answer('paid')}>Simulate a successful payment</button>
            <button type="button" className="btn secondary block" disabled={busy} onClick={() => answer('cancel')}>Cancel</button>
          </div>
        ) : <p>This order is <b>{o.status}</b>. <Link to="/limes">Back to Limes</Link></p>}
        <p className="muted small">When the SSLCommerz store is connected, this step is the real bKash / Nagad / card payment page.</p>
      </div>
    </div>
  );
}
