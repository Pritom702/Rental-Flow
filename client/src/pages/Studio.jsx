// ============================================================
//  RentalFlow  |  Studio  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: Video Studio — listings in, a video out
// ============================================================
// Step 2 of the Video Studio (step 1, StudioPick.jsx, picks your listings).
// Choose a look and a caption; the Studio draws a vertical video with a beat,
// right here in the browser (no paid service anywhere), posts it to the right
// community and — if you like — promotes it as an ad.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { money } from '../money.js';
import { play } from '../sfx.js';
import { celebrate } from '../fx.js';
import { Glyph } from '../social/glyphs.jsx';
import { say } from '../social/toast.js';
import { writeCopy, totalPerDay } from '../social/copywriter.js';
import { W, H, STYLES, drawFrame, durationFor, loadImages, makeVideo, brandFontsReady } from '../social/studioEngine.js';
import { preloadUploader, uploadFile, uploadVideo } from '../social/media.js';
import { PromoteDialog } from '../social/AdsPanel.jsx';
import { STUDIO_MAX } from './StudioPick.jsx';

// Shown before a first-ever post (a pop-up, so plain text with line breaks).
const RULES = `Before your first post, please agree to the community rules:

• Be kind — no abuse, hate or harassment.
• No adult content — porn and nudity get one warning, then a permanent ban.
• No scams — never ask for payment outside RentalFlow.
• Keep it real — honest photos and prices, no spam.

Do you agree?`;
const slugOf = (name = '') => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export default function Studio() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // The listings picked on step 1: /studio/make?items=12,15
  const ids = useMemo(() => (params.get('items') || '').split(',').map(Number).filter(Boolean).slice(0, STUDIO_MAX), [params]);
  const [chosen, setChosen] = useState(null);
  const [style, setStyle] = useState('neon');
  const [music, setMusic] = useState(true);
  const [variant, setVariant] = useState(0);
  const [caption, setCaption] = useState('');
  const [photos, setPhotos] = useState(() => new Map());   // listing id → its cover, decoded
  const [phase, setPhase] = useState('edit');     // edit | recording | uploading | done
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);     // { file, url, post }
  const [promote, setPromote] = useState(false);
  const canvas = useRef(null);

  useEffect(() => { brandFontsReady(); preloadUploader().catch(() => {}); }, []);
  // Only your own listings with a photo can be in your video; anything else
  // (or nothing picked) goes back to step 1.
  useEffect(() => {
    api.get(`/items?owner_id=${user.id}`).then((rows) => {
      const mine = ids.map((id) => rows.find((r) => r.id === id && r.cover_url)).filter(Boolean);
      if (!mine.length) navigate('/studio', { replace: true });
      else setChosen(mine);
    }).catch(() => navigate('/studio', { replace: true }));
  }, [ids, user.id, navigate]);
  const list = chosen || [];
  const copies = useMemo(() => writeCopy(list), [chosen]);
  const hook = copies[variant % Math.max(1, copies.length)]?.hook || '';
  useEffect(() => { setCaption(copies[variant % Math.max(1, copies.length)]?.caption || ''); }, [copies, variant]);
  // Photos are kept per listing, so a scene can never show another listing's
  // photo while a new pick is still loading.
  useEffect(() => {
    const missing = list.filter((i) => !photos.has(i.id));
    if (!missing.length) return undefined;
    let alive = true;
    loadImages(missing).then((imgs) => {
      if (!alive) return;
      setPhotos((prev) => { const next = new Map(prev); missing.forEach((i, n) => next.set(i.id, imgs[n])); return next; });
    });
    return () => { alive = false; };
  }, [chosen, photos]);
  const images = useMemo(() => list.map((i) => photos.get(i.id) ?? null), [chosen, photos]);

  // Live preview: loop the video on the canvas while editing.
  useEffect(() => {
    if (!list.length && canvas.current) canvas.current.getContext('2d').clearRect(0, 0, W, H);
    if (phase !== 'edit' || !list.length || !canvas.current) return undefined;
    const g = canvas.current.getContext('2d');
    const total = durationFor(list.length);
    const t0 = performance.now();
    let raf;
    const tick = () => {
      drawFrame(g, { items: list, images, style, hook }, ((performance.now() - t0) / 1000) % total);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, chosen, images, style, hook]);

  // Frames for the adult-content check and the cover, drawn straight from the scene.
  async function stills(spec) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const total = durationFor(spec.items.length);
    const shot = async (t, w) => {
      drawFrame(g, spec, t);
      const s = document.createElement('canvas'); s.width = w; s.height = Math.round((H / W) * w);
      s.getContext('2d').drawImage(c, 0, 0, s.width, s.height);
      return new Promise((resolve) => s.toBlob(resolve, 'image/jpeg', 0.8));
    };
    const frames = [];
    for (const f of [0.1, 0.3, 0.5, 0.7, 0.9]) frames.push(await shot(total * f, 320));
    const poster = await shot(Math.min(total - 0.1, 2.4), 720);
    return { frames, poster: new File([poster], 'cover.jpg', { type: 'image/jpeg' }), duration: Math.round(total) };
  }

  // Each step has a time limit, so a stalled network or encoder ends in a
  // clear message instead of a spinner that never stops.
  const [stage, setStage] = useState('');
  const step = (name, promise, seconds, message) => {
    setStage(name);
    return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(message)), seconds * 1000))]);
  };

  async function create() {
    if (phase !== 'edit' || !list.length) return;
    setPhase('recording'); setProgress(0);
    try {
      // Can this member post today? Asked first, not after the video is made.
      const canPost = () => step('check', api.get('/community/can-post'), 20, 'Could not reach RentalFlow. Check your connection and try again.');
      try {
        await canPost();
      } catch (e) {
        if (e.reason !== 'rules-required') throw e;
        // First post ever: agree to the community rules right here.
        if (!window.confirm(RULES)) { setPhase('edit'); setStage(''); return; }
        await api.post('/community/rules/accept', {});
        await canPost();
      }
      // every photo in place before the first frame is drawn
      const missing = list.filter((i) => !photos.get(i.id));
      const fresh = missing.length ? await step('photos', loadImages(missing), 20, 'The listing photos did not load. Check your connection and try again.') : [];
      const photoOf = (i) => photos.get(i.id) || fresh[missing.indexOf(i)] || null;
      const spec = { items: list, images: list.map(photoOf), style, hook };
      const seconds = durationFor(list.length);
      const file = await step('making', makeVideo(canvas.current, spec, { music, onProgress: setProgress }), seconds * 6 + 60,
        'Making the video took too long on this device. Close other tabs and try again.');
      setPhase('uploading'); setProgress(0);
      const { frames, poster, duration } = await step('stills', stills(spec), 20, 'The video cover could not be made. Please try again.');
      const posterUp = await step('cover', uploadFile(poster), 60, 'Uploading took too long. Check your connection and try again.');
      const url = await step('upload', uploadVideo(file, frames, (p) => setProgress(p)), 240, 'Uploading took too long. Check your connection and try again.');
      const community = slugOf(list[0].category_name) || 'cameras';
      const post = await step('post', api.post('/community/posts', {
        community, kind: 'showcase', body: caption, item_id: list[0].id,
        attachments: [{ type: 'video', url, poster: posterUp.url, duration, w: W, h: H, color: null }],
      }), 90, 'Posting took too long. Please try again.');
      setStage('');
      setResult({ file, url, post, preview: URL.createObjectURL(file) });
      setPhase('done');
      celebrate();
      say('Your video is live in the feed and in Flows', 'clapper');
    } catch (e) {
      say(e?.message || 'The video could not be made. Please try again.', 'warn');
      setPhase('edit');
      setStage('');
    }
  }

  if (!chosen) return <div className="container"><div className="page-loading" /></div>;
  const busy = phase === 'recording' || phase === 'uploading';
  return (
    <div className="container studio studio-make" data-stage={stage || undefined}>
      <div className="studio-head">
        <Link to={`/studio?items=${ids.join(',')}`} className="studio-back">← Change listings</Link>
        <h1><Glyph name="clapper" size={28} /> Make your video</h1>
        <p className="muted" translate="no">{list.map((i) => i.name).join(' · ')}</p>
      </div>

      <div className="studio-grid">
        <section className="studio-stage">
          <div className="phone-frame">
            <canvas ref={canvas} width={W} height={H} className="studio-canvas" />
            {busy && (
              <div className="stage-busy">
                <b>{phase === 'recording' ? 'Making your video…' : 'Uploading…'}</b>
                <div className="stage-bar"><i style={{ transform: `scaleX(${progress})` }} /></div>
                <span>{phase === 'recording' ? 'Every frame drawn right here on your device' : 'Checking and sending your video'}</span>
              </div>
            )}
          </div>
          <div className="muted small stage-meta" translate="no">{Math.round(durationFor(list.length))}s · {money(totalPerDay(list))}/day</div>
        </section>

        <section className="studio-panel">
          <div className="studio-step"><span>1</span><b>Look</b></div>
          <div className="style-row">
            {Object.entries(STYLES).map(([k, st]) => (
              <button type="button" key={k} className={`style-chip${style === k ? ' on' : ''}`} disabled={busy} onClick={() => setStyle(k)} style={{ background: `linear-gradient(135deg, ${st.bg[0]}, ${st.bg[1]})`, color: st.ink }}>
                {st.label}
              </button>
            ))}
          </div>
          <label className="switch-line"><input type="checkbox" checked={music} disabled={busy} onChange={(e) => setMusic(e.target.checked)} /> Add a beat (made on your device, free to use)</label>

          <div className="studio-step"><span>2</span><b>Caption</b>
            <button type="button" className="btn ghost small" disabled={busy} onClick={() => { setVariant((v) => v + 1); play('pop'); }}><Glyph name="sparkle" size={14} /> Write another</button>
          </div>
          <div className="studio-hook"><span className="muted small">On screen first:</span> <b translate="no">{hook}</b></div>
          <textarea className="studio-caption" rows={4} maxLength={500} value={caption} disabled={busy} onChange={(e) => setCaption(e.target.value)} placeholder="The Studio writes this for you" />
          <div className="muted small caption-count">{caption.length}/500</div>

          {phase === 'done' && result ? (
            <div className="studio-done">
              <b><Glyph name="check" size={18} /> Posted!</b>
              <div className="card-actions">
                <button type="button" className="btn accent" onClick={() => setPromote(true)}><Glyph name="megaphone" size={16} /> Promote as an ad</button>
                <button type="button" className="btn secondary" onClick={() => navigate(`/flows?start=${result.post.id}`)}>Watch in Flows</button>
                <a className="btn ghost" href={result.preview} download={result.file.name}>Download</a>
                <Link className="btn ghost" to="/studio">Make another</Link>
              </div>
            </div>
          ) : (
            <div className="studio-go-bar">
              <button type="button" className="btn accent lg block studio-go" disabled={phase !== 'edit' || !caption.trim()} onClick={create}>
                <Glyph name="clapper" size={18} /> {busy ? `${phase === 'recording' ? 'Making' : 'Uploading'}… ${Math.round(progress * 100)}%` : 'Create & post the video'}
              </button>
            </div>
          )}
        </section>
      </div>
      {promote && result && <PromoteDialog post={result.post} onClose={() => setPromote(false)} />}
    </div>
  );
}
