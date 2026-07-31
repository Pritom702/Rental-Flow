import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Icon } from '../icons.jsx';

const STATUS_OPTIONS = ['Pending', 'Approved', 'Cancelled', 'Completed', 'Rejected'];

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

  async function addLateFee(id) {
    try {
      await api.post(`/bookings/${id}/late-fee`, { overdue_days: 2 });
      setSuccess('Late fee applied');
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
              </div>
              <div className="price" style={{ fontSize: 16 }}>
                Deposit: ${Number(booking.deposit_amount || 0).toFixed(2)}
              </div>
              <div className="price" style={{ fontSize: 16 }}>
                Late fee: ${Number(booking.late_fee_amount || 0).toFixed(2)}
              </div>
              <div className="card-actions">
                <select value={booking.status} onChange={(e) => updateStatus(booking.id, e.target.value)}>
                  {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
                <button className="btn secondary small" onClick={() => addLateFee(booking.id)}>Apply late fee</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
