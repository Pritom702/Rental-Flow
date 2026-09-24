// ============================================================
//  RentalFlow  |  Sprint 1  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: Public browse/marketplace page (search, filter)
// ============================================================
// Public marketplace page: browse items listed by members, filter by category,
// see price + availability + owner. Reads initial search/category from the URL
// (the landing page links here with query params).
import { useEffect, useMemo, useState } from 'react';
import { celebrate } from '../fx.js';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { Icon } from '../icons.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { useAuth } from '../auth.jsx';
import { money } from '../money.js';

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

export default function PublicBooking() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
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
  // null = not checked yet, true = the one-time NID step must come first.
  const [needsNid, setNeedsNid] = useState(false);
  // Rental protection: this member's trust level and what renting the open
  // item takes (deposit, guarantor), from GET /api/protection/quote.
  const [quote, setQuote] = useState(null);
  const [guarantor, setGuarantor] = useState({ name: '', phone: '', relation: '' });
  const isMember = user?.role === 'member';

  // An item id in the URL (?item=12) deep-links straight to that item's booking
  // panel — this is how the landing page's "Available now" cards arrive here.
  const deepLinkItem = params.get('item');

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

  // Open the deep-linked item once, as soon as it can be resolved.
  useEffect(() => {
    if (!deepLinkItem) return;
    api.get(`/items/${deepLinkItem}`)
      .then((it) => setSelectedItem(it))
      .catch(() => {});
  }, [deepLinkItem]);

  function clearFilters() {
    setSearch('');
    setCategoryId('');
  }
  const hasFilters = Boolean(search || categoryId);

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

  // Damage control: a member's first rental needs the one-time identity check
  // (NID card + live selfie). Ask up front, so the modal can offer the check
  // instead of letting the member pick dates and only then be refused.
  const [idState, setIdState] = useState(null);   // null | 'needed' | 'pending'
  useEffect(() => {
    if (!user || user.role !== 'member') { setNeedsNid(false); setIdState(null); return; }
    api.get('/verify/status')
      .then((s) => {
        const state = s.step === 'done' ? null : s.status === 'pending_review' ? 'pending' : 'needed';
        setIdState(state);
        setNeedsNid(Boolean(state));
      })
      .catch(() => setNeedsNid(false));
  }, [user]);

  useEffect(() => {
    setQuote(null);
    if (!selectedItem || !isMember) return;
    api.get(`/protection/quote?item_id=${selectedItem.id}`).then(setQuote).catch(() => {});
  }, [selectedItem, isMember]);

  function startIdCheck() {
    navigate(`/verify?next=${encodeURIComponent(`/browse?item=${selectedItem.id}`)}`);
  }

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
        ...(quote?.deposit?.needsGuarantor ? { guarantor } : {}),
      });
      celebrate();
      setBookingSuccess('Booking request created successfully');
      setSelectedItem(null);
      setBookingForm({ customer_name: '', customer_email: '', start_date: '', end_date: '', notes: '' });
      setGuarantor({ name: '', phone: '', relation: '' });
    } catch (err) {
      if (err.reason === 'rental-verification-required') {
        setIdState(err.data?.status === 'pending_review' ? 'pending' : 'needed');
        setNeedsNid(true);
      }
      setBookingError(err.message);
    }
  }

  const depositEstimate = useMemo(
    () => (quote ? quote.deposit.amount : Number(selectedItem?.replacement_cost || 0) * 0.2),
    [selectedItem, quote]
  );
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

      {/* Confirmation lives on the page, not in the modal — the modal closes on success. */}
      {bookingSuccess && (
        <div className="success">
          <Icon name="check" size={16} /> {bookingSuccess}
          <Link to="/bookings" className="btn secondary small" style={{ marginLeft: 'auto' }}>View bookings</Link>
        </div>
      )}

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
        {hasFilters && (
          <button className="btn ghost small" type="button" onClick={clearFilters}>
            <Icon name="close" size={14} /> Clear filters
          </button>
        )}
        <span className="muted">{items.length} result{items.length === 1 ? '' : 's'}</span>
      </div>

      {loading ? (
        <div className="center-empty">Loading…</div>
      ) : items.length === 0 ? (
        <div className="center-empty">
          <Icon name="search" size={30} />
          <div className="empty-title">Nothing matches those filters</div>
          {hasFilters
            ? 'Try a different search term, or widen the category.'
            : 'No items have been listed yet.'}
          {hasFilters && (
            <div>
              <button className="btn secondary" type="button" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid">
          {items.map((it) => (
            <ProductCard item={it} key={it.id}>
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
            </ProductCard>
          ))}
        </div>
      )}

      {/* The booking form is a modal: previously it rendered below the item grid,
          so clicking "Request Booking" appeared to do nothing on a short page. */}
      {selectedItem && (
        <div className="modal-backdrop" onClick={() => setSelectedItem(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <div>
                <h2>Book {selectedItem.name}</h2>
                <div className="muted">
                  {needsNid
                    ? 'One quick step before your first rental — then you go straight to the dates.'
                    : 'Blocked dates are shown below. Deposits and late fees are calculated automatically.'}
                </div>
              </div>
              <button className="btn ghost small" type="button" onClick={() => setSelectedItem(null)} aria-label="Close">
                <Icon name="close" size={16} />
              </button>
            </div>

          {/* Damage control gate. A member meets this once, ever: as soon as the
              NID is on file the account is verified and the booking form opens
              directly from then on. */}
          {needsNid ? (
            <div className="nid-gate">
              <div className="notice warn">
                <Icon name="shield" size={18} />
                <div>
                  {idState === 'pending' ? (
                    <>
                      <strong>Your ID is being checked</strong>
                      <div className="muted" style={{ fontSize: 13.5 }}>
                        Our team is reviewing your National ID. You can book as soon as it is approved —
                        we'll notify you.
                      </div>
                    </>
                  ) : (
                    <>
                      <strong>One-time identity check</strong>
                      <div className="muted" style={{ fontSize: 13.5 }}>
                        Before your first rental we verify your National ID with a photo and a quick selfie,
                        so damage claims can be settled fairly. It takes about 2 minutes, and it is saved
                        on your account — you won't be asked again.
                      </div>
                    </>
                  )}
                </div>
              </div>
              {idState !== 'pending' && (
                <button className="btn lg" style={{ width: '100%' }} onClick={startIdCheck}>
                  <Icon name="shield" size={16} /> Verify my identity
                </button>
              )}
            </div>
          ) : (
          <>
          {quote && (
            <div className="trust-strip">
              <span className={`trust-badge level-${quote.tier.level}`}><Icon name="shield" size={14} /> {quote.tier.name}</span>
              <span className="muted">
                {quote.tier.cap ? <>Rent up to <b>{money(quote.tier.cap)}</b> at a {Math.round(quote.tier.rate * 100)}% deposit</> : <>No limit · {Math.round(quote.tier.rate * 100)}% deposit</>}
                {quote.tier.nextName && <> · {quote.tier.toNext} more on-time return{quote.tier.toNext === 1 ? '' : 's'} to become a {quote.tier.nextName}</>}
              </span>
            </div>
          )}
          {quote?.blocks?.length > 0 && (
            <div className="error"><Icon name="shield" size={16} /> {quote.blocks[0].text} <Link to="/bookings">Open my bookings</Link></div>
          )}
          <div className="booking-summary">
            <div>Deposit{quote ? '' : ' estimate'}: <b>{money(depositEstimate)}</b>{quote && <> ({Math.round(quote.deposit.rate * 100)}% of the item’s value, refunded when it comes back safely)</>}</div>
            <div>Late fee estimate: <b>{money(lateFeeEstimate)}</b> per overdue day</div>
            {quote?.deposit?.overCap && (
              <div className="muted">This item is worth more than your current limit, so the deposit is its full value. Build trust with on-time returns to rent pricier items at a lower deposit.</div>
            )}
          </div>
          {bookingError && <div className="error"><Icon name="shield" size={16} /> {bookingError}</div>}
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
          <div className="calendar-key">
            <span><i style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} />Free</span>
            <span><i style={{ background: 'color-mix(in srgb, var(--red) 25%, transparent)' }} />Already booked</span>
          </div>
          <div className="muted" style={{ marginTop: 12 }}>{availabilityMessage}</div>
          <form className="form" onSubmit={submitBooking} style={{ padding: 0, border: 'none', boxShadow: 'none', maxWidth: 'none', marginTop: 16 }}>
            {/* A member always books as themselves (their verified account); only
                staff at the counter type in a walk-in customer's details. */}
            {isMember ? (
              <div className="muted" style={{ marginBottom: 10 }}>Booking as <b>{user.name}</b> ({user.email})</div>
            ) : (
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
            )}
            {quote?.deposit?.needsGuarantor && (
              <fieldset className="guarantor">
                <legend><Icon name="users" size={15} /> Guarantor</legend>
                <p className="muted">For valuable items we ask for someone who can be contacted if the item is not returned — a parent, a relative or your employer.</p>
                <div className="row">
                  <div className="field">
                    <label>Full name</label>
                    <input value={guarantor.name} onChange={(e) => setGuarantor({ ...guarantor, name: e.target.value })} required />
                  </div>
                  <div className="field">
                    <label>Mobile number</label>
                    <input type="tel" inputMode="tel" placeholder="01XXXXXXXXX" value={guarantor.phone} onChange={(e) => setGuarantor({ ...guarantor, phone: e.target.value })} required />
                  </div>
                </div>
                <div className="field">
                  <label>How they know you</label>
                  <input placeholder="e.g. father, employer" value={guarantor.relation} onChange={(e) => setGuarantor({ ...guarantor, relation: e.target.value })} required />
                </div>
              </fieldset>
            )}
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
              <button className="btn" type="submit" disabled={!bookingForm.start_date || !bookingForm.end_date || bookingForm.start_date >= bookingForm.end_date || availabilityMessage.includes('overlap') || quote?.blocks?.length > 0 || quote?.ownItem}>Create booking request</button>
              <button className="btn secondary" type="button" onClick={() => setSelectedItem(null)}>Cancel</button>
            </div>
          </form>
          </>
          )}
          </div>
        </div>
      )}
    </div>
  );
}
