// ============================================================
//  RentalFlow  |  Messaging  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: conversations list + chat thread
// ============================================================
// Computer: conversations on the left, the open chat on the right.
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
              : <span className="muted">This listing was removed</span>}
        </div>
        <button type="button" className="btn ghost small thread-report" onClick={reportOutside} title="They asked me to pay outside RentalFlow">
          <Glyph name="flag" size={15} /> Report
        </button>
      </header>

      {!convo.unlocked && (
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
      {error && <div className="error">{error}</div>}
    </div>
  );
}

// A sale in the chat: the buyer makes an offer, the seller accepts or declines.
// Accepting marks the item sold, unlocks the chat and records the deal.
function DealBox({ convo, me, onChange }) {
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
  if (d && ['accepted', 'completed'].includes(d.status)) {
    return <div className="deal-box done"><Glyph name="coin" size={18} /><b>Deal agreed at {money(d.price)}</b><span>Arrange the hand-over here — check the item before you pay.</span></div>;
  }
  if (d && d.status === 'offered') {
    return (
      <div className="deal-box">
        <Glyph name="sell" size={18} />
        <b>Offer: {money(d.price)}</b>
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
