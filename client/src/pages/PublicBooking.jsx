// ============================================================
//  RentalFlow  |  Sprint 1  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: Public browse/marketplace page (search, filter)
// ============================================================
// Public marketplace page: browse items listed by members, filter by category,
// see price + availability + owner. Reads initial search/category from the URL
// (the landing page links here with query params).
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { Icon } from '../icons.jsx';
import { StatusBadge, TagList, CardPhoto } from '../components.jsx';
import { useAuth } from '../auth.jsx';

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

export default function PublicBooking() {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState(params.get('search') || '');
  const [categoryId, setCategoryId] = useState(params.get('category_id') || '');
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [bookingAvailability, setBookingAvailability] = useState([]);
  const [bookingForm, setBookingForm] = useState({ customer_name: '', customer_email: '', start_date: '', end_date: '', notes: '' });
  const [bookingError, setBookingError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [availabilityMessage, setAvailabilityMessage] = useState('');

  async function load() {
    setLoading(true);
    const q = new URLSearchParams();
    if (search) q.set('search', search);
    if (categoryId) q.set('category_id', categoryId);
    const data = await api.get(`/items?${q.toString()}`);
    setItems(data);
    setLoading(false);
    setParams(q, { replace: true });
  }

  useEffect(() => { api.get('/categories').then(setCategories).catch(() => {}); }, []);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [search, categoryId]);

  useEffect(() => {
    if (!selectedItem) {
      setBookingAvailability([]);
      return;
    }
    api.get(`/items/${selectedItem.id}/bookings`).then(setBookingAvailability).catch(() => setBookingAvailability([]));
  }, [selectedItem]);

  useEffect(() => {
    if (!selectedItem) return;
    const start = bookingForm.start_date;
    const end = bookingForm.end_date;
    if (!start || !end) {
      setAvailabilityMessage('Choose a date range to see whether it is free.');
      return;
    }
    if (start >= end) {
      setAvailabilityMessage('End date must be after the start date.');
      return;
    }
    const overlaps = bookingAvailability.some((booking) => {
      const blockedStatuses = ['Pending', 'Approved', 'Completed'];
      if (!blockedStatuses.includes(booking.status)) return false;
      return start < booking.end_date && end > booking.start_date;
    });
    setAvailabilityMessage(overlaps ? 'These dates overlap with an existing booking.' : 'These dates are available for booking.');
  }, [selectedItem, bookingAvailability, bookingForm.start_date, bookingForm.end_date]);

  async function submitBooking(e) {
    e.preventDefault();
    setBookingError('');
    setBookingSuccess('');
    try {
      await api.post('/bookings', {
        item_id: selectedItem.id,
        customer_name: bookingForm.customer_name || user?.name || 'Guest',
        customer_email: bookingForm.customer_email || user?.email || '',
        start_date: bookingForm.start_date,
        end_date: bookingForm.end_date,
        notes: bookingForm.notes,
      });
      setBookingSuccess('Booking request created successfully');
      setSelectedItem(null);
      setBookingForm({ customer_name: '', customer_email: '', start_date: '', end_date: '', notes: '' });
    } catch (err) {
      setBookingError(err.message);
    }
  }

  const depositEstimate = useMemo(() => Number(selectedItem?.replacement_cost || 0) * 0.2, [selectedItem]);
  const lateFeeEstimate = useMemo(() => Number(selectedItem?.rental_price || 0) * 0.1, [selectedItem]);

  const calendarDays = useMemo(() => {
    if (!selectedItem) return [];
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leadingBlankCount = firstDay.getDay();
    const days = [];
    for (let i = 0; i < leadingBlankCount; i += 1) days.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      const dateKey = toISODate(date);
      const isBooked = bookingAvailability.some((booking) => {
        const blockedStatuses = ['Pending', 'Approved', 'Completed'];
        if (!blockedStatuses.includes(booking.status)) return false;
        return dateKey >= booking.start_date && dateKey <= booking.end_date;
      });
      days.push({ dateKey, day, isBooked });
    }
    return days;
  }, [bookingAvailability, calendarMonth, selectedItem]);

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Rental Marketplace</h1>
          <div className="sub">Browse equipment, review availability, and request a booking.</div>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-field" style={{ minWidth: 240, flex: '1 1 240px' }}>
          <Icon name="search" size={18} />
          <input
            placeholder="Search items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name} ({c.item_count})</option>
          ))}
        </select>
        <span className="muted">{items.length} result{items.length === 1 ? '' : 's'}</span>
      </div>

      {loading ? (
        <div className="center-empty">Loading…</div>
      ) : items.length === 0 ? (
        <div className="center-empty">No items match your search.</div>
      ) : (
        <div className="grid">
          {items.map((it) => (
            <div className="card" key={it.id}>
              <CardPhoto url={it.cover_url} count={it.image_count} />
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <h3>{it.name}</h3>
                <StatusBadge status={it.status} />
              </div>
              <div className="serial">Listed by <b>{it.owner_name || 'Unknown'}</b></div>
              <div className="desc">{it.description || 'No description'}</div>
              <TagList tags={it.tags} />
              <div className="price" style={{ marginTop: 12 }}>
                ${Number(it.rental_price).toFixed(2)} <span>/ day</span>
              </div>
              <div className="card-actions">
                <button
                  className="btn accent small"
                  disabled={it.status !== 'Available'}
                  onClick={() => setSelectedItem(it)}
                  title={it.status !== 'Available' ? 'Not available right now' : 'Request a booking'}
                >
                  <Icon name="calendar" size={15} />
                  {it.status === 'Available' ? 'Request Booking' : 'Unavailable'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedItem && (
        <div className="card" style={{ marginTop: 24, maxWidth: 760 }}>
          <h3>Book {selectedItem.name}</h3>
          <div className="muted" style={{ marginBottom: 12 }}>
            The calendar below shows dates already blocked by existing bookings. Deposits and late fees are calculated automatically.
          </div>
          <div className="booking-summary">
            <div>Deposit estimate: <b>${depositEstimate.toFixed(2)}</b></div>
            <div>Late fee estimate: <b>${lateFeeEstimate.toFixed(2)}</b> per overdue day</div>
          </div>
          {bookingError && <div className="error"><Icon name="shield" size={16} /> {bookingError}</div>}
          {bookingSuccess && <div className="success" style={{ color: 'var(--accent)', marginBottom: 12 }}><Icon name="check" size={16} /> {bookingSuccess}</div>}
          <div className="calendar-toolbar">
            <button className="btn secondary small" type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}>← Prev</button>
            <strong>{calendarMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong>
            <button className="btn secondary small" type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}>Next →</button>
          </div>
          <div className="calendar-grid">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div className="calendar-cell calendar-header" key={day}>{day}</div>
            ))}
            {calendarDays.map((cell) => (
              <div className={`calendar-cell${cell?.isBooked ? ' booked' : ''}`} key={cell ? cell.dateKey : `blank-${Math.random()}`}>
                {cell ? cell.day : ''}
              </div>
            ))}
          </div>
          <div className="muted" style={{ marginTop: 12 }}>{availabilityMessage}</div>
          <form className="form" onSubmit={submitBooking} style={{ padding: 0, border: 'none', boxShadow: 'none', maxWidth: 'none', marginTop: 16 }}>
            <div className="row">
              <div className="field">
                <label>Customer name</label>
                <input value={bookingForm.customer_name} onChange={(e) => setBookingForm({ ...bookingForm, customer_name: e.target.value })} required />
              </div>
              <div className="field">
                <label>Customer email</label>
                <input type="email" value={bookingForm.customer_email} onChange={(e) => setBookingForm({ ...bookingForm, customer_email: e.target.value })} required />
              </div>
            </div>
            <div className="row">
              <div className="field">
                <label>Start date</label>
                <input type="date" value={bookingForm.start_date} onChange={(e) => setBookingForm({ ...bookingForm, start_date: e.target.value })} required />
              </div>
              <div className="field">
                <label>End date</label>
                <input type="date" value={bookingForm.end_date} onChange={(e) => setBookingForm({ ...bookingForm, end_date: e.target.value })} required />
              </div>
            </div>
            <div className="field">
              <label>Notes</label>
              <textarea rows={3} value={bookingForm.notes} onChange={(e) => setBookingForm({ ...bookingForm, notes: e.target.value })} />
            </div>
            <div className="card-actions">
              <button className="btn" type="submit" disabled={!bookingForm.start_date || !bookingForm.end_date || bookingForm.start_date >= bookingForm.end_date || availabilityMessage.includes('overlap')}>Create booking request</button>
              <button className="btn secondary" type="button" onClick={() => setSelectedItem(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
