// ============================================================
//  RentalFlow  |  Community  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: write a post (text, media, poll, sale, ...)
// ============================================================
// One sheet for every kind of post. Photos are shrunk on the device and
// uploaded while you keep typing; a video shows its upload progress; a link
// in the text grows a preview card; @ suggests people. What you type is kept
// as a draft if you close the sheet by accident.
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Icon } from '../icons.jsx';
import { money } from '../money.js';
import { play } from '../sfx.js';
import { CONDITIONS, KINDS, Avatar } from './util.jsx';
import { fileSize, readVideo, shrinkImage, uploadFile, uploadVideo, duration as fmt } from './media.js';
import { loadMe, setMe, useMe } from './store.js';
import { Glyph } from './glyphs.jsx';
import { say } from './toast.js';
import SellerGate, { useSellerGate } from './SellerGate.jsx';

const DRAFT_KEY = 'rentalflow_post_draft';
const URL_RE = /https?:\/\/[^\s<]+[^\s<.,:;"')\]!?]/;
const DOC_ACCEPT = '.pdf,.doc,.docx,.xlsx,.pptx,.txt,.csv,.md';

function readDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { return null; }
}

export default function Composer({ open, onClose, onCreated, community: fixedCommunity, startKind = 'post', startWith }) {
  const { user } = useAuth();
  const me = useMe();
  const [communities, setCommunities] = useState([]);
  const draft = useMemo(() => (open ? readDraft() : null), [open]);
  const [kind, setKind] = useState(startKind);
  const [community, setCommunity] = useState(fixedCommunity || draft?.community || '');
  const [body, setBody] = useState(draft?.body || '');
  const [media, setMedia] = useState([]);          // { id, kind: image|video|file, preview, status, progress, result, error }
  const [link, setLink] = useState(null);           // preview object
  const [dismissedLink, setDismissedLink] = useState(null);
  const [poll, setPoll] = useState(['', '']);
  const [wanted, setWanted] = useState({ budget: '', from: '', to: '', area: '' });
  const [sale, setSale] = useState({ price: '', condition: 'good', negotiable: true });
  const [item, setItem] = useState(null);
  const [itemSearch, setItemSearch] = useState('');
  const [itemResults, setItemResults] = useState([]);
  const [mention, setMention] = useState(null);     // { q, results }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Selling needs a verified identity; every other kind of post does not.
  const [sellGate, setSellGate] = useSellerGate();
  const photoInput = useRef(null);
  const fileInput = useRef(null);
  const textRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setKind(startKind);
    if (fixedCommunity) setCommunity(fixedCommunity);
    // Never leave "Post" greyed out for want of a community: start in one of
    // mine (or the first), and it can be changed from the header.
    api.get('/community/communities').then((list) => {
      setCommunities(list);
      setCommunity((cur) => cur || fixedCommunity || (list.find((c) => c.joined) || list[0])?.slug || '');
    }).catch(() => {});
    if (!me) loadMe();
    setTimeout(() => textRef.current?.focus(), 80);
    if (startWith === 'media') setTimeout(() => photoInput.current?.click(), 120);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep a draft while typing.
  useEffect(() => {
    if (!open) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ body, community })); } catch { /* ignore */ }
  }, [open, body, community]);

  // A link in the text → a preview card (once typing pauses).
  const firstUrl = body.match(URL_RE)?.[0] || null;
  useEffect(() => {
    if (!firstUrl || firstUrl === dismissedLink || media.some((m) => m.kind !== 'file')) { if (!firstUrl) setLink(null); return undefined; }
    if (link?.url === firstUrl) return undefined;
    const t = setTimeout(() => {
      api.get(`/community/link-preview?url=${encodeURIComponent(firstUrl)}`)
        .then((p) => setLink({ ...p, url: firstUrl }))
        .catch((e) => setError(e.message));
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstUrl, dismissedLink]);

  // @mention suggestions for the word being typed.
  function onType(e) {
    const v = e.target.value;
    setBody(v);
    const upto = v.slice(0, e.target.selectionStart);
    const m = upto.match(/(^|\s)@([a-zA-Z0-9_]{1,20})$/);
    if (m) {
      api.get(`/community/users/search?q=${m[2]}`).then((results) => setMention({ q: m[2], results })).catch(() => {});
    } else setMention(null);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(320, e.target.scrollHeight)}px`;
  }
  function pickMention(u) {
    const el = textRef.current;
    const pos = el.selectionStart;
    const before = body.slice(0, pos).replace(/@([a-zA-Z0-9_]{1,20})$/, `@${u.handle} `);
    setBody(before + body.slice(pos));
    setMention(null);
    setTimeout(() => { el.focus(); el.selectionStart = el.selectionEnd = before.length; }, 0);
  }

  // Tag a listing: my own first, or search all of them.
  useEffect(() => {
    if (kind === 'poll') return undefined;
    const t = setTimeout(() => {
      const q = itemSearch.trim();
      if (!q && !user) return;
      api.get(q ? `/items?search=${encodeURIComponent(q)}` : `/items?owner_id=${user.id}`)
        .then((rows) => setItemResults(rows.slice(0, 6))).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [itemSearch, kind, user]);

  // ------------------------------------------------ media
  const patch = (id, p) => setMedia((all) => all.map((m) => (m.id === id ? { ...m, ...p } : m)));

  async function addMedia(fileList) {
    setError('');
    const files = [...fileList];
    for (const file of files) {
      const id = `${Date.now()}-${Math.random()}`;
      if (file.type.startsWith('video/')) {
        if (media.some((m) => m.kind === 'video')) { setError('One video per post.'); continue; }
        setMedia((all) => [...all, { id, kind: 'video', preview: null, status: 'reading', progress: 0, name: file.name }]);
        try {
          const info = await readVideo(file);
          patch(id, { preview: URL.createObjectURL(info.poster), status: 'checking', duration: info.duration });
          const posterUp = await uploadFile(info.poster);
          const url = await uploadVideo(file, info.frames, (p) => patch(id, { status: 'uploading', progress: p }));
          patch(id, { status: 'done', progress: 1, result: { type: 'video', url, poster: posterUp.url, duration: info.duration, w: info.w, h: info.h, color: null } });
        } catch (e) {
          patch(id, { status: 'error', error: e.message });
        }
      } else if (file.type.startsWith('image/')) {
        setMedia((all) => [...all, { id, kind: 'image', preview: URL.createObjectURL(file), status: 'uploading', progress: 0.3 }]);
        try {
          const shrunk = await shrinkImage(file);
          patch(id, { progress: 0.6 });
          const up = await uploadFile(shrunk.file);
          patch(id, { status: 'done', progress: 1, result: { url: up.url, name: up.name, w: shrunk.w, h: shrunk.h, color: shrunk.color } });
        } catch (e) {
          patch(id, { status: 'error', error: e.message });
        }
      } else {
        setMedia((all) => [...all, { id, kind: 'file', name: file.name, size: file.size, status: 'uploading', progress: 0.4 }]);
        try {
          const up = await uploadFile(file);
          patch(id, { status: 'done', progress: 1, result: { url: up.url, name: up.name } });
        } catch (e) {
          patch(id, { status: 'error', error: e.message });
        }
      }
    }
  }

  // ------------------------------------------------ post
  const uploading = media.some((m) => m.status !== 'done' && m.status !== 'error');
  const ready = media.filter((m) => m.status === 'done');
  const hasContent = body.trim() || ready.length || link || (kind === 'poll' && poll.filter((o) => o.trim()).length >= 2);
  const saleOk = kind !== 'sell' || (sellGate === 'ok' && Number(sale.price) > 0 && ready.some((m) => m.kind !== 'file'));
  const canPost = community && hasContent && !uploading && saleOk && !busy;

  async function acceptRules() {
    await api.post('/community/rules/accept', {});
    setMe((m) => (m ? { ...m, rulesAccepted: true } : m));
    play('success');
  }

  async function submit() {
    if (!canPost) return;
    setBusy(true);
    setError('');
    try {
      const post = await api.post('/community/posts', {
        community,
        kind,
        body,
        attachments: ready.map((m) => m.result),
        link_url: link && !ready.some((m) => m.kind !== 'file') ? link.url : null,
        poll_options: kind === 'poll' ? poll : undefined,
        wanted: kind === 'wanted' ? wanted : undefined,
        sale: kind === 'sell' ? sale : undefined,
        item_id: item?.id || null,
      });
      play('send');
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      reset();
      onCreated?.(post);
      onClose();
      say(kind === 'sell' ? 'Listed for sale — buyers can message you' : 'Posted!', kind === 'sell' ? 'sell' : 'sparkle');
    } catch (e) {
      setError(e.message);
      if (e.reason === 'rules-required') setMe((m) => (m ? { ...m, rulesAccepted: false } : m));
      if (e.reason === 'seller-verification-required') setSellGate(e.message.includes('being checked') ? 'pending' : 'needed');
    } finally {
      setBusy(false);
    }
  }
  function reset() {
    setBody(''); setMedia([]); setLink(null); setPoll(['', '']); setItem(null); setItemSearch('');
    setWanted({ budget: '', from: '', to: '', area: '' }); setSale({ price: '', condition: 'good', negotiable: true });
  }

  if (!open) return null;
  const joined = communities.filter((c) => c.joined);
  const others = communities.filter((c) => !c.joined);
  const placeholder = {
    post: "What's happening?",
    showcase: 'Show what you made or shot…',
    question: 'What do you want to know?',
    guide: 'Teach something — step by step works great',
    wanted: 'What are you looking for, and when?',
    poll: 'Ask a question…',
    sell: 'What are you selling? Mention the model, age and what comes with it',
  }[kind];

  return (
    <div className="modal-backdrop composer-backdrop" onClick={onClose}>
      <div className="modal composer-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Create a post">
        <div className="cs-head">
          <Avatar id={user?.id} name={user?.name} src={me?.avatar_url} size={38} />
          <div className="cs-who">
            <b>{user?.name}</b>
            <select value={community} onChange={(e) => setCommunity(e.target.value)} disabled={Boolean(fixedCommunity)} aria-label="Community">
              <option value="">Choose a community…</option>
              {joined.length > 0 && <optgroup label="Your communities">{joined.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</optgroup>}
              <optgroup label={joined.length ? 'More' : 'Communities'}>{others.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</optgroup>
            </select>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button>
        </div>

        {me && !me.rulesAccepted ? (
          <div className="rules-card">
            <h3><Glyph name="sprout" size={24} /> Before your first post</h3>
            <ul>
              <li><b>Be kind.</b> No abuse, hate or harassment.</li>
              <li><b>No adult content.</b> Porn and nudity get one warning, then a permanent ban.</li>
              <li><b>No scams.</b> Never ask for payment outside RentalFlow.</li>
              <li><b>Keep it real.</b> Honest photos and prices, no spam.</li>
            </ul>
            <button type="button" className="btn lg block" onClick={acceptRules}>I agree — let me post</button>
          </div>
        ) : (
          <>
            <div className="kind-row" role="tablist">
              {Object.entries(KINDS).map(([k, v]) => (
                <button type="button" key={k} role="tab" aria-selected={kind === k} className={`kind-pill${kind === k ? ' on' : ''}`} onClick={() => setKind(k)} title={v.hint}>
                  <Glyph name={v.glyph} size={16} />{v.label}
                </button>
              ))}
            </div>

            <div className="cs-text">
              <textarea ref={textRef} value={body} onChange={onType} placeholder={placeholder} rows={3} maxLength={5000} />
              {mention?.results?.length > 0 && (
                <div className="mention-list">
                  {mention.results.map((u) => (
                    <button type="button" key={u.id} onClick={() => pickMention(u)}><Avatar id={u.id} name={u.name} src={u.avatar_url} size={24} /> {u.name} <span className="muted">@{u.handle}</span></button>
                  ))}
                </div>
              )}
              {body.length > 4500 && <div className="cs-count">{5000 - body.length}</div>}
            </div>

            {kind === 'poll' && (
              <div className="cs-extra">
                {poll.map((o, i) => (
                  <div className="poll-edit" key={i}>
                    <input value={o} maxLength={80} placeholder={`Option ${i + 1}`} onChange={(e) => setPoll(poll.map((x, j) => (j === i ? e.target.value : x)))} />
                    {poll.length > 2 && <button type="button" className="icon-btn" onClick={() => setPoll(poll.filter((_, j) => j !== i))} aria-label="Remove option"><Icon name="close" size={14} /></button>}
                  </div>
                ))}
                {poll.length < 4 && <button type="button" className="btn ghost small" onClick={() => setPoll([...poll, ''])}><Icon name="plus" size={14} /> Add option</button>}
              </div>
            )}

            {kind === 'wanted' && (
              <div className="cs-extra grid2">
                <label>Budget / day<input type="number" min="0" inputMode="numeric" placeholder="৳" value={wanted.budget} onChange={(e) => setWanted({ ...wanted, budget: e.target.value })} /></label>
                <label>Area<input placeholder="e.g. Dhanmondi" value={wanted.area} onChange={(e) => setWanted({ ...wanted, area: e.target.value })} /></label>
                <label>From<input type="date" value={wanted.from} onChange={(e) => setWanted({ ...wanted, from: e.target.value })} /></label>
                <label>To<input type="date" value={wanted.to} onChange={(e) => setWanted({ ...wanted, to: e.target.value })} /></label>
              </div>
            )}

            {kind === 'sell' && sellGate !== 'ok' && sellGate !== 'checking' && (
              <SellerGate state={sellGate} returnTo="/feed?tab=sale&compose=sell" what="sell" />
            )}
            {kind === 'sell' && (sellGate === 'ok' || sellGate === 'checking') && (
              <div className="cs-extra grid2">
                <label>Price<input type="number" min="1" inputMode="numeric" placeholder="৳" value={sale.price} onChange={(e) => setSale({ ...sale, price: e.target.value })} /></label>
                <label>Condition
                  <select value={sale.condition} onChange={(e) => setSale({ ...sale, condition: e.target.value })}>
                    {Object.entries(CONDITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
                <label className="switch-line"><input type="checkbox" checked={sale.negotiable} onChange={(e) => setSale({ ...sale, negotiable: e.target.checked })} /> Price is negotiable</label>
                {Number(sale.price) > 0 && <div className="sale-preview">{money(sale.price)}</div>}
                {!ready.some((m) => m.kind !== 'file') && <div className="cs-hint"><Glyph name="camera" size={16} /> Add at least one photo or video of it</div>}
              </div>
            )}

            {media.length > 0 && (
              <div className="cs-media">
                {media.map((m) => (
                  <div key={m.id} className={`cs-thumb ${m.kind} ${m.status}`}>
                    {m.kind === 'file'
                      ? <div className="cs-file"><Icon name="file" size={20} /><span>{m.name}</span><small>{fileSize(m.size)}</small></div>
                      : m.preview ? <img src={m.preview} alt="" /> : <div className="cs-file"><span>Reading video…</span></div>}
                    {m.kind === 'video' && m.duration ? <span className="cs-dur">▶ {fmt(m.duration)}</span> : null}
                    {m.status !== 'done' && m.status !== 'error' && (
                      <div className="cs-progress">
                        <i style={{ transform: `scaleX(${m.progress || 0.05})` }} />
                        <span>{m.status === 'checking' ? 'Checking…' : m.status === 'reading' ? 'Reading…' : `${Math.round((m.progress || 0) * 100)}%`}</span>
                      </div>
                    )}
                    {m.status === 'error' && <div className="cs-err">{m.error}</div>}
                    <button type="button" className="cs-remove" onClick={() => setMedia((all) => all.filter((x) => x.id !== m.id))} aria-label="Remove"><Icon name="close" size={12} /></button>
                  </div>
                ))}
              </div>
            )}

            {link && !media.some((m) => m.kind !== 'file') && (
              <div className="cs-link">
                {link.image && <img src={link.image} alt="" referrerPolicy="no-referrer" />}
                <div><span>{link.site}</span><b>{link.title || link.url}</b></div>
                <button type="button" className="icon-btn" onClick={() => { setDismissedLink(link.url); setLink(null); }} aria-label="Remove link preview"><Icon name="close" size={14} /></button>
              </div>
            )}

            {item ? (
              <div className="cs-item">
                {item.cover_url ? <img src={item.cover_url} alt="" /> : <Icon name="package" size={18} />}
                <span><b>{item.name}</b> · {money(item.rental_price)}/day</span>
                <button type="button" className="icon-btn" onClick={() => setItem(null)} aria-label="Remove listing"><Icon name="close" size={14} /></button>
              </div>
            ) : kind !== 'poll' && (
              <details className="cs-tag">
                <summary><Glyph name="rent" size={16} /> Tag a listing</summary>
                <input placeholder="Search listings…" value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} />
                <div className="cs-tag-list">
                  {itemResults.map((it) => (
                    <button type="button" key={it.id} onClick={() => setItem(it)}>
                      {it.cover_url ? <img src={it.cover_url} alt="" /> : <Icon name="package" size={16} />} {it.name}
                    </button>
                  ))}
                </div>
              </details>
            )}

            {error && <div className="error">{error}</div>}

            <div className="cs-foot">
              <input ref={photoInput} type="file" accept="image/*,video/mp4,video/webm,video/quicktime" multiple hidden onChange={(e) => { addMedia(e.target.files); e.target.value = ''; }} />
              <input ref={fileInput} type="file" accept={DOC_ACCEPT} multiple hidden onChange={(e) => { addMedia(e.target.files); e.target.value = ''; }} />
              <button type="button" className="tool-btn" onClick={() => photoInput.current?.click()} title="Photos or a video"><Glyph name="media" size={20} /><em>Photo / video</em></button>
              <button type="button" className="tool-btn" onClick={() => fileInput.current?.click()} title="PDF, Word, Excel, PowerPoint or text"><Glyph name="file" size={20} /><em>File</em></button>
              <button type="button" className="tool-btn" onClick={() => setKind('poll')} title="Poll"><Glyph name="poll" size={20} /><em>Poll</em></button>
              <span className="spacer" />
              <button type="button" className="btn accent" disabled={!canPost} onClick={submit}>
                {busy ? 'Posting…' : uploading ? 'Uploading…' : kind === 'sell' ? 'List for sale' : 'Post'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
