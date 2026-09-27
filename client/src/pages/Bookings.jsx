import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { Icon, categoryIcon } from '../icons.jsx';
import { exportAgreementPdf, exportReturnSummaryPdf } from '../pdf.js';
import { money } from '../money.js';
import RenterModal from '../components/RenterModal.jsx';
import BookingProtection from '../components/BookingProtection.jsx';
import { useAuth } from '../auth.jsx';

const STATUS_OPTIONS = ['Pending', 'Approved', 'Cancelled', 'Completed', 'Rejected'];

export default function Bookings() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [bookings, setBookings] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState('');
  const [statusFilter, setStatusFilter] = useState(params.get('status') || '');
  const [category, setCategory] = useState(params.get('category') || '');
  // A member is on two sides of the market: things they rent from others, and
  // requests other people send for their own listings. ?view= picks one.
  const view = params.get('view') || 'all';
  function setView(next) {
    const q = new URLSearchParams(params);
    if (next === 'all') q.delete('view'); else q.set('view', next);
    setParams(q, { replace: true });
  }
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  // Which booking's renter identity is open for review, if any.
  const [renterFor, setRenterFor] = useState(null);
  const { user } = useAuth();
  // A member's own standing as a renter (trust level, anything blocking them).
  const [standing, setStanding] = useState(null);
  useEffect(() => {
    if (user?.role === 'member') api.get('/protection/standing').then(setStanding).catch(() => {});
  }, [user, bookings]);

  async function load() {
    const params = new URLSearchParams();
    if (selectedItem) params.set('item_id', selectedItem);
    if (statusFilter) params.set('status', statusFilter);
    const bookingData = await api.get(`/bookings?${params.toString()}`);
    setBookings(bookingData);
    // The item picker lists only items that appear in this person's bookings
    // (not every listing on the site). Keep the list while one item is picked.
    if (!selectedItem) {
      const seen = new Map();
      bookingData.forEach((b) => { if (b.item_id && !seen.has(b.item_id)) seen.set(b.item_id, { id: b.item_id, name: b.item_name || 'Item' }); });
      setItems([...seen.values()].sort((a, b) => a.name.localeCompare(b.name)));
    }
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
    const q = new URLSearchParams(params);
    if (statusFilter) q.set('status', statusFilter); else q.delete('status');
    if (q.toString() !== params.toString()) setParams(q, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItem, statusFilter]);

  const isMember = user?.role === 'member';
  const renting = bookings.filter((b) => b.my_role === 'renter');
  const requests = bookings.filter((b) => b.my_role === 'owner');
  const sideShown = !isMember || view === 'all' ? bookings : view === 'renting' ? renting : requests;
  // Categories that appear in these bookings, with how many each.
  const categories = useMemo(() => {
    const m = new Map();
    sideShown.forEach((b) => { const k = b.category_name || 'Other'; m.set(k, (m.get(k) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [sideShown]);
  const shown = category ? sideShown.filter((b) => (b.category_name || 'Other') === category) : sideShown;
  const VIEWS = [
    { key: 'all', label: 'All', n: bookings.length },
    { key: 'renting', label: 'My rentals', n: renting.length, hint: 'Things you are renting from others' },
    { key: 'requests', label: 'Requests for my items', n: requests.length, hint: 'People who want to rent your listings' },
  ];

  // Owner: ask the renter to pay an approved booking. The request lands in
  // the chat and the renter's notifications, and leads to RentalFlow Pay.
  async function requestPayment(id) {
    try {
      const r = await api.post('/payments/request', { booking_id: id });
      setError('');
      setSuccess('Payment request sent to the renter.');
      navigate(`/messages/${r.conversation_id}`);
    } catch (e) { setSuccess(''); setError(e.message); }
  }

  // The chat with the owner opens once they approve the request.
  async function messageOwner(itemId) {
    try {
      const { id } = await api.post('/messages/conversations', { item_id: itemId });
      navigate(`/messages/${id}`);
    } catch (e) { setError(e.message); }
  }

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

      {standing && (
        <div className="trust-strip standing">
          <span className={`trust-badge level-${standing.tier.level}`}><Icon name="shield" size={14} /> {standing.tier.name}</span>
          <span className="muted">
            {standing.cleanReturns} {standing.cleanReturns === 1 ? 'on-time return' : 'on-time returns'} ·{' '}
            {standing.tier.cap ? <>rent up to {money(standing.tier.cap)} at a {Math.round(standing.tier.rate * 100)}% deposit</> : <>no limit, {Math.round(standing.tier.rate * 100)}% deposit</>}
          </span>
          {standing.blocks.map((x) => <span className="protect-alert stage-4" key={x.code}>{x.text}</span>)}
        </div>
      )}

      {isMember && (
        <div className="seg-tabs" role="tablist" aria-label="Which bookings">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={view === v.key}
              className={view === v.key ? 'on' : ''}
              title={v.hint}
              onClick={() => setView(v.key)}
            >
              {v.label} <span className="seg-n">{v.n}</span>
            </button>
          ))}
        </div>
      )}

      <div className="bk-filters">
        {categories.length > 0 && (
          <div className="filter-row bk-cats" role="tablist" aria-label="Category">
            <button type="button" className={`chip${!category ? ' on' : ''}`} onClick={() => setCategory('')}>
              <Icon name="grid" size={14} /> All categories <b>{sideShown.length}</b>
            </button>
            {categories.map(([name, n]) => (
              <button type="button" key={name} className={`chip${category === name ? ' on' : ''}`} onClick={() => setCategory(category === name ? '' : name)}>
                <Icon name={categoryIcon(name)} size={14} /> {name} <b>{n}</b>
              </button>
            ))}
          </div>
        )}
        <div className="filter-row bk-status" role="tablist" aria-label="Status">
          {['', ...STATUS_OPTIONS].map((s) => (
            <button type="button" key={s || 'all'} className={`chip${statusFilter === s ? ' on' : ''}`} onClick={() => setStatusFilter(s)}>
              {s || 'Any status'}
            </button>
          ))}
          <label className="chip sort-chip">
            <Icon name="package" size={14} />
            <select value={selectedItem} onChange={(e) => setSelectedItem(e.target.value)} aria-label="Item">
              <option value="">All items</option>
              {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="center-empty">
          {statusFilter
            ? `No ${statusFilter.toLowerCase()} bookings here.`
            : view === 'renting' ? 'You haven’t rented anything yet.'
              : view === 'requests' ? 'Nobody has asked to rent your listings yet.' : 'No bookings yet.'}
          {view === 'renting' && !statusFilter && <div><Link to="/browse" className="btn">Find something to rent</Link></div>}
        </div>
      ) : (
        <div className="bk-list">
          {shown.map((booking) => (
            <div className={`card bk-card status-${booking.status}`} key={booking.id}>
              <Link to={`/product/${booking.item_id}`} className="bk-photo">
                {booking.item_cover ? <img src={booking.item_cover} alt="" loading="lazy" /> : <Icon name="package" size={30} />}
              </Link>
              <div className="bk-body">
              <div className="bk-top">
                <h3>{booking.item_name || 'Item'}</h3>
                <span className={`badge ${booking.status}`}>{booking.status}</span>
              </div>
              <div className="bk-meta">
                {booking.category_name && <span><Icon name={categoryIcon(booking.category_name)} size={13} /> {booking.category_name}</span>}
                <span><Icon name="calendar" size={13} /> {`${String(booking.start_date).slice(0, 10)} → ${String(booking.end_date).slice(0, 10)}`}</span>
                <span><Icon name="user" size={13} /> {booking.my_role === 'renter' ? `Owner: ${booking.owner_name || '—'}` : `Renter: ${booking.customer_name}`}</span>
                {booking.overdue_days > 0 && !['Completed', 'Cancelled', 'Rejected'].includes(booking.status) && (
                  <span className="bk-late">{booking.overdue_days === 1 ? '1 day overdue' : `${booking.overdue_days} days overdue`}</span>
                )}
              </div>
              <div className="bk-money">
                <span>Rent <b>{`${money(booking.rental_price)}/day`}</b></span>
                <span>Deposit <b>{money(booking.deposit_amount)}</b></span>
                {Number(booking.late_fee_amount) > 0 && <span>Late fee <b>{money(booking.late_fee_amount)}</b></span>}
                {Number(booking.penalty_amount) > 0 && <span>Penalty <b>{money(booking.penalty_amount)}</b></span>}
              </div>
              {booking.notes && <div className="bk-notes">{booking.notes}</div>}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0', fontSize: 12 }}>
                {booking.agreement_number && <span className="tag">📄 {booking.agreement_number}</span>}
                {booking.checked_out_at && <span className="tag">✔ checked out</span>}
                {booking.checked_in_at && <span className="tag">✔ checked in</span>}
              </div>
              <BookingProtection booking={booking} onChange={load}
                onError={(m) => { setSuccess(''); setError(m); }} onDone={(m) => { setError(''); setSuccess(m); }} />
              {booking.my_role === 'renter' ? (
                <div className="card-actions">
                  {booking.paid_at && <span className="badge paid">Paid</span>}
                  {!booking.paid_at && booking.status === 'Approved' && (booking.pay_tran
                    ? <Link className="btn accent small" to={`/pay/${booking.pay_tran}`}>Pay now</Link>
                    : <span className="muted small">Approved. The owner will send you a payment request.</span>)}
                  {['Approved', 'Completed'].includes(booking.status) && (
                    <button className="btn secondary small" onClick={() => messageOwner(booking.item_id)}><Icon name="chat" size={14} /> Message owner</button>
                  )}
                  {booking.status === 'Pending' && (
                    <span className="muted small">No payment now. You can message the owner once they approve.</span>
                  )}
                  {booking.status === 'Pending' && (
                    <button className="btn secondary small" onClick={() => updateStatus(booking.id, 'Cancelled')}>Cancel request</button>
                  )}
                </div>
              ) : (
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
                {booking.status !== 'Missing' && (
                  <select value={booking.status} onChange={(e) => updateStatus(booking.id, e.target.value)}>
                    {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                )}
                {booking.status === 'Approved' && !booking.paid_at && booking.renter_id && Number(booking.renter_id) !== Number(booking.owner_id) && (
                  <button className="btn accent small" onClick={() => requestPayment(booking.id)}>
                    <Icon name="wallet" size={14} /> {booking.pay_tran ? 'Resend payment request' : 'Send payment request'}
                  </button>
                )}
                {booking.paid_at && <span className="badge paid">Paid</span>}
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
                {!booking.checked_in_at && booking.status !== 'Missing' && (
                  <button className="btn secondary small" onClick={() => addLateFee(booking.id)}>Auto-calc late fee</button>
                )}
              </div>
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
