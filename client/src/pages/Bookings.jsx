import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Icon } from '../icons.jsx';
import { exportAgreementPdf, exportReturnSummaryPdf } from '../pdf.js';
import { money } from '../money.js';
import RenterModal from '../components/RenterModal.jsx';

const STATUS_OPTIONS = ['Pending', 'Approved', 'Cancelled', 'Completed', 'Rejected'];

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  // Which booking's renter identity is open for review, if any.
  const [renterFor, setRenterFor] = useState(null);

  async function load() {
    const params = new URLSearchParams();
    if (selectedItem) params.set('item_id', selectedItem);
    if (statusFilter) params.set('status', statusFilter);
    const [bookingData, itemData] = await Promise.all([
      api.get(`/bookings?${params.toString()}`),
      api.get('/items'),
    ]);
    setBookings(bookingData);
    setItems(itemData);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [selectedItem, statusFilter]);

  async function updateStatus(id, status) {
    try {
      await api.patch(`/bookings/${id}/status`, { status });
      setSuccess(`Booking marked as ${status}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function generateAgreement(id) {
    try {
      await api.post(`/bookings/${id}/agreement`, {});
      const booking = await api.get(`/bookings/${id}/agreement`);
      exportAgreementPdf(booking);
      setSuccess(`Agreement ${booking.agreement_number} generated`);
      load();
    } catch (err) { setError(err.message); }
  }

  async function downloadReturnSummary(id) {
    try {
      const [booking, bill, reports] = await Promise.all([
        api.get(`/bookings/${id}/agreement`),
        api.get(`/bookings/${id}/bill`),
        api.get(`/bookings/${id}/condition-reports`),
      ]);
      exportReturnSummaryPdf(booking, bill, reports);
    } catch (err) { setError(err.message); }
  }

  async function addLateFee(id) {
    try {
      // No overdue_days passed: the server auto-detects how many days past the
      // end date the booking is and calculates the fee from that.
      const updated = await api.post(`/bookings/${id}/late-fee`, {});
      setSuccess(
        updated.overdue_days > 0
          ? `Late fee applied for ${updated.overdue_days} day(s) overdue`
          : 'Booking is not overdue — no late fee due'
      );
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Bookings</h1>
          <div className="sub">Manage rental requests, approvals, deposits, and late fees.</div>
        </div>
        <Link to="/browse" className="btn secondary">Browse items</Link>
      </div>

      {error && <div className="error"><Icon name="shield" size={16} /> {error}</div>}
      {success && <div className="success" style={{ color: 'var(--accent)', marginBottom: 16 }}><Icon name="check" size={16} /> {success}</div>}

      <div className="toolbar">
        <select value={selectedItem} onChange={(e) => setSelectedItem(e.target.value)}>
          <option value="">All items</option>
          {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
      </div>

      {bookings.length === 0 ? (
        <div className="center-empty">No bookings yet.</div>
      ) : (
        <div className="grid">
          {bookings.map((booking) => (
            <div className="card" key={booking.id}>
              <h3>{booking.item_name || 'Item'}</h3>
              <div className="serial">{booking.customer_name} · {booking.customer_email}</div>
              <div className="desc">{booking.notes || 'No notes provided.'}</div>
              <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
                {booking.start_date} → {booking.end_date}
                {booking.overdue_days > 0 && !['Completed', 'Cancelled', 'Rejected'].includes(booking.status) && (
                  <span style={{ color: 'var(--danger, #c0392b)', fontWeight: 600 }}>
                    {' '}· {booking.overdue_days} day(s) overdue
                  </span>
                )}
              </div>
              <div className="price" style={{ fontSize: 16 }}>
                Deposit: {money(booking.deposit_amount)}
              </div>
              <div className="price" style={{ fontSize: 16 }}>
                Late fee: {money(booking.late_fee_amount)}
              </div>
              {Number(booking.penalty_amount) > 0 && (
                <div className="price" style={{ fontSize: 16 }}>
                  Penalty: {money(booking.penalty_amount)}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0', fontSize: 12 }}>
                {booking.agreement_number && <span className="tag">📄 {booking.agreement_number}</span>}
                {booking.checked_out_at && <span className="tag">✔ checked out</span>}
                {booking.checked_in_at && <span className="tag">✔ checked in</span>}
              </div>
              <div className="card-actions">
                {/* Identity first: on a request still awaiting a decision this is
                    the primary action, so it is not just another grey button. */}
                <button
                  className={`btn ${booking.status === 'Pending' ? '' : 'secondary'} small`}
                  onClick={() => setRenterFor(booking.id)}
                >
                  <Icon name="user" size={14} />
                  {booking.status === 'Pending' ? 'Review renter' : 'Renter details'}
                </button>
                <select value={booking.status} onChange={(e) => updateStatus(booking.id, e.target.value)}>
                  {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
                <button className="btn secondary small" onClick={() => generateAgreement(booking.id)}>Agreement PDF</button>
                {booking.status === 'Approved' && !booking.checked_out_at && (
                  <Link className="btn small" to={`/bookings/${booking.id}/checkout`}>Check out</Link>
                )}
                {booking.checked_out_at && !booking.checked_in_at && (
                  <Link className="btn accent small" to={`/bookings/${booking.id}/checkin`}>Check in</Link>
                )}
                {booking.checked_in_at && (
                  <button className="btn secondary small" onClick={() => downloadReturnSummary(booking.id)}>Return summary PDF</button>
                )}
                {!booking.checked_in_at && (
                  <button className="btn secondary small" onClick={() => addLateFee(booking.id)}>Auto-calc late fee</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {renterFor && (
        <RenterModal
          bookingId={renterFor}
          onClose={() => setRenterFor(null)}
          onDecide={async (status) => {
            await api.patch(`/bookings/${renterFor}/status`, { status });
            setSuccess(`Booking marked as ${status}`);
            load();
          }}
        />
      )}
    </div>
  );
}
