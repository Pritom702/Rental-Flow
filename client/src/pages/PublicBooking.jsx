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
import { Icon, categoryIcon } from '../icons.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { useAuth } from '../auth.jsx';
import { money } from '../money.js';
import { rentalDays, rentalFees } from '../social/fees.js';
import { Glyph } from '../social/glyphs.jsx';
import Portal from '../components/Portal.jsx';

// Local calendar date as YYYY-MM-DD. toISOString() would give the UTC date,
// which in Bangladesh (UTC+6) is the previous day for any local midnight.
function toISODate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
const BLOCKING = ['Pending', 'Approved', 'Completed'];
const PRICE_BANDS = [
  { key: 'u500', label: 'Under ৳500', min: 0, max: 500 },
  { key: '500-2000', label: '৳500 – ৳2,000', min: 500, max: 2000 },
  { key: 'o2000', label: 'Over ৳2,000', min: 2000, max: Infinity },
];
const SORTS = [
  { key: 'best', label: 'Best match' },
  { key: 'low', label: 'Lowest price' },
  { key: 'high', label: 'Highest price' },
  { key: 'new', label: 'Newest' },
];

export default function PublicBooking() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState(params.get('search') || '');
  const [categoryId, setCategoryId] = useState(params.get('category_id') || '');
  // Quick filters, kept in the URL so a filtered view can be shared.
  const [availOnly, setAvailOnly] = useState(params.get('available') === '1');
  const [verifiedOnly, setVerifiedOnly] = useState(params.get('verified') === '1');
  const [price, setPrice] = useState(params.get('price') || '');
  const [sort, setSort] = useState(params.get('sort') || 'best');
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
  // Optional damage protection, and listings featured with Limes.
  const [protection, setProtection] = useState(true);
  const [featured, setFeatured] = useState([]);
  useEffect(() => { api.get('/market/featured').then(setFeatured).catch(() => {}); }, []);
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
  }
  // Mirror every filter into the URL (keeping ?item= for deep links).
  useEffect(() => {
    const q = new URLSearchParams();
    if (search) q.set('search', search);
    if (categoryId) q.set('category_id', categoryId);
    if (availOnly) q.set('available', '1');
    if (verifiedOnly) q.set('verified', '1');
    if (price) q.set('price', price);
    if (sort !== 'best') q.set('sort', sort);
    if (params.get('item')) q.set('item', params.get('item'));
    if (q.toString() !== params.toString()) setParams(q, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryId, availOnly, verifiedOnly, price, sort]);

  useEffect(() => { api.get('/categories').then(setCategories).catch(() => {}); }, []);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [search, categoryId]);

  // Booking needs an account. A visitor who isn't signed in is sent to sign up
  // first and brought straight back to this item's booking panel afterwards.
  function openBooking(it) {
    if (!user) {
      navigate(`/login?mode=signup&next=${encodeURIComponent(`/browse?item=${it.id}`)}`);
      return;
    }
    setSelectedItem(it);
  }

  // Open the deep-linked item once, as soon as it can be resolved.
  useEffect(() => {
    if (!deepLinkItem) return;
    api.get(`/items/${deepLinkItem}`)
      .then(openBooking)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkItem]);

  function clearFilters() {
    setSearch('');
    setCategoryId('');
    setAvailOnly(false);
    setVerifiedOnly(false);
    setPrice('');
    setSort('best');
  }
  const hasFilters = Boolean(search || categoryId || availOnly || verifiedOnly || price);

  // Filter and sort on the page: the list is small and this keeps taps instant.
  const shown = useMemo(() => {
    const band = PRICE_BANDS.find((b) => b.key === price);
    const list = items.filter((it) => (
      (!availOnly || it.status === 'Available')
      && (!verifiedOnly || it.owner_verified)
      && (!band || (Number(it.rental_price) >= band.min && Number(it.rental_price) < band.max))
    ));
    const newest = (a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')) || b.id - a.id;
    const by = {
      // Best match: rentable now first, then listings with photos, then newest.
      best: (a, b) => (b.status === 'Available') - (a.status === 'Available') || Boolean(b.cover_url) - Boolean(a.cover_url) || newest(a, b),
      low: (a, b) => Number(a.rental_price) - Number(b.rental_price),
      high: (a, b) => Number(b.rental_price) - Number(a.rental_price),
      new: newest,
    }[sort] || newest;
    return [...list].sort(by);
  }, [items, availOnly, verifiedOnly, price, sort]);

  // With nothing picked, the page shows a row per category instead of one long list.
  const shelves = useMemo(() => {
    if (hasFilters) return [];
    return categories
      .map((c) => ({ ...c, list: shown.filter((it) => String(it.category_id) === String(c.id)) }))
      .filter((c) => c.list.length)
      // Rows with real photos lead; a row of "No photo" cards looks empty.
      .map((c) => ({ ...c, photos: c.list.filter((it) => it.cover_url).length }))
      .sort((a, b) => b.photos - a.photos || b.list.length - a.list.length);
  }, [categories, shown, hasFilters]);
  const activeCategory = categories.find((c) => String(c.id) === String(categoryId));

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
        // Renters no longer verify their identity (only owners and sellers do),
        // so the booking form always opens straight to the dates.
        const state = s.step === 'done' ? null : s.status === 'pending_review' ? 'pending' : 'needed';
        setIdState(state);
        setNeedsNid(false);
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
      const created = await api.post('/bookings', {
        item_id: selectedItem.id,
        customer_name: bookingForm.customer_name || user?.name || 'Guest',
        customer_email: bookingForm.customer_email || user?.email || '',
        start_date: bookingForm.start_date,
        end_date: bookingForm.end_date,
        notes: bookingForm.notes,
        ...(quote?.deposit?.needsGuarantor ? { guarantor } : {}),
        protection,
      });
      // Members pay for the request straight away (RentalFlow Pay, a demo);
      // it is refunded if the owner turns it down.
      if (user && created?.id) {
        const { pay } = await api.post('/payments/booking', { booking_id: created.id, protection });
        navigate(pay);
        return;
      }
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
    const today = toISODate(new Date());
    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateKey = toISODate(new Date(year, month, day));
      // The end date is the return day, so a new rental may start on it.
      const isBooked = bookingAvailability.some((booking) => (
        BLOCKING.includes(booking.status) && dateKey >= booking.start_date && dateKey < booking.end_date
      ));
      days.push({ dateKey, day, isBooked, isPast: dateKey < today, isToday: dateKey === today });
    }
    return days;
  }, [bookingAvailability, calendarMonth, selectedItem]);

  // Tap a day to set the pickup date, tap a later day to set the return date.
  // A third tap starts a new range.
  function pickDay(dateKey) {
    const { start_date: start, end_date: end } = bookingForm;
    if (!start || end || dateKey <= start) {
      setBookingForm({ ...bookingForm, start_date: dateKey, end_date: '' });
    } else {
      setBookingForm({ ...bookingForm, end_date: dateKey });
    }
  }
  const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const thisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  return (
    <div className="container">
      <section className="browse-hero">
        <div className="browse-hero-text">
          <span className="browse-eyebrow"><Icon name="sparkles" size={14} /> Rent it, don’t buy it</span>
          <h1>Find what you need, from people near you</h1>
          <p>Cameras, tools, gear and more, by the day. Every owner’s ID is checked before they can list.</p>
        </div>
        <div className="browse-search search-field">
          <Icon name="search" size={20} />
          <input
            placeholder="Search cameras, drills, tents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search items"
          />
          {search && (
            <button type="button" className="browse-search-x" onClick={() => setSearch('')} aria-label="Clear search">
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
      </section>

      {/* Confirmation lives on the page, not in the modal — the modal closes on success. */}
      {bookingSuccess && (
        <div className="success">
          <Icon name="check" size={16} /> {bookingSuccess}
          <Link to="/bookings" className="btn secondary small" style={{ marginLeft: 'auto' }}>View bookings</Link>
        </div>
      )}

      <div className="cat-rail" role="tablist" aria-label="Categories">
        <button type="button" role="tab" aria-selected={!categoryId} className={`cat-tile${!categoryId ? ' on' : ''}`} onClick={() => setCategoryId('')}>
          <span className="cat-ic"><Icon name="grid" size={22} /></span>
          <b>Everything</b>
          <small>{categories.reduce((n, c) => n + Number(c.item_count || 0), 0)}</small>
        </button>
        {[...categories].sort((x, y) => Number(y.item_count) - Number(x.item_count)).map((c) => (
          <button
            type="button"
            role="tab"
            key={c.id}
            aria-selected={String(c.id) === String(categoryId)}
            className={`cat-tile${String(c.id) === String(categoryId) ? ' on' : ''}${Number(c.item_count) ? '' : ' empty'}`}
            onClick={() => setCategoryId(String(c.id) === String(categoryId) ? '' : String(c.id))}
          >
            <span className="cat-ic"><Icon name={categoryIcon(c.name)} size={22} /></span>
            <b>{c.name}</b>
            <small>{c.item_count}</small>
          </button>
        ))}
      </div>

      <div className="filter-row">
        <button type="button" className={`chip${availOnly ? ' on' : ''}`} aria-pressed={availOnly} onClick={() => setAvailOnly(!availOnly)}>
          <Icon name="calendar" size={14} /> Available now
        </button>
        <button type="button" className={`chip${verifiedOnly ? ' on' : ''}`} aria-pressed={verifiedOnly} onClick={() => setVerifiedOnly(!verifiedOnly)}>
          <Icon name="shield" size={14} /> Verified owners
        </button>
        <span className="chip-sep" aria-hidden="true" />
        {PRICE_BANDS.map((b) => (
          <button key={b.key} type="button" className={`chip${price === b.key ? ' on' : ''}`} aria-pressed={price === b.key} onClick={() => setPrice(price === b.key ? '' : b.key)}>
            {b.label}
          </button>
        ))}
        <label className="chip sort-chip">
          <Icon name="filter" size={14} />
          <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort by">
            {SORTS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </label>
        {hasFilters && (
          <button className="chip clear" type="button" onClick={clearFilters}>
            <Icon name="close" size={14} /> Clear all
          </button>
        )}
      </div>

      {featured.length > 0 && !hasFilters && (
        <section className="featured-strip">
          <div className="fs-head"><Glyph name="star" size={18} /><b>Featured</b><small>Promoted by their owners</small></div>
          <div className="fs-row">
            {featured.map((it) => (
              <Link key={it.id} to={`/product/${it.id}`} className="fs-card">
                {it.cover_url ? <img src={it.cover_url} alt="" loading="lazy" /> : <span className="fs-ph"><Icon name="package" size={24} /></span>}
                <b>{it.name}</b>
                <span>{money(it.rental_price)}/day{it.category_name ? ` · ${it.category_name}` : ''}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {loading ? (
        <div className="center-empty">Loading…</div>
      ) : shown.length === 0 ? (
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
      ) : shelves.length > 0 ? (
        shelves.map((c) => (
          <section className="shelf" key={c.id}>
            <div className="shelf-head">
              <h2><span className="cat-ic sm"><Icon name={categoryIcon(c.name)} size={16} /></span>{c.name}</h2>
              <button type="button" className="btn ghost small" onClick={() => { setCategoryId(String(c.id)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                {c.list.length > 8 ? `See all ${c.list.length}` : 'See all'} <Icon name="arrow-right" size={14} />
              </button>
            </div>
            <div className="shelf-row">
              {c.list.slice(0, 8).map((it) => (
                <ProductCard item={it} key={it.id}>
                  <BookButton it={it} onBook={openBooking} />
                </ProductCard>
              ))}
            </div>
          </section>
        ))
      ) : (
        <>
          <div className="results-head">
            <h2>{activeCategory ? activeCategory.name : search ? `Results for “${search}”` : 'All items'}</h2>
            <span className="muted">{shown.length === 1 ? '1 item' : `${shown.length} items`}</span>
          </div>
          <div className="grid">
            {shown.map((it) => (
              <ProductCard item={it} key={it.id}>
                <BookButton it={it} onBook={openBooking} />
              </ProductCard>
            ))}
          </div>
        </>
      )}

      {/* The booking form is a modal: previously it rendered below the item grid,
          so clicking "Request Booking" appeared to do nothing on a short page. */}
      {selectedItem && user && (
        <Portal><div className="modal-backdrop" onClick={() => setSelectedItem(null)}>
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
                {quote.tier.nextName && <> · {quote.tier.toNext} {quote.tier.toNext === 1 ? 'more on-time return to become a' : 'more on-time returns to become a'} {quote.tier.nextName}</>}
              </span>
            </div>
          )}
          {quote?.blocks?.length > 0 && (
            <div className="error"><Icon name="shield" size={16} /> {quote.blocks[0].text} <Link to="/bookings">Open my bookings</Link></div>
          )}
          {bookingForm.start_date && bookingForm.end_date && bookingForm.start_date < bookingForm.end_date && (() => {
            const days = rentalDays(bookingForm.start_date, bookingForm.end_date);
            const f = rentalFees(selectedItem.rental_price, days, protection);
            return (
              <div className="fee-box">
                <div><span>{money(selectedItem.rental_price)} × {days} {days === 1 ? 'day' : 'days'}</span><b>{money(f.total)}</b></div>
                <div><span>Service fee <small>keeps your booking protected</small></span><b>{money(f.service)}</b></div>
                <label className="fee-protect">
                  <input type="checkbox" checked={protection} onChange={(e) => setProtection(e.target.checked)} />
                  <span><b>Damage protection</b><small>Accidental damage covered up to the item's value — no surprise bills</small></span>
                  <b>{protection ? money(f.cover) : '—'}</b>
                </label>
                <div className="fee-total"><span>You pay</span><b>{money(f.pay)}</b></div>
                <p className="muted small">Plus a refundable deposit (below). Pay only through RentalFlow — deals outside it aren't protected.</p>
              </div>
            );
          })()}
          <div className="booking-summary">
            <div>Deposit{quote ? '' : ' estimate'}: <b>{money(depositEstimate)}</b>{quote && <> ({Math.round(quote.deposit.rate * 100)}% of the item’s value, refunded when it comes back safely)</>}</div>
            <div>Late fee estimate: <b>{money(lateFeeEstimate)}</b> per overdue day</div>
            {quote?.deposit?.unverified && !quote.deposit.overCap && (
              <div className="verify-nudge">
                <Icon name="shield" size={16} />
                <span>You haven’t verified your ID, so the deposit is the item’s full value — it all comes back when you return it. Verify once (NID + selfie, about 2 minutes) and it drops to <b>{money(Number(selectedItem?.replacement_cost || 0) * quote.tier.rate)}</b>.</span>
                <Link to="/verify" className="btn small">Verify &amp; save</Link>
              </div>
            )}
            {quote?.deposit?.overCap && (
              <div className="muted">This item is worth more than your current limit, so the deposit is its full value. Build trust with on-time returns to rent pricier items at a lower deposit.</div>
            )}
          </div>
          {bookingError && <div className="error"><Icon name="shield" size={16} /> {bookingError}</div>}
          <div className="calendar-toolbar">
            <button className="btn secondary small" type="button" disabled={monthStart <= thisMonth} onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} aria-label="Previous month">←</button>
            <strong>{calendarMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong>
            <button className="btn secondary small" type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} aria-label="Next month">→</button>
          </div>
          <div className="muted small calendar-hint">
            {!bookingForm.start_date ? 'Tap the day you pick it up.' : !bookingForm.end_date ? 'Now tap the day you bring it back.' : 'Tap any day to start again.'}
          </div>
          <div className="calendar-grid">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div className="calendar-cell calendar-header" key={day}>{day}</div>
            ))}
            {calendarDays.map((cell, i) => {
              if (!cell) return <div className="calendar-cell blank" key={`blank-${i}`} />;
              const { start_date: start, end_date: end } = bookingForm;
              const edge = cell.dateKey === start || cell.dateKey === end;
              const inRange = start && end && cell.dateKey > start && cell.dateKey < end;
              const cls = ['calendar-cell', 'day',
                cell.isBooked && 'booked', cell.isPast && 'past', cell.isToday && 'today',
                edge && 'picked', inRange && 'in-range'].filter(Boolean).join(' ');
              return (
                <button
                  type="button"
                  key={cell.dateKey}
                  className={cls}
                  disabled={cell.isPast || cell.isBooked}
                  aria-pressed={edge || Boolean(inRange)}
                  aria-label={cell.dateKey}
                  onClick={() => pickDay(cell.dateKey)}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
          <div className="calendar-key">
            <span><i className="k-free" />Free</span>
            <span><i className="k-picked" />Your dates</span>
            <span><i className="k-booked" />Already booked</span>
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
        </div></Portal>
      )}
    </div>
  );
}

function BookButton({ it, onBook }) {
  const free = it.status === 'Available';
  return (
    <div className="card-actions">
      <button
        className="btn accent small"
        disabled={!free}
        onClick={() => onBook(it)}
        title={free ? 'Request a booking' : 'Not available right now'}
      >
        <Icon name="calendar" size={15} />
        {free ? 'Request Booking' : 'Unavailable'}
      </button>
    </div>
  );
}
