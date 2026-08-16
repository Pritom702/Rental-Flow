// ============================================================
//  RentalFlow  |  Sprint 3  |  Owner: M2  |  Part: Condition report + checkout/checkin (F12/F13/F14)
// ============================================================
// One form drives both phases. `mode` = 'checkout' | 'checkin'.
// Check-in additionally captures repair cost / missing charge and, on submit,
// shows the computed penalty + final bill and offers the return-summary PDF.
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { Icon } from '../icons.jsx';
import { exportReturnSummaryPdf } from '../pdf.js';

const CONDITIONS = ['New', 'Good', 'Fair', 'Poor', 'Damaged'];

export default function Checkout({ mode }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const isCheckin = mode === 'checkin';
  const [booking, setBooking] = useState(null);
  const [form, setForm] = useState({
    condition_status: 'Good', notes: '', scratch_details: '', missing_accessories: '',
    repair_cost: 0, missing_charge: 0,
  });
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // { booking, bill } after check-in

  useEffect(() => {
    api.get(`/bookings/${id}/agreement`).then(setBooking).catch((e) => setError(e.message));
  }, [id]);

  async function onPickPhotos(e) {
    const files = e.target.files;
    if (!files || !files.length) return;
    setUploading(true);
    try {
      const { urls } = await api.uploadImages(files);
      setPhotos((prev) => [...prev, ...urls]);
    } catch (err) { setError(err.message); }
    finally { setUploading(false); }
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      const body = { ...form, photos };
      const res = await api.post(`/bookings/${id}/${mode}`, body);
      if (isCheckin) {
        setResult(res); // show bill + PDF option, don't navigate yet
      } else {
        navigate('/bookings');
      }
    } catch (err) { setError(err.message); }
  }

  async function downloadReturnSummary() {
    const [full, reports] = await Promise.all([
      api.get(`/bookings/${id}/agreement`),
      api.get(`/bookings/${id}/condition-reports`),
    ]);
    exportReturnSummaryPdf(full, result.bill, reports);
  }

  if (error && !booking) return <div className="container"><div className="error"><Icon name="shield" size={16} /> {error}</div></div>;
  if (!booking) return <div className="container"><div className="center-empty">Loading…</div></div>;

  // After a successful check-in: show the settlement.
  if (result) {
    const b = result.bill;
    const money = (n) => `$${Number(n || 0).toFixed(2)}`;
    return (
      <div className="container" style={{ maxWidth: 560 }}>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Return complete — {booking.item_name}</h2>
          <div className="muted" style={{ marginBottom: 12 }}>Booking #{booking.id} · {booking.customer_name}</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <tbody>
              <tr><td>Rental ({b.rentalDays} day(s))</td><td style={{ textAlign: 'right' }}>{money(b.rentalSubtotal)}</td></tr>
              <tr><td>Deposit held</td><td style={{ textAlign: 'right' }}>{money(b.depositAmount)}</td></tr>
              <tr><td>Late fee</td><td style={{ textAlign: 'right' }}>{money(b.lateFee)}</td></tr>
              <tr><td>Damage penalty</td><td style={{ textAlign: 'right' }}>{money(b.penalty)}</td></tr>
              <tr style={{ borderTop: '1px solid var(--border)', fontWeight: 700 }}>
                <td>Deposit refund</td><td style={{ textAlign: 'right', color: 'var(--green)' }}>{money(b.depositRefund)}</td></tr>
              <tr style={{ fontWeight: 700 }}>
                <td>Balance due</td><td style={{ textAlign: 'right', color: b.balanceDue > 0 ? 'var(--red)' : 'var(--text)' }}>{money(b.balanceDue)}</td></tr>
            </tbody>
          </table>
          <div className="card-actions" style={{ marginTop: 16 }}>
            <button className="btn" onClick={downloadReturnSummary}>Download return summary PDF</button>
            <button className="btn secondary" onClick={() => navigate('/bookings')}>Done</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <div className="page-head">
        <div>
          <h1>{isCheckin ? 'Check in' : 'Check out'} — {booking.item_name}</h1>
          <div className="sub">Booking #{booking.id} · {booking.customer_name} · {booking.start_date} → {booking.end_date}</div>
        </div>
      </div>
      {error && <div className="error"><Icon name="shield" size={16} /> {error}</div>}
      <form className="form" onSubmit={submit}>
        <div className="field">
          <label>Condition status</label>
          <select value={form.condition_status} onChange={(e) => setForm({ ...form, condition_status: e.target.value })}>
            {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Notes</label>
          <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <div className="field">
          <label>Scratch / cosmetic details</label>
          <textarea rows={2} value={form.scratch_details} onChange={(e) => setForm({ ...form, scratch_details: e.target.value })} />
        </div>
        <div className="field">
          <label>Missing accessories</label>
          <input value={form.missing_accessories} onChange={(e) => setForm({ ...form, missing_accessories: e.target.value })} placeholder="e.g. charger, lens cap" />
        </div>
        {isCheckin && (
          <div className="row">
            <div className="field">
              <label>Repair cost ($)</label>
              <input type="number" min="0" step="0.01" value={form.repair_cost} onChange={(e) => setForm({ ...form, repair_cost: e.target.value })} />
            </div>
            <div className="field">
              <label>Missing accessory charge ($)</label>
              <input type="number" min="0" step="0.01" value={form.missing_charge} onChange={(e) => setForm({ ...form, missing_charge: e.target.value })} />
            </div>
          </div>
        )}
        <div className="field">
          <label>Photos</label>
          <input type="file" multiple accept="image/*" onChange={onPickPhotos} />
          {uploading && <div className="muted" style={{ fontSize: 13 }}>Uploading…</div>}
          {photos.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {photos.map((u) => <img key={u} src={u} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8 }} />)}
            </div>
          )}
        </div>
        <div className="card-actions">
          <button className="btn" type="submit" disabled={uploading}>
            {isCheckin ? 'Complete check-in' : 'Confirm check-out'}
          </button>
          <button className="btn secondary" type="button" onClick={() => navigate('/bookings')}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
