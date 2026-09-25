// ============================================================
//  RentalFlow  |  Studio  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: Video Studio — listings in, a video out
// ============================================================
// Pick 1–4 listings, a look and a caption; the Studio draws a vertical video
// with a beat, right here in the browser (no paid service anywhere), posts it
// to the right community and — if you like — promotes it as an ad.
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

const MAX = 4;
const slugOf = (name = '') => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export default function Studio() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // One tap from a listing: /studio?items=12 arrives with it already picked,
  // a caption written and a look chosen — just press Create.
  const preset = (params.get('items') || '').split(',').map(Number).filter(Boolean).slice(0, MAX);
  const [items, setItems] = useState([]);
  const [scope, setScope] = useState(preset.length ? 'all' : 'mine');
  const [picked, setPicked] = useState(preset);
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
  useEffect(() => {
    api.get(scope === 'mine' ? `/items?owner_id=${user.id}` : '/items')
      .then((rows) => setItems(rows.filter((r) => r.cover_url))).catch(() => setItems([]));
  }, [scope, user.id]);

  // Picked listings are remembered as themselves, so switching between Mine and
  // All listings never drops them.
  const known = useRef(new Map());
  items.forEach((i) => known.current.set(i.id, i));
  const chosen = useMemo(() => picked.map((id) => known.current.get(id)).filter(Boolean), [picked, items]);
  const copies = useMemo(() => writeCopy(chosen), [chosen]);
  const hook = copies[variant % Math.max(1, copies.length)]?.hook || '';
  useEffect(() => { setCaption(copies[variant % Math.max(1, copies.length)]?.caption || ''); }, [copies, variant]);
  // Photos are kept per listing, so a scene can never show another listing's
  // photo while a new pick is still loading.
  useEffect(() => {
    const missing = chosen.filter((i) => !photos.has(i.id));
    if (!missing.length) return undefined;
    let alive = true;
    loadImages(missing).then((imgs) => {
      if (!alive) return;
      setPhotos((prev) => { const next = new Map(prev); missing.forEach((i, n) => next.set(i.id, imgs[n])); return next; });
    });
    return () => { alive = false; };
  }, [chosen, photos]);
  const images = useMemo(() => chosen.map((i) => photos.get(i.id) ?? null), [chosen, photos]);

  // Live preview: loop the video on the canvas while editing.
  useEffect(() => {
    if (!chosen.length && canvas.current) canvas.current.getContext('2d').clearRect(0, 0, W, H);
    if (phase !== 'edit' || !chosen.length || !canvas.current) return undefined;
    const g = canvas.current.getContext('2d');
    const total = durationFor(chosen.length);
    const t0 = performance.now();
    let raf;
    const tick = () => {
      drawFrame(g, { items: chosen, images, style, hook }, ((performance.now() - t0) / 1000) % total);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, chosen, images, style, hook]);

  function toggle(id) {
    play('pop');
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX ? p : [...p, id]));
  }

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
    if (phase !== 'edit' || !chosen.length) return;
    setPhase('recording'); setProgress(0);
    try {
      // every photo in place before the first frame is drawn
      const missing = chosen.filter((i) => !photos.get(i.id));
      const fresh = missing.length ? await step('photos', loadImages(missing), 20, 'The listing photos did not load. Check your connection and try again.') : [];
      const photoOf = (i) => photos.get(i.id) || fresh[missing.indexOf(i)] || null;
      const spec = { items: chosen, images: chosen.map(photoOf), style, hook };
      const seconds = durationFor(chosen.length);
      const file = await step('making', makeVideo(canvas.current, spec, { music, onProgress: setProgress }), seconds * 6 + 60,
        'Making the video took too long on this device. Close other tabs and try again.');
      setPhase('uploading'); setProgress(0);
      const { frames, poster, duration } = await step('stills', stills(spec), 20, 'The video cover could not be made. Please try again.');
      const posterUp = await step('cover', uploadFile(poster), 60, 'Uploading took too long. Check your connection and try again.');
      const url = await step('upload', uploadVideo(file, frames, (p) => setProgress(p)), 240, 'Uploading took too long. Check your connection and try again.');
      const community = slugOf(chosen[0].category_name) || 'cameras';
      const post = await step('post', api.post('/community/posts', {
        community, kind: 'showcase', body: caption, item_id: chosen[0].id,
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

  return (
    <div className="container studio" data-stage={stage || undefined}>
      <div className="studio-head">
        <div>
          <h1><Glyph name="clapper" size={30} /> Video Studio</h1>
          <p className="muted">Pick up to four listings — the Studio makes a video with a beat and writes the caption. It all happens on your device, free.</p>
        </div>
      </div>

      <div className="studio-grid">
        <section className="studio-panel">
          <div className="studio-step"><span>1</span><b>Pick listings</b><em>{picked.length}/{MAX}</em></div>
          <div className="seg">
            <button type="button" className={scope === 'mine' ? 'on' : ''} onClick={() => setScope('mine')}>Mine</button>
            <button type="button" className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>All listings</button>
          </div>
          {items.length === 0 ? (
            <p className="muted">{scope === 'mine' ? <>No listings with photos yet. <Link to="/items/new">List an item</Link> or pick from all listings.</> : 'No listings yet.'}</p>
          ) : (
            <div className="studio-items">
              {items.map((it) => {
                const n = picked.indexOf(it.id);
                return (
                  <button type="button" key={it.id} className={`s-item${n >= 0 ? ' on' : ''}`} onClick={() => toggle(it.id)} data-sfx="none">
                    <img src={it.cover_url} alt="" loading="lazy" />
                    <span>{it.name}</span>
                    <small>{money(it.rental_price)}/day</small>
                    {n >= 0 && <em>{n + 1}</em>}
                  </button>
                );
              })}
            </div>
          )}

          <div className="studio-step"><span>2</span><b>Look</b></div>
          <div className="style-row">
            {Object.entries(STYLES).map(([k, s]) => (
              <button type="button" key={k} className={`style-chip${style === k ? ' on' : ''}`} onClick={() => setStyle(k)} style={{ background: `linear-gradient(135deg, ${s.bg[0]}, ${s.bg[1]})`, color: s.ink }}>
                {s.label}
              </button>
            ))}
          </div>
          <label className="switch-line"><input type="checkbox" checked={music} onChange={(e) => setMusic(e.target.checked)} /> Add a beat (made on your device, free to use)</label>

          <div className="studio-step"><span>3</span><b>Caption</b>
            <button type="button" className="btn ghost small" disabled={!copies.length} onClick={() => { setVariant((v) => v + 1); play('pop'); }}><Glyph name="sparkle" size={14} /> Write another</button>
          </div>
          <textarea className="studio-caption" rows={4} maxLength={500} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Pick listings and the Studio writes this for you" />
          {chosen.length > 0 && <div className="muted small">Hook on screen: <b>{hook}</b> · {Math.round(durationFor(chosen.length))} s · total {money(totalPerDay(chosen))}/day</div>}
        </section>

        <section className="studio-stage">
          <div className="phone-frame">
            <canvas ref={canvas} width={W} height={H} className="studio-canvas" />
            {!chosen.length && <div className="stage-empty"><Glyph name="clapper" size={48} /><b>Your video appears here</b><span>Pick a listing to start</span></div>}
            {(phase === 'recording' || phase === 'uploading') && (
              <div className="stage-busy">
                <b>{phase === 'recording' ? 'Making your video…' : 'Uploading…'}</b>
                <div className="stage-bar"><i style={{ transform: `scaleX(${progress})` }} /></div>
                <span>{phase === 'recording' ? 'Every frame drawn right here on your device' : 'Checking and sending your video'}</span>
              </div>
            )}
          </div>
          {phase === 'done' && result ? (
            <div className="studio-done">
              <b><Glyph name="check" size={18} /> Posted!</b>
              <div className="card-actions">
                <button type="button" className="btn accent" onClick={() => setPromote(true)}><Glyph name="megaphone" size={16} /> Promote as an ad</button>
                <button type="button" className="btn secondary" onClick={() => navigate(`/flows?start=${result.post.id}`)}>Watch in Flows</button>
                <a className="btn ghost" href={result.preview} download={result.file.name}>Download</a>
                <button type="button" className="btn ghost" onClick={() => { setPhase('edit'); setResult(null); setPicked([]); }}>Make another</button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn accent lg block studio-go" disabled={!chosen.length || phase !== 'edit' || !caption.trim()} onClick={create}>
              <Glyph name="clapper" size={18} /> Create & post the video
            </button>
          )}
        </section>
      </div>
      {promote && result && <PromoteDialog post={result.post} onClose={() => setPromote(false)} />}
    </div>
  );
}
