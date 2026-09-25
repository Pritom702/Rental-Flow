// ============================================================
//  RentalFlow  |  Sprint 1  |  Owner: M4 - Radowanul Haque (Radowan)
//  GitHub: @___  |  Part: Marketing landing page
//  Redesign ("Atelier"): M2 - Tawheed Bin Hamid (Pritom), @pritom702
// ============================================================
// Landing page: a hero (headline + search) beside a 3D carousel of real
// listings that glides from product to product and can be dragged or
// flicked → an endless strip of listings → categories → how it works → CTA.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Icon, categoryIcon } from '../icons.jsx';
import { money } from '../money.js';
import { t, useLang } from '../i18n.js';

// Reveal elements as they scroll into view.
function useReveal(ref, deps) {
  useEffect(() => {
    const els = ref.current?.querySelectorAll('.reveal:not(.in)') || [];
    if (!els.length) return undefined;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    els.forEach((el) => io.observe(el));
    const t = setTimeout(() => els.forEach((el) => el.classList.add('in')), 1200);
    return () => { io.disconnect(); clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// Count a number up from zero the first time it appears.
function CountUp({ to, suffix = '' }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!to) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(to); return undefined; }
    let frame;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / 1400);
      setN(Math.round(to * (1 - (1 - p) ** 3)));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to]);
  return <>{n}{suffix}</>;
}

// Split a line into words so each can rise in on its own beat.
// Split word by word for the entrance animation, so the words are put into
// the chosen language first (the page-wide translator only sees whole phrases).
function Words({ text, from = 0 }) {
  useLang();
  return t(text).split(' ').map((w, i) => (
    <span className="word" key={`${w}-${i}`} style={{ '--w': from + i }}>{w}&nbsp;</span>
  ));
}

// The carousel. Listings stand around a 3D cylinder that turns on a spring:
// it glides to a product (with a little overshoot), rests, then moves on.
// Drag or flick to turn it; tap a side tile to bring it forward; on a computer
// the ring leans towards the mouse. Each frame changes one transform on the
// ring plus each tile's opacity, the physics runs in fixed 60 Hz steps (same
// speed on any screen), and nothing runs while it is off screen.
const REST_MS = 2600;                                      // how long it rests on each product
function useCarousel(count, onFront) {
  const stage = useRef(null);
  const ring = useRef(null);
  const tiles = useRef([]);
  const ctl = useRef({ go: () => {}, wake: () => {} });

  useEffect(() => {
    const el = stage.current;
    if (!el || !count) return undefined;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const step = 360 / count;
    let angle = 0; let target = 0; let vel = 0;
    let drag = null; let front = -1; let frame = 0; let visible = true; let radius = 0;
    let restFrom = performance.now();
    let rest = REST_MS;
    let last = performance.now();
    const tilt = { x: 0, y: 0, tx: 0, ty: 0 };

    const layout = () => {
      const w = el.clientWidth * 0.4;                              // tile width, see .orbit-ring
      radius = (w / 2 / Math.tan(Math.PI / count)) * 1.12 + 12;
      tiles.current.forEach((t, i) => { if (t) t.style.transform = `rotateY(${i * step}deg) translateZ(${radius.toFixed(0)}px)`; });
    };

    ctl.current.go = (i) => {
      const cur = ((Math.round(-target / step) % count) + count) % count;
      let d = (((i - cur) % count) + count) % count;
      if (d > count / 2) d -= count;
      target -= d * step;
      rest = REST_MS * 1.5;
    };

    const render = () => {
      ring.current.style.transform = `translateZ(${(-radius).toFixed(0)}px) rotateX(${tilt.x.toFixed(2)}deg) rotateY(${(angle + tilt.y).toFixed(2)}deg)`;
      tiles.current.forEach((t, i) => {
        if (!t) return;
        const facing = Math.cos(((i * step + angle) * Math.PI) / 180);  // 1 = facing us
        t.style.opacity = Math.max(0, facing * 1.25 - 0.1).toFixed(3);
      });
      const f = ((Math.round(-angle / step) % count) + count) % count;
      if (f !== front) {
        front = f;
        tiles.current.forEach((t, i) => t?.classList.toggle('front', i === f));
        onFront(f);
      }
    };

    const tick = (now) => {
      frame = 0;
      const steps = Math.min(6, Math.max(1, Math.round((now - last) / 16.67)));
      last = now;
      let settled = false;
      if (!drag) {
        if (still) { angle = target; vel = 0; } else {
          for (let i = 0; i < steps; i += 1) {
            vel = (vel + (target - angle) * 0.03) * 0.82;            // an under-damped spring: ~10% overshoot
            angle += vel;
          }
        }
        settled = Math.abs(target - angle) < 0.01 && Math.abs(vel) < 0.01;
        if (settled) { angle = target; vel = 0; } else restFrom = now;
        if (!still && settled && now - restFrom > rest) { target -= step; rest = REST_MS; }
      }
      const ease = 1 - 0.92 ** steps;
      tilt.x += (tilt.tx - tilt.x) * ease;
      tilt.y += (tilt.ty - tilt.y) * ease;
      if (Math.abs(tilt.tx - tilt.x) < 0.01) tilt.x = tilt.tx;
      if (Math.abs(tilt.ty - tilt.y) < 0.01) tilt.y = tilt.ty;
      render();
      if (visible && !document.hidden && !(still && settled)) frame = requestAnimationFrame(tick);
    };
    const wake = () => {
      if (frame || !visible || document.hidden) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };
    ctl.current.wake = wake;

    const down = (e) => {
      if (e.button !== 0) return;
      drag = { x: e.clientX, start: angle, moved: false, last: e.clientX, t: performance.now(), v: 0 };
    };
    const move = (e) => {
      if (!drag) {
        if (still || e.pointerType !== 'mouse') return;
        const r = el.getBoundingClientRect();
        const inside = e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom;
        tilt.tx = inside ? -((e.clientY - r.top) / r.height - 0.5) * 12 : 0;
        tilt.ty = inside ? ((e.clientX - r.left) / r.width - 0.5) * 16 : 0;
        wake();
        return;
      }
      const dx = e.clientX - drag.x;
      if (Math.abs(dx) > 6 && !drag.moved) { drag.moved = true; el.classList.add('dragging'); }
      if (!drag.moved) return;
      const now = performance.now();
      const k = 150 / el.clientWidth;                                 // degrees per pixel
      angle = drag.start + dx * k;
      drag.v = ((e.clientX - drag.last) * k * 16) / Math.max(8, now - drag.t);
      drag.last = e.clientX; drag.t = now;
      target = angle; vel = 0;
      wake();
    };
    const up = () => {
      if (!drag) return;
      const { moved, v } = drag;
      drag = null;
      el.classList.remove('dragging');
      if (moved) {
        target = Math.round((angle + v * 12) / step) * step;          // a flick carries on, then lands on a tile
        rest = REST_MS * 1.5;
        el.dataset.dragged = '1';                                     // the click that ends a drag is not a click
        setTimeout(() => { delete el.dataset.dragged; }, 0);
      }
      wake();
    };
    const resize = () => { layout(); wake(); };

    layout();
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; wake(); });
    io.observe(el);
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('resize', resize);
    wake();
    return () => {
      cancelAnimationFrame(frame);
      io.disconnect();
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('resize', resize);
    };
  }, [count, onFront]);

  const go = useCallback((i) => { ctl.current.go(i); ctl.current.wake(); }, []);
  return { stage, ring, tiles, go };
}

export default function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [term, setTerm] = useState('');
  const [active, setActive] = useState(0);
  const root = useRef(null);

  useEffect(() => {
    api.get('/categories').then(setCategories).catch(() => {});
    api.get('/items?status=Available').then(setItems).catch(() => {});
  }, []);

  const withPhotos = useMemo(() => items.filter((i) => i.cover_url), [items]);
  // Cut-out product shots (transparent WebP/PNG) float best, so they lead.
  // Cut-out product shots (transparent WebP/PNG) float best, so they lead.
  const showcase = useMemo(() => [...withPhotos]
    .sort((a, b) => Number(/\.(webp|png)$/i.test(b.cover_url)) - Number(/\.(webp|png)$/i.test(a.cover_url)))
    .slice(0, 8), [withPhotos]);
  const liveCategories = categories.filter((c) => (c.item_count || 0) > 0).sort((a, b) => b.item_count - a.item_count);
  const totalItems = categories.reduce((s, c) => s + (c.item_count || 0), 0);

  useReveal(root, [categories, items]);

  const orbit = useCarousel(showcase.length, setActive);

  function search(e) {
    e.preventDefault();
    navigate(`/browse?search=${encodeURIComponent(term.trim())}`);
  }

  const current = showcase[active];
  const stripItems = withPhotos.length ? [...withPhotos, ...withPhotos] : [];   // doubled for a seamless loop

  return (
    <div ref={root}>
      {/* ---------- Hero ---------- */}
      <section className="atelier-hero">
        <div>
          <span className="hero-eyebrow">Rent from people near you</span>
          <h1 className="hero-h1">
            <Words text="Borrow the" />
            <em className="swoosh"><Words text="extraordinary." from={2} />
              <svg viewBox="0 0 300 20" preserveAspectRatio="none" aria-hidden="true"><path d="M4 14C60 5 170 2 296 9" /></svg>
            </em>
            <br />
            <Words text="Earn from the rest." from={3} />
          </h1>
          <p className="hero-lede">
            Cameras, consoles, drones, phones and home appliances — rented by the day from verified
            neighbours across Bangladesh, paid in Taka.
          </p>
          <form className="search-pill" onSubmit={search} role="search">
            <Icon name="search" size={19} />
            <input value={term} onChange={(e) => setTerm(e.target.value)}
              placeholder="What would you like to rent?" aria-label="Search rentals" />
            <button className="btn accent" type="submit"><span>Search</span> <Icon name="arrow-right" size={16} /></button>
          </form>
          <div className="hero-stats">
            <div><b><CountUp to={totalItems} suffix="+" /></b><span>items to rent</span></div>
            <div><b><CountUp to={categories.length} /></b><span>categories</span></div>
            <div><b><CountUp to={2} suffix=" min" /></b><span>one-time ID check</span></div>
          </div>
        </div>

        {showcase.length > 0 && (
          <div className="orbit" ref={orbit.stage}>
            <div className="orbit-glow" aria-hidden="true" />
            <div className="orbit-floor" aria-hidden="true" />
            <div className="orbit-ring" ref={orbit.ring}>
              {showcase.map((it, i) => (
                <Link key={it.id} to={`/product/${it.id}`} className="orbit-tile" draggable={false}
                  ref={(el) => { orbit.tiles.current[i] = el; }}
                  aria-hidden={i !== active} tabIndex={i === active ? 0 : -1}
                  onClick={(e) => {
                    // a drag is not a click, and a side tile comes forward first
                    if (orbit.stage.current?.dataset.dragged || i !== active) {
                      e.preventDefault();
                      if (i !== active) orbit.go(i);
                    }
                  }}>
                  <img src={it.cover_url} alt={it.name} draggable={false} decoding="async" />
                </Link>
              ))}
            </div>
            <span className="sticker sticker-a" aria-hidden="true"><Icon name="shield" size={15} /> Verified neighbours</span>
            <span className="sticker sticker-b" aria-hidden="true">Pay in ৳ Taka</span>
            {current && (
              <div className="orbit-caption">
                <button type="button" onClick={() => orbit.go((active - 1 + showcase.length) % showcase.length)} aria-label="Previous listing">‹</button>
                <Link to={`/product/${current.id}`} className="orbit-caption-body" key={current.id}>
                  <b>{current.name.length > 24 ? `${current.name.slice(0, 23)}…` : current.name}</b>
                  <span>{money(current.rental_price)}<small> / day</small></span>
                </Link>
                <button type="button" onClick={() => orbit.go((active + 1) % showcase.length)} aria-label="Next listing">›</button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ---------- Endless strip ---------- */}
      {stripItems.length > 0 && (
        <div className="strip" aria-label="Listings">
          <div className="strip-track">
            {stripItems.map((it, i) => (
              <Link key={`${it.id}-${i}`} to={`/product/${it.id}`} className="strip-card"
                aria-hidden={i >= withPhotos.length} tabIndex={i >= withPhotos.length ? -1 : 0}>
                <div className="strip-photo"><img src={it.cover_url} alt={it.name} loading="lazy" /></div>
                <div className="strip-body"><b>{it.name}</b><span>{money(it.rental_price)}</span></div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ---------- Categories ---------- */}
      {liveCategories.length > 0 && (
        <section className="l-section">
          <div className="l-head">
            <div>
              <span className="hero-eyebrow reveal">Categories</span>
              <h2 className="reveal">Something for <em>every</em> plan.</h2>
            </div>
            <p className="lead reveal">From a weekend shoot to a festive feast — everything here is listed by real people.</p>
          </div>
          <div className="cat-grid">
            {liveCategories.map((c) => (
              <button key={c.id} type="button" className="cat-card" onClick={() => navigate(`/browse?category_id=${c.id}`)}>
                <span className="cat-icon"><Icon name={categoryIcon(c.name)} size={20} /></span>
                <div>
                  <div className="cat-name">{c.name}</div>
                  <div className="cat-count">{c.item_count} {c.item_count === 1 ? 'item' : 'items'}</div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ---------- How it works ---------- */}
      <section className="l-section" style={{ paddingTop: 0 }}>
        <div className="l-head">
          <div>
            <span className="hero-eyebrow reveal">How it works</span>
            <h2 className="reveal">Three steps, <em>no fuss.</em></h2>
          </div>
          <p className="lead reveal">Every owner and seller is verified, so renting from a stranger feels like borrowing from a friend.</p>
        </div>
        <div className="steps">
          {[
            ['Find it', 'Search or browse, watch it in action in Flows, and chat with the owner before you book.', 'step-find'],
            ['Book safely', 'Owners verify their ID once. A refundable deposit and optional damage cover protect every rental.', 'step-safe'],
            ['Pick up & enjoy', 'Scan the QR at pickup, return it on time, and your deposit comes straight back.', 'step-enjoy'],
          ].map(([h, p, img], i) => (
            <div className="step step-art reveal" key={h}>
              <div className="step-img"><img src={`/landing/${img}.webp`} alt="" loading="lazy" width="1000" height="750" /></div>
              <b>0{i + 1}</b>
              <h3>{h}</h3>
              <p>{p}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- The community ---------- */}
      <section className="l-section l-split reveal">
        <div className="split-art"><img src="/landing/community.webp" alt="" loading="lazy" width="1600" height="900" /></div>
        <div className="split-copy">
          <span className="hero-eyebrow">Community</span>
          <h2>Watch it, <em>spark it,</em> rent it.</h2>
          <p className="lead">Short videos in Flows, a feed for every kind of gear, and people who know it inside out. Ask before you rent, show off what you made, sell what you no longer use.</p>
          <ul className="split-points">
            <li><span>01</span>Flows — gear in action, one swipe at a time</li>
            <li><span>02</span>Communities for cameras, drones, gaming and more</li>
            <li><span>03</span>Sparks, streaks and badges for everything you do</li>
          </ul>
          <Link to="/feed" className="btn accent lg">Open the feed <Icon name="arrow-right" size={18} /></Link>
        </div>
      </section>

      {/* ---------- Earn ---------- */}
      <section className="l-section l-split flip reveal">
        <div className="split-art"><img src="/landing/earn.webp" alt="" loading="lazy" width="1600" height="900" /></div>
        <div className="split-copy">
          <span className="hero-eyebrow">Earn</span>
          <h2>Your things <em>work</em> while you don't.</h2>
          <p className="lead">List it once and earn every time it's rented. Sell what you've outgrown. Turn any listing into a video in one tap and put it in front of thousands.</p>
          <ul className="split-points">
            <li><span>01</span>Rent out in under a minute — you set the price</li>
            <li><span>02</span>Limes for coming back, renting and inviting friends</li>
            <li><span>03</span>Boost a listing or run your video as an ad</li>
          </ul>
          <Link to={user ? '/items/new' : '/login?mode=signup'} className="btn lg">Start earning <Icon name="arrow-right" size={18} /></Link>
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="cta-band-x cta-art reveal" style={{ backgroundImage: 'url(/landing/shop.webp)' }}>
        <div>
          <h2>Your shelf is a <em>shop.</em></h2>
          <p>List a camera, a console or a stand mixer in under a minute — and earn every time it’s rented.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Link to={user ? '/items/new' : '/login'} className="btn lg"><Icon name="plus" size={18} /> List something</Link>
          <Link to="/browse" className="btn secondary lg">Browse rentals <Icon name="arrow-right" size={18} /></Link>
        </div>
      </section>

      <footer className="footer">
        <span className="brand wordmark">Rental<span>Flow</span></span> · Rent anything from people near you
      </footer>
    </div>
  );
}
