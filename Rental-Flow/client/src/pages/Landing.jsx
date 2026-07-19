// ============================================================
//  RentalFlow  |  Sprint 1  |  Owner: M4 - Radowanul Haque (Radowan)
//  GitHub: @___  |  Part: Marketing landing page
// ============================================================
// Marketing landing page (Marketplace / Directory pattern):
// hero search → categories → featured listings → trust → CTA → footer.
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Icon, categoryIcon } from '../icons.jsx';
import { StatusBadge, TagList, CardPhoto } from '../components.jsx';

// Reveal elements as they scroll into view. Re-scans whenever `deps` change so
// that async-rendered items (categories, featured listings) get picked up too.
function useReveal(ref, deps) {
  useEffect(() => {
    const els = ref.current?.querySelectorAll('.reveal:not(.in)') || [];
    if (!els.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    els.forEach((el) => io.observe(el));
    // Safety net: guarantee visibility even if the observer never fires
    // (headless render, no-scroll, unsupported browser, etc.).
    const t = setTimeout(() => els.forEach((el) => el.classList.add('in')), 500);
    return () => { io.disconnect(); clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export default function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [term, setTerm] = useState('');
  const root = useRef(null);
  useReveal(root, [categories, featured]);

  useEffect(() => {
    api.get('/categories').then(setCategories).catch(() => {});
    api.get('/items?status=Available').then((d) => setFeatured(d.slice(0, 6))).catch(() => {});
  }, []);

  const totalItems = categories.reduce((s, c) => s + (c.item_count || 0), 0);

  function search(e) {
    e.preventDefault();
    navigate(`/browse?search=${encodeURIComponent(term.trim())}`);
  }

  return (
    <div ref={root}>
      {/* ---------- Hero ---------- */}
      <section className="hero">
        <div className="hero-inner">
          <span className="eyebrow"><Icon name="sparkles" size={15} /> Peer-to-peer rentals · <b>list once, earn again</b></span>
          <h1 className="hero-title">Rent the gear you need.<br /><span className="grad">Earn from the gear you own.</span></h1>
          <p className="hero-sub">
            RentalFlow is the marketplace where members list cameras, tools, and event equipment —
            and rent from each other with clear availability, deposits, and condition tracking.
          </p>

          <form className="hero-search" onSubmit={search}>
            <div className="search-field">
              <Icon name="search" size={20} />
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search cameras, drills, speakers…"
                aria-label="Search rentals"
              />
            </div>
            <button className="btn lg" type="submit">Search</button>
          </form>

          <div className="chip-row">
            {categories.slice(0, 6).map((c) => (
              <button key={c.id} className="chip" onClick={() => navigate(`/browse?category_id=${c.id}`)}>
                {c.name}
              </button>
            ))}
          </div>

          <div className="hero-stats">
            <div className="stat"><b>{totalItems}+</b><span>items listed</span></div>
            <div className="stat"><b>{categories.length}</b><span>categories</span></div>
            <div className="stat"><b>24/7</b><span>self-service</span></div>
          </div>
        </div>
      </section>

      {/* ---------- Categories ---------- */}
      <section className="section">
        <div className="section-head reveal">
          <h2>Browse by category</h2>
          <p>From full-frame cameras to power tools — find exactly what your project needs.</p>
        </div>
        <div className="cat-grid">
          {categories.slice(0, 12).map((c) => (
            <div key={c.id} className="cat-card reveal" onClick={() => navigate(`/browse?category_id=${c.id}`)}>
              <span className="cat-icon"><Icon name={categoryIcon(c.name)} size={22} /></span>
              <div>
                <div className="cat-name">{c.name}</div>
                <div className="cat-count">{c.item_count} item{c.item_count === 1 ? '' : 's'}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Featured listings ---------- */}
      {featured.length > 0 && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="section-head reveal">
            <h2>Available now</h2>
            <p>Fresh listings ready to rent from members near you.</p>
          </div>
          <div className="grid">
            {featured.map((it) => (
              <Link to="/browse" key={it.id} className="card reveal" style={{ color: 'inherit' }}>
                <CardPhoto url={it.cover_url} count={it.image_count} />
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <h3>{it.name}</h3>
                  <StatusBadge status={it.status} />
                </div>
                <div className="serial">Listed by <b>{it.owner_name}</b></div>
                <TagList tags={it.tags} />
                <div className="price" style={{ marginTop: 10 }}>
                  ${Number(it.rental_price).toFixed(2)} <span>/ day</span>
                </div>
              </Link>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <Link to="/browse" className="btn secondary lg">View all listings <Icon name="arrow-right" size={18} /></Link>
          </div>
        </section>
      )}

      {/* ---------- Trust / Safety ---------- */}
      <section className="section">
        <div className="section-head reveal">
          <h2>Built for trust</h2>
          <p>Every rental is tracked end-to-end so both sides stay protected.</p>
        </div>
        <div className="trust-grid">
          {[
            { icon: 'calendar', bg: 'var(--primary)', h: 'No double bookings', p: 'Real-time availability and conflict detection keep every item honest about when it is free.' },
            { icon: 'wallet', bg: 'var(--accent)', h: 'Deposits & fair fees', p: 'Refundable deposits, transparent late fees, and damage penalties are calculated automatically.' },
            { icon: 'shield', bg: '#4C1D95', h: 'Condition on record', p: 'Photo condition reports at checkout and check-in mean disputes are settled with evidence, not guesswork.' },
            { icon: 'bolt', bg: '#2563EB', h: 'QR fast checkout', p: 'Scan an item to check it out or back in — no paperwork, no manual entry mistakes.' },
          ].map((t) => (
            <div className="trust-card reveal" key={t.h}>
              <span className="t-icon" style={{ background: t.bg }}><Icon name={t.icon} size={24} /></span>
              <h3>{t.h}</h3>
              <p>{t.p}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="cta-band">
        <div className="cta-inner reveal">
          <h2>Got gear sitting idle?</h2>
          <p>Turn it into income. List an item in minutes and let the marketplace do the rest.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to={user ? '/items/new' : '/login'} className="btn accent lg">
              <Icon name="plus" size={18} /> List your item
            </Link>
            <Link to="/browse" className="btn secondary lg">Browse rentals</Link>
          </div>
        </div>
      </section>

      <footer className="footer">
        <span className="brand">Rental<span style={{ color: 'var(--primary)' }}>Flow</span></span> · Inventory &amp; booking for equipment renters<br />
        <span style={{ fontSize: 13 }}>A CSE470 project · built with React &amp; raw SQL</span>
      </footer>
    </div>
  );
}
