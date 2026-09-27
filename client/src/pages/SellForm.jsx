// ============================================================
//  RentalFlow  |  Marketplace  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: Sell something — its own listing page
// ============================================================
// Selling works like "Rent it out": a proper form with a title, description,
// category, price, condition and photos, instead of a status-style post. It
// is saved as a "for sale" post in the category's community, so it shows in
// the For sale tab and buyers can make an offer. Everything is required
// except "negotiable". What you type is kept as a draft until it is listed.
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { celebrate } from '../fx.js';
import { Icon } from '../icons.jsx';
import { money } from '../money.js';
import { play } from '../sfx.js';
import SellerGate, { useSellerGate } from '../social/SellerGate.jsx';
import { CONDITIONS, DESCRIPTION_MAX, NAME_MAX } from '../social/util.jsx';
import { shrinkImage, uploadFile } from '../social/media.js';
import { loadMe, setMe, useMe } from '../social/store.js';
import { say } from '../social/toast.js';

const MAX_PHOTOS = 8;
const empty = { title: '', description: '', community: '', price: '', condition: '', negotiable: true };

function draftKey(userId) { return `rentalflow_sale_draft_${userId || 'guest'}`; }
function readDraft(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } }

export default function SellForm() {
  const { user } = useAuth();
  const me = useMe();
  const navigate = useNavigate();
  const [gate, setGate] = useSellerGate();
  const key = draftKey(user?.id);
  const [form, setForm] = useState(empty);
  const [photos, setPhotos] = useState([]);   // { id, preview, status, result }
  const [communities, setCommunities] = useState([]);
  const [agree, setAgree] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [restored, setRestored] = useState(false);
  const touched = useRef(false);

  useEffect(() => {
    if (!me) loadMe();
    api.get('/community/communities').then((list) => {
      // One community per product category: the category picks where it is listed.
      const cats = list.filter((c) => c.category_id);
      setCommunities((cats.length ? cats : list).sort((a, b) => a.name.localeCompare(b.name)));
    }).catch(() => {});
    const d = readDraft(key);
    if (d) { setForm({ ...empty, ...d.form }); setPhotos((d.photos || []).map((r, i) => ({ id: `d${i}`, preview: r.url, status: 'done', result: r }))); setRestored(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!touched.current) return;
    try { localStorage.setItem(key, JSON.stringify({ form, photos: photos.filter((p) => p.status === 'done').map((p) => p.result) })); } catch { /* storage blocked */ }
  }, [form, photos, key]);

  const set = (k) => (e) => {
    touched.current = true;
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  };

  async function addPhotos(e) {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'));
    e.target.value = '';
    setError('');
    touched.current = true;
    for (const file of files.slice(0, MAX_PHOTOS - photos.length)) {
      const id = `${Date.now()}-${Math.random()}`;
      setPhotos((all) => [...all, { id, preview: URL.createObjectURL(file), status: 'uploading' }]);
      try {
        const shrunk = await shrinkImage(file);
        const up = await uploadFile(shrunk.file);
        const result = { url: up.url, name: up.name, w: shrunk.w, h: shrunk.h, color: shrunk.color };
        setPhotos((all) => all.map((p) => (p.id === id ? { ...p, status: 'done', result } : p)));
      } catch (err) {
        setPhotos((all) => all.filter((p) => p.id !== id));
        setError(err.message);
      }
    }
  }
  function removePhoto(id) {
    touched.current = true;
    setPhotos((all) => all.filter((p) => p.id !== id));
  }

  function discardDraft() {
    touched.current = false;
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    setForm(empty);
    setPhotos([]);
    setRestored(false);
  }

  const uploading = photos.some((p) => p.status !== 'done');
  const needsRules = me && !me.rulesAccepted;

  async function submit(e) {
    e.preventDefault();
    if (saving || uploading) return;
    setError('');
    if (gate !== 'ok') { setError('Verify your identity first (see above) — then your item goes up for sale.'); return; }
    if (!photos.length) { setError('Add at least one photo of what you are selling.'); return; }
    if (needsRules && !agree) { setError('Tick the box to accept the community rules.'); return; }
    setSaving(true);
    try {
      if (needsRules) {
        await api.post('/community/rules/accept', {});
        setMe((m) => (m ? { ...m, rulesAccepted: true } : m));
      }
      // The title leads the post, so it is what buyers see first everywhere.
      const post = await api.post('/community/posts', {
        community: form.community,
        kind: 'sell',
        body: `${form.title.trim()}\n\n${form.description.trim()}`,
        attachments: photos.map((p) => p.result),
        sale: { price: Number(form.price), condition: form.condition, negotiable: form.negotiable },
      });
      touched.current = false;
      try { localStorage.removeItem(key); } catch { /* ignore */ }
      play('success');
      celebrate();
      say('Listed for sale — buyers can make you an offer', 'sell');
      navigate(`/post/${post.id}`);
    } catch (err) {
      if (err.reason === 'seller-verification-required') setGate(err.message.includes('being checked') ? 'pending' : 'needed');
      if (err.reason === 'rules-required') setMe((m) => (m ? { ...m, rulesAccepted: false } : m));
      setError(err.message);
      setSaving(false);
    }
  }

  // The post body holds the title and description together (1000 characters).
  const descMax = DESCRIPTION_MAX - NAME_MAX - 2;

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Sell something</h1>
          <div className="sub">List an item you own for sale. Buyers make an offer; once you accept, you send them a payment request.</div>
        </div>
        <Link to="/feed?tab=sale" className="btn secondary small">See what is for sale</Link>
      </div>
      <div style={{ maxWidth: 720 }}><SellerGate state={gate} returnTo="/sell" what="sell" /></div>
      {restored && (
        <div className="hint" style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, maxWidth: 720 }}>
          <span><b>Restored your unsaved listing.</b> Everything you typed before is back.</span>
          <button type="button" className="btn ghost small" onClick={discardDraft}>Discard</button>
        </div>
      )}
      <form className="form" onSubmit={submit}>
        <div className="field">
          <label>Title * <span className={`field-count${form.title.length > NAME_MAX - 5 ? ' near' : ''}`}>{form.title.length}/{NAME_MAX}</span></label>
          <input value={form.title} onChange={set('title')} maxLength={NAME_MAX} placeholder="e.g. Canon EOS 200D with 18–55 mm lens" required />
        </div>
        <div className="field">
          <label>Description * <span className={`field-count${form.description.length > descMax - 50 ? ' near' : ''}`}>{form.description.length}/{descMax}</span></label>
          <textarea rows={5} value={form.description} onChange={set('description')} maxLength={descMax} placeholder="How old is it, how has it been used, what comes with it, where can it be picked up?" required />
        </div>
        <div className="row">
          <div className="field">
            <label>Category *</label>
            <select value={form.community} onChange={set('community')} required>
              <option value="">Choose a category…</option>
              {communities.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Condition *</label>
            <select value={form.condition} onChange={set('condition')} required>
              <option value="">Choose the condition…</option>
              {Object.entries(CONDITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label>Price (৳) *</label>
            <input type="number" min="1" step="1" inputMode="numeric" value={form.price} onChange={set('price')} required />
          </div>
          <div className="field">
            <label>Negotiable?</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 42, fontWeight: 500, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.negotiable} onChange={set('negotiable')} style={{ width: 18, height: 18, margin: 0, flex: 'none' }} />
              <span>Buyers can offer less</span>
              {Number(form.price) > 0 && <b style={{ marginLeft: 'auto' }}>{money(form.price)}</b>}
            </label>
          </div>
        </div>

        <div className="field">
          <label>Photos * (up to {MAX_PHOTOS} — the first one is the cover)</label>
          <input type="file" accept="image/*" multiple onChange={addPhotos} disabled={photos.length >= MAX_PHOTOS} />
          {uploading && <div className="muted" style={{ marginTop: 6 }}>Uploading…</div>}
          {photos.length > 0 && (
            <div className="image-grid">
              {photos.map((p, i) => (
                <div className="thumb" key={p.id} style={p.status !== 'done' ? { opacity: 0.55 } : undefined}>
                  <img src={p.preview} alt={`photo ${i + 1}`} />
                  {i === 0 && <span className="cover-tag">Cover</span>}
                  <button type="button" className="thumb-remove" onClick={() => removePhoto(p.id)} title="Remove">×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {needsRules && (
          <label className="hint" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 3 }} />
            <span>I agree to the community rules: be kind, no adult content, no scams (never ask for payment outside RentalFlow), honest photos and prices.</span>
          </label>
        )}

        {error && <div className="error"><Icon name="shield" size={16} /> {error}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" disabled={uploading || saving || gate === 'checking'}>
            <Icon name="check" size={16} /> {saving ? 'Listing…' : 'List for sale'}
          </button>
          <button type="button" className="btn secondary" onClick={() => navigate(-1)}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
