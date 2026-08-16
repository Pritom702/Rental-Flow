// ============================================================
//  RentalFlow  |  Sprint 3  |  Owner: M2  |  Part: QR scan landing page (F12)
// ============================================================
// A phone camera opens /scan/:token. We resolve the item + its active booking
// and offer check-out / check-in / agreement actions. Lookup is public; the
// actions require a logged-in staff member.
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Icon } from '../icons.jsx';
import { StatusBadge } from '../components.jsx';
import { exportAgreementPdf } from '../pdf.js';

export default function Scan() {
  const { token } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/scan/${token}`).then(setData).catch((e) => setError(e.message));
  }, [token]);

  async function downloadAgreement(id) {
    setBusy(true);
    try {
      await api.post(`/bookings/${id}/agreement`, {});
      const booking = await api.get(`/bookings/${id}/agreement`);
      exportAgreementPdf(booking);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  if (error) return <div className="container"><div className="error"><Icon name="shield" size={16} /> {error}</div></div>;
  if (!data) return <div className="container"><div className="center-empty">Loading…</div></div>;

  const { item, activeBooking } = data;
  const canCheckout = activeBooking && activeBooking.status === 'Approved' && !activeBooking.checked_out_at;
  const canCheckin = activeBooking && activeBooking.checked_out_at && !activeBooking.checked_in_at;

  return (
    <div className="container" style={{ maxWidth: 560 }}>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>{item.name}</h2>
          <StatusBadge status={item.status} />
        </div>
        <div className="serial">{item.serial_number || '—'}</div>
        <div className="price" style={{ marginTop: 10 }}>
          ${Number(item.rental_price).toFixed(2)} <span>/ day · replace ${Number(item.replacement_cost).toFixed(0)}</span>
        </div>

        {!activeBooking && <div className="muted" style={{ marginTop: 16 }}>No active booking for this item.</div>}

        {activeBooking && (
          <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <div><b>Booking #{activeBooking.id}</b> · {activeBooking.status}</div>
            <div className="muted" style={{ fontSize: 13 }}>
              {activeBooking.customer_name} · {activeBooking.start_date} → {activeBooking.end_date}
            </div>

            {!user ? (
              <div style={{ marginTop: 14 }}>
                <div className="muted" style={{ marginBottom: 8 }}>Log in as staff to check this item out or in.</div>
                <Link to="/login" className="btn small">Log in</Link>
              </div>
            ) : (
              <div className="card-actions">
                {canCheckout && <Link className="btn small" to={`/bookings/${activeBooking.id}/checkout`}><Icon name="check" size={15} /> Check out</Link>}
                {canCheckin && <Link className="btn accent small" to={`/bookings/${activeBooking.id}/checkin`}><Icon name="refresh" size={15} /> Check in</Link>}
                <button className="btn secondary small" disabled={busy} onClick={() => downloadAgreement(activeBooking.id)}>Agreement PDF</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
