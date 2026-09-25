// ============================================================
//  RentalFlow  |  Studio  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: Video Studio, step 1 — pick your listings
// ============================================================
// A video ad is made from your own listings. This page shows all of them;
// pick up to four and go on to the next page, where the video is made.
// No listings yet? It says so, with a button to list something first.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { money } from '../money.js';
import { play } from '../sfx.js';
import { Glyph } from '../social/glyphs.jsx';

export const STUDIO_MAX = 4;

export default function StudioPick() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [items, setItems] = useState(null);
  // Coming back from step 2 keeps what was picked.
  const [picked, setPicked] = useState(() => (params.get('items') || '').split(',').map(Number).filter(Boolean).slice(0, STUDIO_MAX));

  useEffect(() => {
    api.get(`/items?owner_id=${user.id}`).then(setItems).catch(() => setItems([]));
  }, [user.id]);

  function toggle(it) {
    play('pop');
    setPicked((p) => (p.includes(it.id) ? p.filter((x) => x !== it.id) : p.length >= STUDIO_MAX ? p : [...p, it.id]));
  }
  const next = () => navigate(`/studio/make?items=${picked.join(',')}`);

  return (
    <div className="container studio-pick">
      <div className="studio-head">
        <h1><Glyph name="clapper" size={30} /> Make a video ad</h1>
        <p className="muted">{`Pick up to ${STUDIO_MAX} of your listings. Next, choose a look — the Studio makes the video with a beat and writes the caption, free, right on your device.`}</p>
      </div>

      {items == null ? <div className="page-loading" /> : items.length === 0 ? (
        <div className="studio-empty card">
          <Glyph name="box" size={44} />
          <h2>You haven't listed anything yet</h2>
          <p className="muted">A video ad shows off things you rent out. List something you own — a camera, a console, a car — then come back and turn it into a video in one tap.</p>
          <Link to="/items/new" className="btn accent lg"><Glyph name="plus" size={18} /> Create a listing</Link>
        </div>
      ) : (
        <>
          <div className="pick-grid">
            {items.map((it) => {
              const n = picked.indexOf(it.id);
              if (!it.cover_url) {
                // A listing without a photo cannot be in a video yet.
                return (
                  <div key={it.id} className="pick-card no-photo">
                    <span className="pick-photo"><Glyph name="camera" size={30} /></span>
                    <span className="pick-name" translate="no">{it.name}</span>
                    <Link to={`/items/${it.id}/edit`} className="pick-fix">Add a photo to use it</Link>
                  </div>
                );
              }
              return (
                <button type="button" key={it.id} data-sfx="none" className={`pick-card${n >= 0 ? ' on' : ''}`} onClick={() => toggle(it)} aria-pressed={n >= 0}>
                  <span className="pick-photo">
                    <img src={it.cover_url} alt="" loading="lazy" />
                    {n >= 0 && <em>{n + 1}</em>}
                  </span>
                  <span className="pick-name" translate="no">{it.name}</span>
                  <span className="pick-price">{money(it.rental_price)}/day</span>
                </button>
              );
            })}
          </div>
          <div className="pick-bar">
            <span>{`${picked.length} of ${STUDIO_MAX} picked`}</span>
            <button type="button" className="btn accent lg" disabled={!picked.length} onClick={next}>
              Next: make the video <Glyph name="clapper" size={17} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
