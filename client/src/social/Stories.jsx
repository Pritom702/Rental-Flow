// ============================================================
//  RentalFlow  |  Community  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: moments — photos that last 24 hours
// ============================================================
// A row of circles on top of the feed (a lime ring = something new), and a
// full-screen viewer: bars along the top fill as each moment plays, tap the
// right side for next / left for back, hold to pause, swipe down to close.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Icon } from '../icons.jsx';
import { play } from '../sfx.js';
import { Avatar, timeAgo } from './util.jsx';
import { shrinkImage, uploadFile } from './media.js';
import { say } from './toast.js';
import { Glyph } from './glyphs.jsx';
import { useMe } from './store.js';

const STORY_MS = 5000;

export default function StoriesRow() {
  const { user } = useAuth();
  const me = useMe();
  const [groups, setGroups] = useState(null);
  const [open, setOpen] = useState(null);           // index of the group being watched
  const [adding, setAdding] = useState(false);
  const input = useRef(null);

  const load = useCallback(() => api.get('/community/stories').then(setGroups).catch(() => setGroups([])), []);
  useEffect(() => { load(); }, [load]);

  async function add(file) {
    if (!file) return;
    setAdding(true);
    try {
      const shrunk = await shrinkImage(file, 1440);
      const up = await uploadFile(shrunk.file, { imagesOnly: true });
      const caption = window.prompt('Add a caption (optional)', '') || '';
      await api.post('/community/stories', { image_url: up.url, caption, color: shrunk.color });
      play('send');
      say('Your moment is live for 24 hours', 'sparkle');
      load();
    } catch (e) {
      say(e.message, 'warn');
    } finally {
      setAdding(false);
    }
  }

  if (!groups) return <div className="stories-row skeleton-row" aria-hidden="true">{[0, 1, 2, 3, 4].map((i) => <span key={i} className="story-skel" />)}</div>;
  const mine = groups.find((g) => g.mine);
  if (!user && groups.length === 0) return null;

  return (
    <>
      <div className="stories-row" role="list">
        {user && !mine && (
          <button type="button" className="story-bubble add" onClick={() => input.current?.click()} disabled={adding} role="listitem">
            <span className="story-ring none"><Avatar id={user.id} name={user.name} src={me?.avatar_url} size={58} /><span className="story-plus">{adding ? '…' : '+'}</span></span>
            <span className="story-name">{adding ? 'Posting…' : 'Your moment'}</span>
          </button>
        )}
        {groups.map((g, i) => (
          <button type="button" key={g.user_id} className="story-bubble" onClick={() => setOpen(i)} role="listitem">
            <span className={`story-ring${g.unseen ? '' : ' seen'}`}><Avatar id={g.user_id} name={g.name} src={g.avatar_url} size={58} /></span>
            <span className="story-name">{g.mine ? 'You' : g.name.split(' ')[0]}</span>
          </button>
        ))}
        {user && mine && (
          <button type="button" className="story-bubble add small" onClick={() => input.current?.click()} disabled={adding} role="listitem" aria-label="Add another moment">
            <span className="story-ring none"><span className="story-plus big">{adding ? '…' : '+'}</span></span>
            <span className="story-name">Add</span>
          </button>
        )}
        <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { add(e.target.files[0]); e.target.value = ''; }} />
      </div>
      {open != null && groups[open] && (
        <StoryViewer
          groups={groups}
          start={open}
          onClose={() => { setOpen(null); load(); }}
        />
      )}
    </>
  );
}

function StoryViewer({ groups, start, onClose }) {
  const { user } = useAuth();
  const [g, setG] = useState(start);
  const [s, setS] = useState(() => Math.max(0, groups[start].stories.findIndex((x) => !x.seen)));
  const [paused, setPaused] = useState(false);
  const [t, setT] = useState(0);
  const touchY = useRef(null);
  const group = groups[g];
  const story = group.stories[s];

  const next = useCallback(() => {
    if (s < group.stories.length - 1) { setS(s + 1); setT(0); return; }
    if (g < groups.length - 1) { setG(g + 1); setS(0); setT(0); return; }
    onClose();
  }, [s, g, group, groups.length, onClose]);
  const prev = () => {
    if (s > 0) { setS(s - 1); setT(0); return; }
    if (g > 0) { setG(g - 1); setS(groups[g - 1].stories.length - 1); setT(0); }
  };

  // Mark as seen (once) and run the timer.
  useEffect(() => {
    if (user && !story.seen && story.user_id !== user.id) api.post(`/community/stories/${story.id}/view`, {}).catch(() => {});
    story.seen = true;
  }, [story, user]);
  useEffect(() => {
    if (paused) return undefined;
    let raf;
    let last = performance.now();
    const tick = (now) => {
      setT((v) => {
        const nv = v + (now - last) / STORY_MS;
        last = now;
        return nv;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, g, s]);
  useEffect(() => { if (t >= 1) next(); }, [t, next]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  async function remove() {
    if (!window.confirm('Delete this moment?')) return;
    await api.del(`/community/stories/${story.id}`);
    onClose();
  }

  return (
    <div
      className="story-viewer"
      style={{ background: story.color || '#0c1511' }}
      onPointerDown={() => setPaused(true)}
      onPointerUp={() => setPaused(false)}
      onTouchStart={(e) => { touchY.current = e.touches[0].clientY; }}
      onTouchEnd={(e) => { if (touchY.current != null && e.changedTouches[0].clientY - touchY.current > 90) onClose(); touchY.current = null; }}
      role="dialog"
      aria-label={`Moment from ${group.name}`}
    >
      <div className="sv-bars">
        {group.stories.map((x, i) => (
          <span key={x.id}><i style={{ transform: `scaleX(${i < s ? 1 : i === s ? Math.min(1, t) : 0})` }} /></span>
        ))}
      </div>
      <div className="sv-head">
        <Link to={`/u/${group.handle || group.user_id}`} onClick={onClose} className="sv-who">
          <Avatar id={group.user_id} name={group.name} src={group.avatar_url} size={34} />
          <b>{group.name}</b><span>{timeAgo(story.created_at)}</span>
        </Link>
        <span className="spacer" />
        {story.user_id === user?.id && <span className="sv-views"><Glyph name="eye" size={16} /> {story.view_count}</span>}
        {(story.user_id === user?.id || user?.role === 'admin') && <button type="button" className="sv-btn" onClick={(e) => { e.stopPropagation(); remove(); }} aria-label="Delete"><Glyph name="trash" size={18} /></button>}
        <button type="button" className="sv-btn" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Close"><Icon name="close" size={20} /></button>
      </div>
      <img key={story.id} src={story.image_url} alt="" className="sv-img" draggable="false" />
      {story.caption && <div className="sv-caption">{story.caption}</div>}
      {story.item_id && story.item_name && (
        <Link to={`/product/${story.item_id}`} className="sv-item" onClick={onClose}><Glyph name="rent" size={16} /> {story.item_name} <span>Rent it ›</span></Link>
      )}
      <button type="button" className="sv-tap left" onClick={(e) => { e.stopPropagation(); prev(); }} aria-label="Previous" data-sfx="none" />
      <button type="button" className="sv-tap right" onClick={(e) => { e.stopPropagation(); next(); }} aria-label="Next" data-sfx="none" />
    </div>
  );
}
