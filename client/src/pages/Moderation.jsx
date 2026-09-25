// ============================================================
//  RentalFlow  |  Community  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: admin console — queue, members, communities, report
// ============================================================
// The platform admin's control room.
//   Queue        reported posts and comments, and photos the automatic check
//                was unsure about — most likely problems first, each with the
//                moderation model's guess and the reasons behind it
//   Members      find anyone; warn, ban or unban; see their history
//   Communities  create a new community
//   Report       what the model learned from your decisions, and what to do next
// Every remove / keep decision teaches the model (server: moderationModel.js).
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { play } from '../sfx.js';
import { Avatar, timeAgo } from '../social/util.jsx';
import { say } from '../social/toast.js';
import { Glyph } from '../social/glyphs.jsx';

const TABS = [
  ['queue', 'Queue', 'shield'],
  ['members', 'Members', 'people'],
  ['communities', 'Communities', 'plus'],
  ['report', 'Report', 'trend'],
];

export default function Moderation() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'queue';
  return (
    <div className="container admin-console">
      <div className="page-head">
        <div>
          <h1>Moderation</h1>
          <div className="sub">You have the last word: remove or keep content, warn or ban members, create communities. Every decision teaches the moderation model.</div>
        </div>
      </div>
      <div className="seg admin-tabs" role="tablist">
        {TABS.map(([k, label, glyph]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setParams({ tab: k })}>
            <Glyph name={glyph} size={15} /> {label}
          </button>
        ))}
      </div>
      {tab === 'queue' && <Queue />}
      {tab === 'members' && <Members />}
      {tab === 'communities' && <Communities />}
      {tab === 'report' && <Report />}
    </div>
  );
}

// ---------------------------------------------------------------- queue

function Queue() {
  const [cases, setCases] = useState(null);
  const load = useCallback(() => api.get('/moderation/queue').then((r) => setCases(r.cases)).catch((e) => { say(e.message, 'warn'); setCases([]); }), []);
  useEffect(() => { load(); }, [load]);

  async function act(c, action, adult = false) {
    if (adult && !window.confirm('Remove as adult content? The author gets a strike: a warning the first time, a ban the second.')) return;
    try {
      await api.post(`/moderation/cases/${c.type}/${c.id}`, { action, adult });
      play('success');
      say(action === 'remove' ? (adult ? 'Removed — author warned or banned' : 'Removed') : action === 'approve' ? 'Photo kept' : action === 'restore' ? 'Restored' : 'Reports cleared', 'shield');
      setCases((list) => list.filter((x) => !(x.type === c.type && x.id === c.id)));
    } catch (e) { say(e.message, 'warn'); }
  }

  if (!cases) return <div className="page-loading" />;
  if (!cases.length) return <div className="center-empty"><Glyph name="shield" size={40} /><div className="empty-title">All clear</div>Nothing is waiting for review.</div>;
  return (
    <div className="mod-list">
      {cases.map((c) => <Case key={`${c.type}${c.id}`} c={c} onAct={(a, adult) => act(c, a, adult)} />)}
    </div>
  );
}

function Case({ c, onAct }) {
  const reasons = (c.reports || []).reduce((m, r) => ({ ...m, [r.reason]: (m[r.reason] || 0) + 1 }), {});
  const images = c.type === 'photo' ? [{ url: c.url }] : (c.attachments || []).filter((a) => a.type === 'image' || a.type === 'video').map((a) => ({ url: a.type === 'video' ? a.poster : a.url }));
  const kind = c.type === 'photo' ? `Flagged ${c.place}` : c.type === 'post' ? 'Post' : 'Comment';
  const link = c.type === 'post' ? `/post/${c.id}` : c.type === 'comment' ? `/post/${c.post_id}#c${c.id}` : null;
  const pct = c.p == null ? null : Math.round(c.p * 100);
  return (
    <div className={`mod-item${c.status === 'hidden' ? ' hidden' : ''}`}>
      <div className="mod-meta">
        <b>{kind}</b> by {c.author_name} {c.community_slug && <>in {c.community_slug}</>} · {timeAgo(c.created_at)}
        {c.status === 'hidden' && <span className="badge red">Hidden</span>}
        {link && <Link to={link} className="mod-open">Open ›</Link>}
      </div>
      {pct != null && (
        <div className={`mod-guess${pct >= 70 ? ' high' : pct <= 30 ? ' low' : ''}`}>
          <span className="mod-meter"><i style={{ width: `${pct}%` }} /></span>
          <b>{pct}%</b> likely to be removed
          {c.why?.length > 0 && <span className="mod-why">{c.why.map((w) => <em key={w.label} className={w.up ? 'up' : 'down'}>{w.up ? '▲' : '▼'} {w.label}</em>)}</span>}
        </div>
      )}
      {Object.keys(reasons).length > 0 && <div className="mod-reasons">{Object.entries(reasons).map(([r, n]) => <span key={r} className="tag">{r} ×{n}</span>)}</div>}
      {c.body && <p className="mod-body" translate="no">{c.body}</p>}
      {images.length > 0 && (
        <div className="mod-images">{images.slice(0, 4).map((a) => <img key={a.url} src={a.url} alt="" className="mod-blur" title="Tap to show" onClick={(e) => e.currentTarget.classList.toggle('mod-blur')} />)}</div>
      )}
      <div className="card-actions">
        {c.type === 'photo' ? (
          <>
            <button type="button" className="btn small secondary" onClick={() => onAct('approve')}>Keep photo</button>
            <button type="button" className="btn small danger" onClick={() => onAct('remove')}>Remove photo</button>
            <button type="button" className="btn small danger" onClick={() => onAct('remove', true)}>Remove as adult content</button>
          </>
        ) : (
          <>
            <button type="button" className="btn small secondary" onClick={() => onAct(c.status === 'hidden' ? 'restore' : 'dismiss')}>{c.status === 'hidden' ? 'Restore' : 'Dismiss reports'}</button>
            <button type="button" className="btn small danger" onClick={() => onAct('remove')}>Remove</button>
            <button type="button" className="btn small danger" onClick={() => onAct('remove', true)}>Remove as adult content</button>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- members

function Members() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(null);      // member id whose history is open
  const [history, setHistory] = useState([]);
  const load = useCallback((text) => api.get(`/moderation/users?q=${encodeURIComponent(text)}`).then(setRows).catch(() => setRows([])), []);
  useEffect(() => { const t = setTimeout(() => load(q), 250); return () => clearTimeout(t); }, [q, load]);

  async function act(u, action) {
    let reason = null;
    if (action === 'warn') {
      reason = window.prompt(`Warning to ${u.name} — what should they fix?`, 'Please follow the community rules.');
      if (!reason) return;
    } else if (action === 'ban') {
      reason = window.prompt(`Ban ${u.name}? They will be signed out and blocked. Reason:`, 'Repeatedly broke the community rules.');
      if (!reason) return;
    } else if (!window.confirm(`Lift the ban on ${u.name}?`)) return;
    try {
      await api.post(`/moderation/users/${u.id}/${action}`, { reason });
      play('success');
      say(action === 'warn' ? `${u.name} was warned` : action === 'ban' ? `${u.name} was banned` : `${u.name} can use RentalFlow again`, 'shield');
      load(q);
      if (open === u.id) showHistory(u.id, true);
    } catch (e) { say(e.message, 'warn'); }
  }
  async function showHistory(id, force = false) {
    if (open === id && !force) { setOpen(null); return; }
    setOpen(id);
    setHistory(await api.get(`/moderation/users/${id}/history`).catch(() => []));
  }

  return (
    <div>
      <input className="admin-search" placeholder="Search by name, email or @handle…" value={q} onChange={(e) => setQ(e.target.value)} />
      {!rows ? <div className="page-loading" /> : !rows.length ? <p className="muted">No members match.</p> : (
        <div className="member-list">
          {rows.map((u) => (
            <div key={u.id} className={`member-row${u.status === 'suspended' ? ' banned' : ''}`}>
              <Avatar id={u.id} name={u.name} src={u.avatar_url} size={40} />
              <div className="member-who">
                <b translate="no">{u.name}</b>
                <span className="muted small" translate="no">{u.email}{u.handle ? ` · @${u.handle}` : ''}</span>
                <span className="member-tags">
                  {u.role !== 'member' && <em className="tag">{u.role}</em>}
                  {u.status === 'suspended' && <em className="tag red">Banned</em>}
                  {u.verified && <em className="tag">Verified</em>}
                  {u.warning_count > 0 && <em className="tag amber">{u.warning_count} warning{u.warning_count === 1 ? '' : 's'}</em>}
                  {u.content_strikes > 0 && <em className="tag amber">{u.content_strikes} strike{u.content_strikes === 1 ? '' : 's'}</em>}
                  {u.removals > 0 && <em className="tag">{u.removals} removed</em>}
                  <em className="tag">{u.posts} posts</em>
                </span>
              </div>
              <div className="member-actions">
                <button type="button" className="btn ghost small" onClick={() => showHistory(u.id)}>{open === u.id ? 'Hide history' : 'History'}</button>
                {u.role !== 'admin' && (
                  <>
                    <button type="button" className="btn secondary small" onClick={() => act(u, 'warn')}>Warn</button>
                    {u.status === 'suspended'
                      ? <button type="button" className="btn accent small" onClick={() => act(u, 'unban')}>Unban</button>
                      : <button type="button" className="btn danger small" onClick={() => act(u, 'ban')}>Ban</button>}
                  </>
                )}
              </div>
              {open === u.id && (
                <div className="member-history">
                  {!history.length ? <span className="muted small">No moderation history.</span> : history.map((h, i) => (
                    <div key={i} className="small"><b>{ACTION_LABEL[h.action] || h.action}</b>{h.reason ? ` — ${h.reason}` : ''} <span className="muted">· {h.admin_name || 'system'} · {timeAgo(h.created_at)}</span></div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const ACTION_LABEL = {
  remove: 'Content removed', remove_adult: 'Removed as adult content', restore: 'Content restored', dismiss: 'Reports dismissed',
  approve_photo: 'Flagged photo kept', remove_photo: 'Photo removed', warn: 'Warned', ban: 'Banned', unban: 'Ban lifted',
};

// ---------------------------------------------------------------- communities

function Communities() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState([]);
  const load = useCallback(() => api.get('/community/communities').then(setList).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  async function create(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const c = await api.post('/moderation/communities', { name, description });
      play('success');
      say(`${c.name} is live`, 'sparkle');
      setName(''); setDescription('');
      load();
    } catch (err) { say(err.message, 'warn'); }
    setBusy(false);
  }

  return (
    <div className="admin-two">
      <form className="card admin-form" onSubmit={create}>
        <h3>Create a community</h3>
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Wedding photographers" required />
        <label>Description <span className="muted">(optional)</span></label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} rows={3} placeholder="What people share and ask about here" />
        <button className="btn accent" disabled={busy || name.trim().length < 3}>{busy ? 'Creating…' : 'Create community'}</button>
      </form>
      <div className="card">
        <h3>All communities ({list.length})</h3>
        <div className="admin-communities">
          {list.map((c) => (
            <Link key={c.slug} to={`/c/${c.slug}`} className="admin-community"><b>{c.name}</b><span className="muted small">{c.member_count} members · {c.post_count} posts</span></Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- report

function Report() {
  const [days, setDays] = useState(7);
  const [r, setR] = useState(null);
  useEffect(() => { setR(null); api.get(`/moderation/report?days=${days}`).then(setR).catch((e) => say(e.message, 'warn')); }, [days]);
  if (!r) return <div className="page-loading" />;
  const s = r.summary;
  const agree = r.learning.agreement;
  return (
    <div className="mod-report">
      <div className="seg">
        {[7, 30, 90].map((d) => <button key={d} type="button" className={days === d ? 'on' : ''} onClick={() => setDays(d)}>Last {d} days</button>)}
      </div>

      <div className="card report-advice">
        <h3><Glyph name="sparkle" size={18} /> What to do next</h3>
        <ul>{r.advice.map((a) => <li key={a}>{a}</li>)}</ul>
      </div>

      <div className="stat-row report-stats">
        <Stat label="Decisions" value={s.decisions} hint={`${s.removed} removed · ${s.kept} kept`} />
        <Stat label="Warnings" value={s.warnings} hint="sent by an admin" />
        <Stat label="Bans" value={s.bans} hint={s.unbans ? `${s.unbans} lifted` : 'accounts blocked'} />
        <Stat label="Waiting" value={s.waiting} hint="in the queue now" />
      </div>

      <div className="admin-two">
        <div className="card">
          <h3>What the model has learned</h3>
          <p className="muted small">
            Trained on {r.learning.examples} of your decisions.
            {agree.rate != null ? <> Before each decision it guessed right <b>{agree.rate}%</b> of the time ({agree.agreed} of {agree.judged}).</> : ' It has not been graded yet — it guesses before every decision, then checks.'}
          </p>
          {r.learning.lessons.length ? (
            <ul className="report-lessons">{r.learning.lessons.map((l) => <li key={l.key}>{l.text}</li>)}</ul>
          ) : <p className="muted small">No lessons yet — it still weighs things the way it started.</p>}
          <details className="report-weights">
            <summary>Every signal it weighs</summary>
            <table className="data-table">
              <thead><tr><th>Signal</th><th>Started at</th><th>Now</th></tr></thead>
              <tbody>{r.learning.weights.map((w) => <tr key={w.key}><td>{w.label}</td><td>{w.prior}</td><td className={w.now > w.prior + 0.1 ? 'up' : w.now < w.prior - 0.1 ? 'down' : ''}>{w.now}</td></tr>)}</tbody>
            </table>
          </details>
        </div>
        <div className="card">
          <h3>Members to keep an eye on</h3>
          {!r.watch.length ? <p className="muted small">No one stands out.</p> : (
            <div className="report-watch">{r.watch.map((u) => (
              <div key={u.user_id}><b translate="no">{u.name}</b><span className="muted small">{[u.removals && `${u.removals} removed`, u.warnings && `${u.warnings} warned`, u.likely && `${u.likely} likely in queue`].filter(Boolean).join(' · ')}</span></div>
            ))}</div>
          )}
          <h3 style={{ marginTop: 18 }}>Reports by reason</h3>
          {!r.reasons.length ? <p className="muted small">No decided reports in this period.</p> : (
            <table className="data-table">
              <thead><tr><th>Reason</th><th>Upheld</th><th>Dismissed</th></tr></thead>
              <tbody>{r.reasons.map((x) => <tr key={x.reason}><td>{x.reason}</td><td>{x.upheld}</td><td>{x.dismissed}</td></tr>)}</tbody>
            </table>
          )}
          <h3 style={{ marginTop: 18 }}>Automatic photo check</h3>
          <p className="muted small">
            {r.photos.approved + r.photos.removed === 0 ? 'No flagged photos were decided in this period.' : <>You kept {r.photos.approved} and removed {r.photos.removed} of the photos it flagged{r.photos.false_alarm_rate != null ? ` (${r.photos.false_alarm_rate}% were fine)` : ''}.</>}
            {r.photos.pending ? ` ${r.photos.pending} waiting.` : ''}
          </p>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }) {
  return <div className="stat-tile"><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-hint">{hint}</div></div>;
}
