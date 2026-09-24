// ============================================================
//  RentalFlow  |  Community  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: one post, with its comments and replies
// ============================================================
// /post/:id — the link people share. Comments show one level of replies;
// a heart likes a comment; the box at the bottom stays in reach on phones.
// New comments from others appear every 20 seconds while you are here.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Icon } from '../icons.jsx';
import { play } from '../sfx.js';
import { burst } from '../fx.js';
import PostCard from '../social/PostCard.jsx';
import { Avatar, RichText, VerifiedTick, timeAgo } from '../social/util.jsx';
import { say } from '../social/toast.js';
import { PostSkeleton } from './Feed.jsx';

export default function PostPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { hash, pathname } = useLocation();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [sending, setSending] = useState(false);
  const box = useRef(null);

  const load = useCallback(() => api.get(`/community/posts/${id}`)
    .then((p) => { const { comments: c, ...rest } = p; setPost(rest); setComments(c); })
    .catch((e) => setError(e.message)), [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) load(); }, 20000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!post) return;
    if (hash === '#reply') setTimeout(() => box.current?.focus(), 150);
    const m = hash.match(/^#c(\d+)/);
    if (m) setTimeout(() => document.getElementById(`c${m[1]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
  }, [post, hash]);

  async function send(e) {
    e.preventDefault();
    if (!user) { navigate(`/login?mode=signup&next=${encodeURIComponent(pathname)}`); return; }
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      const c = await api.post(`/community/posts/${id}/comments`, { body, parent_id: replyTo?.id });
      setComments((all) => [...all, c]);
      setPost((p) => ({ ...p, comment_count: p.comment_count + 1 }));
      setText('');
      setReplyTo(null);
      play('send');
      setTimeout(() => document.getElementById(`c${c.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
    } catch (err) {
      say(err.message, '⚠️');
    } finally {
      setSending(false);
    }
  }

  async function like(c, e) {
    if (!user) { navigate(`/login?mode=signup&next=${encodeURIComponent(pathname)}`); return; }
    const liked = !c.liked;
    setComments((all) => all.map((x) => (x.id === c.id ? { ...x, liked, like_count: x.like_count + (liked ? 1 : -1) } : x)));
    if (liked) { play('pop'); burst(e.clientX, e.clientY, '❤️', 6); }
    try {
      const r = await api.post(`/community/comments/${c.id}/like`, {});
      setComments((all) => all.map((x) => (x.id === c.id ? { ...x, ...r } : x)));
    } catch { load(); }
  }
  async function remove(c) {
    if (!window.confirm('Delete this comment?')) return;
    await api.del(`/community/comments/${c.id}`);
    setComments((all) => all.map((x) => (x.id === c.id ? { ...x, status: 'removed' } : x)));
    setPost((p) => ({ ...p, comment_count: Math.max(0, p.comment_count - 1) }));
  }
  async function report(c) {
    if (!user) return;
    await api.post('/community/report', { comment_id: c.id, reason: 'abuse' });
    say('Thanks — our team will take a look', '🛡️');
  }
  function reply(c) {
    setReplyTo(c);
    setText(c.author_handle && c.author_id !== user?.id ? `@${c.author_handle} ` : '');
    setTimeout(() => box.current?.focus(), 30);
  }

  if (error) return <div className="container"><div className="center-empty"><span style={{ fontSize: 34 }}>🫥</span><div className="empty-title">{error}</div><Link to="/feed" className="btn">Back to the feed</Link></div></div>;
  if (!post) return <div className="container feed-page narrow"><PostSkeleton /></div>;

  const visible = comments.filter((c) => c.status !== 'removed');
  const top = visible.filter((c) => !c.parent_id);
  const replies = (pid) => visible.filter((c) => c.parent_id === pid);

  return (
    <div className="container feed-page narrow">
      <button type="button" className="btn ghost small" onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/feed'))}>← Back</button>
      <PostCard post={post} full onChange={setPost} onRemove={() => navigate('/feed')} />

      <section className="comments" aria-label="Comments">
        <h2>{post.comment_count ? `${post.comment_count} comment${post.comment_count === 1 ? '' : 's'}` : 'No comments yet'}</h2>
        {top.length === 0 && <p className="muted">Be the first — people love a reply. 💬</p>}
        {top.map((c) => (
          <div key={c.id} className="c-thread">
            <Comment c={c} me={user} onLike={like} onReply={reply} onDelete={remove} onReport={report} />
            {replies(c.id).length > 0 && (
              <div className="c-replies">
                {replies(c.id).map((r) => <Comment key={r.id} c={r} me={user} onLike={like} onReply={reply} onDelete={remove} onReport={report} />)}
              </div>
            )}
          </div>
        ))}
      </section>

      <form className="comment-box" onSubmit={send} id="reply">
        {replyTo && (
          <div className="reply-to">Replying to <b>{replyTo.author_name}</b> <button type="button" onClick={() => { setReplyTo(null); setText(''); }} aria-label="Cancel reply"><Icon name="close" size={12} /></button></div>
        )}
        <div className="cb-row">
          {user && <Avatar id={user.id} name={user.name} size={34} />}
          <textarea
            ref={box}
            rows={1}
            value={text}
            maxLength={2000}
            placeholder={user ? (replyTo ? 'Write a reply…' : 'Add a comment…') : 'Sign up to join the conversation'}
            onChange={(e) => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(160, e.target.scrollHeight)}px`; }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e); } }}
          />
          <button type="submit" className="btn accent small" disabled={sending || (user && !text.trim())} data-sfx="none">{user ? 'Send' : 'Sign up'}</button>
        </div>
      </form>
    </div>
  );
}

function Comment({ c, me, onLike, onReply, onDelete, onReport }) {
  const mine = me && me.id === c.author_id;
  return (
    <div className={`comment${c.status === 'hidden' ? ' is-hidden' : ''}`} id={`c${c.id}`}>
      <Link to={`/u/${c.author_handle || c.author_id}`}><Avatar id={c.author_id} name={c.author_name} size={34} /></Link>
      <div className="c-main">
        <div className="c-bubble">
          <Link to={`/u/${c.author_handle || c.author_id}`} className="c-name">{c.author_name}{c.author_verified && <VerifiedTick />}</Link>
          <div className="c-text"><RichText text={c.body} /></div>
        </div>
        <div className="c-actions">
          <span className="muted">{timeAgo(c.created_at)}</span>
          <button type="button" onClick={() => onReply(c)}>Reply</button>
          {mine || me?.role === 'admin'
            ? <button type="button" onClick={() => onDelete(c)}>Delete</button>
            : me && <button type="button" onClick={() => onReport(c)}>Report</button>}
        </div>
      </div>
      <button type="button" className={`c-like${c.liked ? ' on' : ''}`} onClick={(e) => onLike(c, e)} aria-label={c.liked ? 'Unlike' : 'Like'} data-sfx="none">
        <span>{c.liked ? '❤️' : '🤍'}</span>{c.like_count > 0 && <small>{c.like_count}</small>}
      </button>
    </div>
  );
}
