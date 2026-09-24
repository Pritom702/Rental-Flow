// ============================================================
//  RentalFlow  |  Community  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: admin moderation queue
// ============================================================
// Reported and auto-hidden posts and comments. An admin keeps them (restore),
// clears the reports (dismiss) or removes them; "Remove as adult content"
// also gives the author a strike — the first is a warning, the second a ban.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { play } from '../sfx.js';
import { timeAgo } from '../social/util.jsx';
import { say } from '../social/toast.js';

export default function Moderation() {
  const [data, setData] = useState(null);
  const load = useCallback(() => api.get('/community/moderation').then(setData).catch(() => setData({ posts: [], comments: [] })), []);
  useEffect(() => { load(); }, [load]);

  async function act(type, id, action, adult = false) {
    if (adult && !window.confirm('Remove as adult content? The author gets a strike: a warning the first time, a ban the second.')) return;
    await api.post(`/community/moderation/${type}/${id}`, { action, adult });
    play('success');
    say(action === 'remove' ? (adult ? 'Removed — author warned or banned' : 'Removed') : action === 'restore' ? 'Restored' : 'Reports cleared', '🛡️');
    load();
  }

  if (!data) return <div className="container"><div className="page-loading" /></div>;
  const empty = !data.posts.length && !data.comments.length;
  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Moderation</h1>
          <div className="sub">Posts and comments that members reported. Three reports hide something until you decide.</div>
        </div>
      </div>
      {empty && <div className="center-empty"><span style={{ fontSize: 34 }}>🧘</span><div className="empty-title">All clear</div>Nothing is waiting for review.</div>}
      <div className="mod-list">
        {data.posts.map((p) => (
          <Item key={`p${p.id}`} kind="Post" status={p.status} reports={p.reports} who={p.author_name} when={p.created_at} link={`/post/${p.id}`} where={`c/${p.community_slug}`}
            body={p.body} images={(p.attachments || []).filter((a) => a.type === 'image' || a.type === 'video')}
            onAct={(a, adult) => act('post', p.id, a, adult)} />
        ))}
        {data.comments.map((c) => (
          <Item key={`c${c.id}`} kind="Comment" status={c.status} reports={c.reports} who={c.author_name} when={c.created_at} link={`/post/${c.post_id}#c${c.id}`}
            body={c.body} images={[]} onAct={(a, adult) => act('comment', c.id, a, adult)} />
        ))}
      </div>
    </div>
  );
}

function Item({ kind, status, reports, who, when, link, where, body, images, onAct }) {
  const reasons = reports.reduce((m, r) => ({ ...m, [r.reason]: (m[r.reason] || 0) + 1 }), {});
  return (
    <div className={`mod-item${status === 'hidden' ? ' hidden' : ''}`}>
      <div className="mod-meta">
        <b>{kind}</b> by {who} {where && <>in {where}</>} · {timeAgo(when)}
        {status === 'hidden' && <span className="badge red">Hidden</span>}
        <Link to={link} className="mod-open">Open ›</Link>
      </div>
      <div className="mod-reasons">{Object.entries(reasons).map(([r, n]) => <span key={r} className="tag">{r} ×{n}</span>)}</div>
      {body && <p className="mod-body">{body}</p>}
      {images.length > 0 && (
        <div className="mod-images">{images.slice(0, 4).map((a) => <img key={a.url} src={a.type === 'video' ? a.poster : a.url} alt="" className="mod-blur" onClick={(e) => e.currentTarget.classList.toggle('mod-blur')} />)}</div>
      )}
      <div className="card-actions">
        <button type="button" className="btn small secondary" onClick={() => onAct(status === 'hidden' ? 'restore' : 'dismiss')}>{status === 'hidden' ? 'Restore' : 'Dismiss reports'}</button>
        <button type="button" className="btn small danger" onClick={() => onAct('remove')}>Remove</button>
        <button type="button" className="btn small danger" onClick={() => onAct('remove', true)}>Remove as adult content</button>
      </div>
    </div>
  );
}
