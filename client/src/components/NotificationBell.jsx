// ============================================================
//  RentalFlow  |  Sprint 4  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: Notification bell (booking requests + decisions)
// ============================================================
// Sits in the top nav. Polls the notification feed, shows an unread count, and
// opens a dropdown listing what happened. Styles live in this file so the
// component can be dropped into the nav without touching the design system.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

const POLL_MS = 20000;

const STYLES = `
.bell-wrap { position: relative; display: inline-flex; }
.bell-btn {
  position: relative; display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border-radius: 10px; cursor: pointer;
  background: transparent; border: 1px solid var(--border); color: var(--text);
  transition: background .18s, border-color .18s;
}
.bell-btn:hover { background: var(--surface-2); border-color: var(--primary); }
.bell-count {
  position: absolute; top: -6px; right: -6px; min-width: 18px; height: 18px; padding: 0 5px;
  border-radius: 999px; background: var(--red); color: #fff;
  font-size: 11px; font-weight: 700; line-height: 18px; text-align: center;
}
.bell-panel {
  position: absolute; top: 44px; right: 0; width: min(380px, 88vw); z-index: 80;
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
  box-shadow: var(--shadow-lg); overflow: hidden;
}
.bell-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 14px; border-bottom: 1px solid var(--border); font-weight: 700; font-size: 14px;
}
.bell-mark {
  background: none; border: none; cursor: pointer; color: var(--primary);
  font-size: 12.5px; font-weight: 600; font-family: inherit;
}
.bell-list { max-height: 60vh; overflow-y: auto; }
.bell-item {
  display: block; width: 100%; text-align: left; padding: 12px 14px; cursor: pointer;
  background: none; border: none; border-bottom: 1px solid var(--border);
  font-family: inherit; color: var(--text);
}
.bell-item:hover { background: var(--bg-tint); }
.bell-item.unread { background: var(--primary-soft); }
.bell-item.unread:hover { background: var(--primary-soft); filter: brightness(.97); }
.bell-title { font-weight: 600; font-size: 13.5px; margin-bottom: 3px; }
.bell-body { font-size: 12.5px; color: var(--muted); line-height: 1.45; }
.bell-time { font-size: 11.5px; color: var(--muted); margin-top: 5px; }
.bell-empty { padding: 26px 14px; text-align: center; color: var(--muted); font-size: 13.5px; }
`;

// "just now" / "5m ago" / "2h ago" / date
function timeAgo(iso) {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const wrapRef = useRef(null);

  async function load() {
    try {
      const data = await api.get('/notifications?limit=20');
      setItems(data.notifications);
      setUnread(data.unread);
    } catch {
      // A failed poll must not break the nav — try again on the next tick.
    }
  }

  // Poll while signed in so an approval shows up without a page refresh.
  useEffect(() => {
    if (!user) return undefined;
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [user]);

  // Click outside closes the panel.
  useEffect(() => {
    if (!open) return undefined;
    function onDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  if (!user) return null;

  async function openItem(n) {
    setOpen(false);
    if (!n.read_at) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      setUnread((c) => Math.max(0, c - 1));
      try { await api.patch(`/notifications/${n.id}/read`, {}); } catch { /* stays unread, retried on next poll */ }
    }
    navigate('/bookings');
  }

  async function markAll() {
    setItems((prev) => prev.map((x) => ({ ...x, read_at: x.read_at || new Date().toISOString() })));
    setUnread(0);
    try { await api.post('/notifications/read-all', {}); } catch { load(); }
  }

  return (
    <div className="bell-wrap" ref={wrapRef}>
      <style>{STYLES}</style>
      <button
        className="bell-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread ? `${unread} unread notifications` : 'Notifications'}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5" />
          <path d="M10.5 19a2 2 0 0 0 3 0" />
        </svg>
        {unread > 0 && <span className="bell-count">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="bell-panel">
          <div className="bell-head">
            <span>Notifications</span>
            {unread > 0 && <button className="bell-mark" onClick={markAll}>Mark all read</button>}
          </div>
          <div className="bell-list">
            {items.length === 0 ? (
              <div className="bell-empty">Nothing yet. Booking requests and approvals show up here.</div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  className={`bell-item ${n.read_at ? '' : 'unread'}`}
                  onClick={() => openItem(n)}
                >
                  <div className="bell-title">{n.title}</div>
                  <div className="bell-body">{n.body}</div>
                  <div className="bell-time">{timeAgo(n.created_at)}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
