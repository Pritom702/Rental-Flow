// ============================================================
//  RentalFlow  |  Messaging  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: conversations list + chat thread
// ============================================================
// Computer: conversations on the left, the open chat in the middle, and the
// other person's profile, record and your history together on the right —
// both people see each other's, so every deal is made in the open.
// Phone:    the list first; opening a chat fills the screen, with a back button.
// New messages are fetched every few seconds — only the ones newer than the
// last one already on screen.
import { useCallback, useEffect, useRef, useState } from 'react';
import { play } from '../sfx.js';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Icon } from '../icons.jsx';
import { money } from '../money.js';
import { Glyph } from '../social/glyphs.jsx';
import { say } from '../social/toast.js';
import { Avatar } from '../social/util.jsx';

const THREAD_POLL_MS = 4000;
const LIST_POLL_MS = 15000;

function when(d) {
  if (!d) return '';
  const date = new Date(d);
  const today = new Date().toDateString() === date.toDateString();
  return today
    ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export default function Messages() {
  const { id } = useParams();
  const [list, setList] = useState(null);

  const loadList = useCallback(() => api.get('/messages/conversations').then(setList).catch(() => {}), []);
  useEffect(() => {
    loadList();
    const t = setInterval(loadList, LIST_POLL_MS);
    return () => clearInterval(t);
  }, [loadList]);

  return (
    <div className={`chat-shell${id ? ' has-thread' : ''}`}>
      <aside className="chat-list">
        <h1>Messages</h1>
        {!list && <p className="muted">Loading…</p>}
        {list && !list.length && (
          <div className="chat-empty">
            <Icon name="chat" size={28} />
            <p>No conversations yet. Open a listing and press <b>Message the lister</b> to ask about it.</p>
            <Link to="/browse" className="btn small">Browse listings</Link>
          </div>
        )}
        {list?.map((c) => (
          <Link key={c.id} to={`/messages/${c.id}`} className={`chat-row${String(c.id) === id ? ' on' : ''}`}>
            {c.item_cover ? <img src={c.item_cover} alt="" /> : <span className="chat-row-icon"><Icon name="package" size={18} /></span>}
            <div className="chat-row-main">
              <div className="chat-row-top">
                <b>{c.other_name}</b>
                <span>{when(c.last_message_at || c.created_at)}</span>
              </div>
              <div className="chat-row-item">{c.item_name || 'Listing removed'}{c.i_am_owner ? (c.post_id ? ' · you are selling' : ' · your listing') : ''}</div>
              <div className="chat-row-last">{c.last_body || 'No messages yet'}</div>
            </div>
            {c.unread > 0 && <span className="chat-unread">{c.unread}</span>}
          </Link>
        ))}
      </aside>
      <section className="chat-thread">
        {id ? <Thread id={id} onActivity={loadList} /> : (
          <div className="chat-placeholder"><Icon name="chat" size={30} /><p>Choose a conversation.</p></div>
        )}
      </section>
    </div>
  );
}

function Thread({ id, onActivity }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [convo, setConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [seenUpTo, setSeenUpTo] = useState(0);   // the other person has read my messages up to this id
  const [infoOpen, setInfoOpen] = useState(false); // narrow screens: the profile panel slides in
  const bottom = useRef(null);
  const lastId = useRef(0);

  const fetchNew = useCallback(async (first = false) => {
    try {
      const data = await api.get(`/messages/conversations/${id}?after=${first ? 0 : lastId.current}`);
      if (first) setConvo(data);
      setSeenUpTo(data.seenUpTo || 0);
      if (data.messages.length) {
        lastId.current = data.messages[data.messages.length - 1].id;
        setMessages((prev) => (first ? data.messages : [...prev, ...data.messages.filter((m) => !prev.some((p) => p.id === m.id))]));
        if (!first) onActivity();
      }
    } catch (e) {
      if (first) setError(e.message);
    }
  }, [id, onActivity]);

  useEffect(() => {
    lastId.current = 0;
    setMessages([]);
    setConvo(null);
    setError('');
    fetchNew(true).then(onActivity);
    const t = setInterval(() => fetchNew(false), THREAD_POLL_MS);
    return () => clearInterval(t);
  }, [id, fetchNew, onActivity]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);

  async function send(e) {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError('');
    try {
      const m = await api.post(`/messages/conversations/${id}`, { body });
      lastId.current = Math.max(lastId.current, m.id);
      setMessages((prev) => [...prev, m]);
      play('send');
      // Something was hidden: say why, kindly.
      if (m.guardNote) say(m.guardNote, 'shield');
      setText('');
      onActivity();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function reportOutside() {
    if (!window.confirm(`Report ${convo.other_name} for asking to deal or pay outside RentalFlow?`)) return;
    try {
      const r = await api.post('/market/report-offplatform', { conversation_id: convo.id });
      say(r.already ? 'Already reported — thank you' : `Thanks — reported. +${r.limes} Limes for keeping RentalFlow safe`, 'shield');
    } catch (e) { say(e.message, 'warn'); }
  }

  if (error && !convo) return <div className="chat-placeholder"><div className="error">{error}</div></div>;
  if (!convo) return <div className="chat-placeholder"><p className="muted">Loading…</p></div>;

  return (
    <div className={`thread-wrap${infoOpen ? ' info-open' : ''}`}>
    <div className="thread">
      <header className="thread-head">
        <button className="btn ghost small thread-back" onClick={() => navigate('/messages')} aria-label="Back to conversations">←</button>
        <div className="thread-who">
          <b>{convo.other_name}</b>
          {convo.item_id
            ? <Link to={`/product/${convo.item_id}`} className="thread-item">
                {convo.item_cover && <img src={convo.item_cover} alt="" />}
                <span>{convo.item_name} · {money(convo.rental_price)}/day</span>
              </Link>
            : convo.post_id
              // A chat about something for sale in the community.
              ? <Link to={`/post/${convo.post_id}`} className="thread-item">
                  {convo.post_cover && <img src={convo.post_cover} alt="" />}
                  <span>For sale · {convo.post_title} · {money(convo.sale?.price)}{convo.sale?.sold ? ' · sold' : ''}</span>
                </Link>
              : convo.support ? <span className="thread-item"><Glyph name="shield" size={14} /> Message from the RentalFlow team</span>
                : <span className="muted">This listing was removed</span>}
        </div>
        {convo.other && (
          <button type="button" className="btn ghost small thread-info-btn" onClick={() => setInfoOpen(true)} aria-label={`About ${convo.other_name}`}>
            <Glyph name="people" size={15} /> Profile
          </button>
        )}
        <button type="button" className="btn ghost small thread-report" onClick={reportOutside} title="They asked me to pay outside RentalFlow">
          <Glyph name="flag" size={15} /> Report
        </button>
      </header>

      {!convo.unlocked && !convo.support && (
        <div className="chat-lock">
          <Glyph name="shield" size={20} />
          <div>
            <b>Protected chat</b>
            <span>
              Phone numbers and payment details stay hidden until {convo.item_id ? 'the booking is approved' : 'an offer is accepted'} — then
              they show for both of you. Deals made outside RentalFlow lose the deposit protection, damage claims and refunds.
            </span>
          </div>
          {convo.item_id && !convo.iAmOwner && <Link to={`/browse?item=${convo.item_id}`} className="btn accent small">Book now</Link>}
        </div>
      )}
      {convo.post_id && <DealBox convo={convo} me={user} onChange={() => fetchNew(true)} />}
      {convo.item_id && convo.payment && <RentPayBox convo={convo} onSent={(m) => { setMessages((prev) => [...prev, m]); lastId.current = Math.max(lastId.current, m.id); fetchNew(true); }} />}

      <div className="thread-body">
        {!messages.length && (
          <p className="thread-hint">
            {convo.iAmOwner
              ? `${convo.other_name} opened a chat about your listing.`
              : `Ask ${convo.other_name} anything about this listing — condition, pickup, dates.`}
          </p>
        )}
        {messages.map((m) => (m.kind === 'system' ? (
          <div key={m.id} className="chat-system"><Glyph name="sparkle" size={14} />{m.body}</div>
        ) : m.kind === 'payreq' ? (
          <PayRequest key={m.id} m={m} mine={m.sender_id === user.id} />
        ) : (
          <div key={m.id} className={`bubble${m.sender_id === user.id ? ' me' : ''}${m.guard_flags?.length && !convo.unlocked ? ' guarded' : ''}`}>
            <p translate="no">{m.body}</p>
            <span>
              {m.guard_flags?.length > 0 && !convo.unlocked && <em className="guard-tag"><Glyph name="shield" size={12} /> details hidden</em>}
              {when(m.created_at)}{m.sender_id === user.id && (m.read_at || m.id <= seenUpTo) ? ' · Seen' : ''}
            </span>
          </div>
        )))}
        <div ref={bottom} />
      </div>

      {convo.canWrite === false ? (
        <div className="composer locked-note"><Icon name="shield" size={16} /> {convo.post_id ? 'You can write here once the seller accepts your offer.' : 'You can write here once the owner approves your booking request.'}</div>
      ) : (
      <form className="composer" onSubmit={send}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Write a message…"
          rows={1}
          maxLength={2000}
          aria-label="Message"
        />
        <button className="btn" data-sfx="none" disabled={!text.trim() || sending}>Send</button>
      </form>
      )}
      {error && <div className="error">{error}</div>}
    </div>
    {convo.other && <PersonPanel p={convo.other} together={convo.together || []} onClose={() => setInfoOpen(false)} />}
    {infoOpen && <div className="chat-info-scrim" onClick={() => setInfoOpen(false)} />}
    </div>
  );
}

// The other person, in the open: who they are, their record on RentalFlow,
// their trust score (and how it is worked out), and your history together.
function PersonPanel({ p, together, onClose }) {
  const since = new Date(p.member_since).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  const tone = p.trust >= 85 ? 'good' : p.trust >= 65 ? 'ok' : 'low';
  const stats = [
    ['Rented', p.rented, p.rented_with_charges ? `${p.rented_with_charges} with charges` : 'all returned clean'],
    ['Lent out', p.lent, p.listings === 1 ? '1 listing' : `${p.listings} listings`],
    ['Bought', p.bought, null],
    ['Sold', p.sold, null],
  ];
  const flags = [
    p.not_returned > 0 && `${p.not_returned} not returned`,
    p.claims > 0 && (p.claims === 1 ? '1 damage claim' : `${p.claims} damage claims`),
    p.dropped > 0 && (p.dropped === 1 ? '1 deal dropped' : `${p.dropped} deals dropped`),
    p.warning_count > 0 && (p.warning_count === 1 ? '1 warning' : `${p.warning_count} warnings`),
    p.content_strikes > 0 && (p.content_strikes === 1 ? '1 content strike' : `${p.content_strikes} content strikes`),
  ].filter(Boolean);
  return (
    <aside className="chat-info" aria-label={`About ${p.name}`}>
      <button type="button" className="icon-btn chat-info-close" onClick={onClose} aria-label="Close"><Icon name="close" size={16} /></button>
      <div className="ci-head">
        <Avatar id={p.id} name={p.name} src={p.avatar_url} size={64} />
        <b translate="no">{p.name}</b>
        {p.handle && <span className="muted small" translate="no">@{p.handle}</span>}
        <span className="ci-tags">
          <em className={`tag${p.verified ? ' ok' : ''}`}>{p.verified ? 'Fully verified' : 'Not verified yet'}</em>
          <em className="tag">{`Member since ${since}`}</em>
          {p.status === 'suspended' && <em className="tag red">Banned</em>}
        </span>
        <Link to={`/u/${p.handle || p.id}`} className="btn secondary small">View profile</Link>
      </div>

      <div className={`ci-trust ${tone}`}>
        <div className="ci-trust-top"><span>Trust score</span><b>{p.trust}</b></div>
        <div className="ci-bar"><i style={{ width: `${p.trust}%` }} /></div>
        <small>{`(${p.good} good + 4) ÷ (${p.good} good + ${p.bad} bad + 5) × 100`}</small>
      </div>

      <div className="ci-stats">
        {stats.map(([label, n, sub]) => (
          <div key={label}><b>{n}</b><span>{label}</span>{sub && <small>{sub}</small>}</div>
        ))}
      </div>
      {flags.length > 0
        ? <div className="ci-flags">{flags.map((f) => <span key={f}>{f}</span>)}</div>
        : <div className="ci-clean"><Glyph name="check" size={14} /> No claims, dropped deals or warnings</div>}

      <h4>Between you two</h4>
      {!together.length ? <p className="muted small">Nothing yet — this is your first deal together.</p> : (
        <ul className="ci-history">
          {together.map((h) => (
            <li key={`${h.type}-${h.id}`}>
              <span className="ci-h-title">{h.title || (h.type === 'sale' ? 'Item for sale' : 'Listing')}</span>
              <span className="muted small">
                {h.side}
                {h.type === 'rental' ? ` · ${String(h.start_date).slice(0, 10)} → ${String(h.end_date).slice(0, 10)}` : ` · ${money(h.price)}`}
              </span>
              <em className={`badge ${h.status}`}>{h.paid_at ? `${h.status} · paid` : h.status}</em>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

// A payment request in the chat: the owner / seller sent it, the other side
// taps Pay and goes to RentalFlow Pay.
function PayRequest({ m, mine }) {
  const p = m.payment;
  const status = p?.status || 'pending';
  return (
    <div className={`pay-req${mine ? ' me' : ''} ${status}`}>
      <div className="pay-req-top"><Glyph name="coin" size={18} /><b>Payment request</b>{p && <span className="pay-req-amt">{money(p.amount)}</span>}</div>
      <p translate="no">{m.body.replace(/^Payment request: \S+ for /, 'For ')}</p>
      {(p?.breakdown || []).length > 1 && (
        <ul className="pay-req-lines">{p.breakdown.map((l) => <li key={l.label}><span>{l.label}</span><b>{money(l.amount)}</b></li>)}</ul>
      )}
      {status === 'paid' ? <span className="pay-req-state ok"><Glyph name="check" size={14} /> Paid</span>
        : status === 'pending' ? (mine
          ? <span className="pay-req-state">Waiting for them to pay</span>
          : <Link to={`/pay/${p.tran}`} className="btn accent small">{`Pay ${money(p.amount)}`}</Link>)
          : <span className="pay-req-state">{status === 'refunded' ? 'Refunded' : 'No longer due'}</span>}
      <small>{when(m.created_at)}</small>
    </div>
  );
}

// An approved rental: the owner asks for the payment from here.
function RentPayBox({ convo, onSent }) {
  const [busy, setBusy] = useState(false);
  const p = convo.payment;
  async function send() {
    setBusy(true);
    try {
      const r = await api.post('/payments/request', { conversation_id: convo.id });
      play('send');
      say('Payment request sent', 'coin');
      onSent(r.message);
    } catch (e) { say(e.message, 'warn'); } finally { setBusy(false); }
  }
  if (!convo.iAmOwner) {
    return (
      <div className="deal-box done">
        <Glyph name="coin" size={18} /><b>{`Booking approved · ${money(p.amount)}`}</b>
        {p.requested
          ? <span className="deal-actions"><Link to={`/pay/${p.requested}`} className="btn accent small">{`Pay ${money(p.amount)}`}</Link></span>
          : <span>{`${convo.other_name} will send you a payment request here.`}</span>}
      </div>
    );
  }
  return (
    <div className="deal-box done">
      <Glyph name="coin" size={18} /><b>{`Approved · ${money(p.amount)} due`}</b>
      <span className="deal-actions">
        <button type="button" className="btn accent small" disabled={busy} onClick={send}>{p.requested ? 'Resend payment request' : 'Send payment request'}</button>
      </span>
    </div>
  );
}

// Who is asking to buy: shown to the seller next to the offer, like the renter
// check an owner sees before approving a rental.
function BuyerRecord({ who, r }) {
  return (
    <div className="buyer-record">
      <span className={r.verified ? 'ok' : ''}>{r.verified ? 'Fully verified' : 'Not verified yet'}</span>
      <span>{r.rentals === 1 ? '1 rental' : `${r.rentals} rentals`}{r.rentals_with_charges > 0 ? ` · ${r.rentals_with_charges} with charges` : ''}</span>
      <span>{`${r.bought} bought · ${r.sold} sold`}</span>
      {r.dropped > 0 && <span className="warn">{r.dropped === 1 ? '1 deal dropped' : `${r.dropped} deals dropped`}</span>}
      <small className="muted">{`About ${who}, before you accept.`}</small>
    </div>
  );
}

// A sale in the chat: the buyer makes an offer, the seller accepts or declines.
// Accepting marks the item sold, unlocks the chat and records the deal.
function DealBox({ convo, me, onChange }) {
  const navigate = useNavigate();
  const [price, setPrice] = useState(convo.sale?.price || '');
  const [busy, setBusy] = useState(false);
  const d = convo.deal;
  const buyer = convo.renter_id ? convo.renter_id === me.id : !convo.iAmOwner;
  async function offer() {
    setBusy(true);
    try { await api.post('/market/deals', { conversation_id: convo.id, price: Number(price) }); play('send'); onChange(); } catch (e) { say(e.message, 'warn'); } finally { setBusy(false); }
  }
  async function decide(decision) {
    setBusy(true);
    try {
      await api.post(`/market/deals/${d.id}/${decision}`, {});
      if (decision === 'accept') { play('success'); say('Deal done — contact details are now visible', 'coin'); }
      onChange();
    } catch (e) { say(e.message, 'warn'); } finally { setBusy(false); }
  }
  async function requestPay() {
    setBusy(true);
    try { await api.post('/payments/request', { conversation_id: convo.id }); play('send'); say('Payment request sent', 'coin'); onChange(); }
    catch (e) { say(e.message, 'warn'); } finally { setBusy(false); }
  }
  if (d && ['accepted', 'completed'].includes(d.status) && d.paid_at) {
    return <div className="deal-box done"><Glyph name="check" size={18} /><b>{`Paid ${money(d.price)} through RentalFlow Pay`}</b><span>RentalFlow holds it until the hand-over. Arrange it here.</span></div>;
  }
  if (d && ['accepted', 'completed'].includes(d.status)) {
    return (
      <div className="deal-box done">
        <Glyph name="coin" size={18} /><b>Deal agreed at {money(d.price)}</b>
        {buyer
          ? (convo.payment?.requested
            ? <span className="deal-actions"><button type="button" className="btn accent small" onClick={() => navigate(`/pay/${convo.payment.requested}`)}>{`Pay ${money(d.price)}`}</button></span>
            : <span>{`${convo.other_name} will send you a payment request here.`}</span>)
          : <span className="deal-actions"><button type="button" className="btn accent small" disabled={busy} onClick={requestPay}>{convo.payment?.requested ? 'Resend payment request' : 'Send payment request'}</button></span>}
      </div>
    );
  }
  if (d && d.status === 'offered') {
    return (
      <div className="deal-box">
        <Glyph name="sell" size={18} />
        <b>Offer: {money(d.price)}</b>
        {convo.iAmOwner && convo.buyer && <BuyerRecord who={convo.other_name} r={convo.buyer} />}
        {convo.iAmOwner ? (
          <span className="deal-actions">
            <button type="button" className="btn accent small" disabled={busy} onClick={() => decide('accept')}>Accept</button>
            <button type="button" className="btn ghost small" disabled={busy} onClick={() => decide('decline')}>Decline</button>
          </span>
        ) : <span className="muted">Waiting for {convo.other_name}</span>}
      </div>
    );
  }
  if (convo.iAmOwner || convo.sale?.sold) return null;
  return (
    <div className="deal-box">
      <Glyph name="sell" size={18} />
      <b>Make an offer</b>
      <span className="deal-actions">
        <span className="deal-input">৳<input type="number" min="1" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} /></span>
        <button type="button" className="btn accent small" disabled={busy || !(Number(price) > 0)} onClick={offer}>Send offer</button>
      </span>
    </div>
  );
}
