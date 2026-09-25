// ============================================================
//  RentalFlow  |  Sprint 1  |  Owner: M4 - Radowanul Haque (Radowan)
//  GitHub: @___  |  Part: App routing + navigation shell
// ============================================================
// Two shells:
//   PublicShell — slim header for marketing / signed-out pages.
//   AppShell    — a top bar with the main places as buttons (and "More"),
//                 a Create button and the account menu. On phones: a bottom
//                 tab bar, and the full menu slides in from the side.
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Routes, Route, NavLink, Navigate, Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { Icon } from './icons.jsx';
import Landing from './pages/Landing.jsx';
const PublicBooking = lazy(() => import('./pages/PublicBooking.jsx'));
const Login = lazy(() => import('./pages/Login.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const ItemForm = lazy(() => import('./pages/ItemForm.jsx'));
const Bookings = lazy(() => import('./pages/Bookings.jsx'));
const Scan = lazy(() => import('./pages/Scan.jsx'));
const Checkout = lazy(() => import('./pages/Checkout.jsx'));
const Customers = lazy(() => import('./pages/Customers.jsx'));
const Analytics = lazy(() => import('./pages/Analytics.jsx'));
const Documents = lazy(() => import('./pages/Documents.jsx'));
const Maintenance = lazy(() => import('./pages/Maintenance.jsx'));
const Admin = lazy(() => import('./pages/Admin.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const Verify = lazy(() => import('./pages/Verify.jsx'));
const VerificationReview = lazy(() => import('./pages/VerificationReview.jsx'));
const PhoneHandoff = lazy(() => import('./pages/PhoneHandoff.jsx'));
const ProductDetail = lazy(() => import('./pages/ProductDetail.jsx'));
const Messages = lazy(() => import('./pages/Messages.jsx'));
const Incidents = lazy(() => import('./pages/Incidents.jsx'));
const Feed = lazy(() => import('./pages/Feed.jsx'));
const PostPage = lazy(() => import('./pages/PostPage.jsx'));
const Flow = lazy(() => import('./pages/Flow.jsx'));
const UserProfile = lazy(() => import('./pages/UserProfile.jsx'));
const Communities = lazy(() => import('./pages/Communities.jsx'));
const Moderation = lazy(() => import('./pages/Moderation.jsx'));
const Limes = lazy(() => import('./pages/Limes.jsx'));
const TestCheckout = lazy(() => import('./pages/TestCheckout.jsx'));
const Studio = lazy(() => import('./pages/Studio.jsx'));
const Revenue = lazy(() => import('./pages/Revenue.jsx'));
import { api } from './api.js';
import ThemeToggle from './components/ThemeToggle.jsx';
import NotificationBell from './components/NotificationBell.jsx';
import RewardLayer, { XpRing, LimesChip } from './social/RewardLayer.jsx';
import { Glyph } from './social/glyphs.jsx';
import { useMe } from './social/store.js';
import { installLinkTransitions } from './transitions.js';

// Pages load on first visit, so the first screen downloads only what it needs.
// Once the browser is idle, the everyday pages are fetched ahead of time so
// moving around is instant (the heavy PDF / face-check pages still wait).
const PageLoading = () => <div className="page-loading" aria-label="Loading" />;
const PREFETCH = [
  () => import('./pages/PublicBooking.jsx'), () => import('./pages/ProductDetail.jsx'), () => import('./pages/Login.jsx'),
  () => import('./pages/Messages.jsx'), () => import('./pages/Dashboard.jsx'), () => import('./pages/ItemForm.jsx'),
  () => import('./pages/Profile.jsx'), () => import('./pages/Feed.jsx'), () => import('./pages/PostPage.jsx'),
  () => import('./pages/UserProfile.jsx'),
];
function usePrefetch() {
  useEffect(() => {
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 1500));
    idle(() => PREFETCH.forEach((load) => load().catch(() => {})));
  }, []);
}

// Tabs in the phone tab bar, in order; the lime pill slides to the active one.
const TABS = ['/feed', '/communities', null, '/browse', '/messages'];
function tabIndex(pathname) {
  return TABS.findIndex((t) => t && (pathname === t || pathname.startsWith(`${t}/`)));
}

// The RentalFlow mark: a package box whose lid unfolds into a flowing wave.
const BrandMark = () => (
  <>
    <img src="/brand/logo-tile.svg" alt="" className="logo-img" width="34" height="34" />
    <span className="wordmark">Rental<span>Flow</span></span>
  </>
);
// The illustrated button icons that go with the mark (public/brand/icons/).
const BrandIcon = ({ name, size = 26 }) => <img src={`/brand/icons/${name}.png`} alt="" className="b-icon" width={size} height={size} />;

// Sidebar structure. `admin: true` entries only render for admins.
const NAV_GROUPS = [
  {
    label: 'Community',
    links: [
      { to: '/feed', icon: 'sparkles', label: 'Feed' },
      { to: '/communities', icon: 'users', label: 'Communities' },
    ],
  },
  {
    label: 'Marketplace',
    links: [
      { to: '/browse', icon: 'search', label: 'Browse' },
      { to: '/sell', icon: 'tag', label: 'Sell something' },
      { to: '/studio', icon: 'sparkles', label: 'Video Studio' },
      { to: '/limes', icon: 'wallet', label: 'Limes' },
      { to: '/messages', icon: 'chat', label: 'Messages', badge: 'unread' },
      { to: '/dashboard', icon: 'package', label: 'My Listings', adminLabel: 'All Listings' },
    ],
  },
  {
    label: 'Operations',
    links: [
      { to: '/bookings', icon: 'calendar', label: 'Bookings' },
      { to: '/customers', icon: 'users', label: 'Customers' },
      { to: '/maintenance', icon: 'tool', label: 'Maintenance' },
    ],
  },
  {
    label: 'Records',
    links: [
      { to: '/analytics', icon: 'chart', label: 'Analytics' },
      { to: '/documents', icon: 'file', label: 'Documents' },
      { to: '/profile', icon: 'user', label: 'My Profile' },
      { to: '/admin', icon: 'settings', label: 'Admin', admin: true },
      { to: '/admin/verifications', icon: 'shield', label: 'ID reviews', admin: true },
      { to: '/admin/incidents', icon: 'alert', label: 'Incidents', admin: true },
      { to: '/admin/moderation', icon: 'shield', label: 'Moderation', admin: true },
      { to: '/admin/revenue', icon: 'chart', label: 'Revenue', admin: true },
    ],
  },
];

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

// The top bar's main buttons: our own glyph in a tile, a word, and for some a
// little tag. Everything else lives under "More".
const TOP_NAV = [
  { to: '/feed', icon: 'feed', label: 'Feed' },
  { to: '/flows', icon: 'flows', label: 'Flows', tag: 'New' },
  { to: '/communities', icon: 'communities', label: 'Communities' },
  { to: '/browse', icon: 'rent', label: 'Rent' },
  { to: '/sell', icon: 'sell', label: 'Sell', tag: 'Hot', hot: true },
  { to: '/messages', icon: 'messages', label: 'Messages', badge: 'unread', sub: true },
  { to: '/bookings', icon: 'bookings', label: 'Bookings', sub: true },
];
const MORE_NAV = NAV_GROUPS.flatMap((g) => g.links)
  .filter((l) => !TOP_NAV.some((t) => t.to === l.to) && l.to !== '/sell');

function useOutside(ref, open, close) {
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) close(); };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [ref, open, close]);
}

function AppShell({ children }) {
  const { user, logout } = useAuth();
  const meStats = useMe();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);        // phones: the slide-out menu
  const [creating, setCreating] = useState(false); // the Create choices
  const [more, setMore] = useState(false);
  const [me, setMeMenu] = useState(false);
  const moreRef = useRef(null);
  const meRef = useRef(null);
  const createRef = useRef(null);
  useOutside(moreRef, more, () => setMore(false));
  useOutside(meRef, me, () => setMeMenu(false));
  useOutside(createRef, creating, () => setCreating(false));

  // Close every menu whenever the route changes.
  useEffect(() => { setOpen(false); setCreating(false); setMore(false); setMeMenu(false); }, [pathname]);

  // Unread chat messages, for the badge on "Messages". Re-checked on every
  // page change and every 20 seconds.
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let alive = true;
    const check = () => api.get('/messages/unread').then((r) => alive && setUnread(r.count)).catch(() => {});
    check();
    const t = setInterval(check, 20000);
    return () => { alive = false; clearInterval(t); };
  }, [pathname]);

  const moreLinks = MORE_NAV.filter((l) => !l.admin || user?.role === 'admin');
  const moreActive = moreLinks.some((l) => pathname === l.to || pathname.startsWith(`${l.to}/`));
  const createChoices = (
    <>
      <Link to="/feed?compose=post" className="create-opt"><span><BrandIcon name="feed" size={32} /></span><div><b>Post</b><small>Photos, videos, questions, polls</small></div></Link>
      <Link to="/feed?tab=sale&compose=sell" className="create-opt sell"><span><BrandIcon name="sell" size={32} /></span><div><b>Sell something</b><small>Buyers message you directly</small></div></Link>
      <Link to="/items/new" className="create-opt"><span><BrandIcon name="rent" size={32} /></span><div><b>Rent it out</b><small>List an item and earn every day</small></div></Link>
      <Link to="/studio" className="create-opt"><span><BrandIcon name="studio" size={32} /></span><div><b>Make a video</b><small>Turn listings into a video in one tap</small></div></Link>
    </>
  );

  return (
    <div className="shell shell-top">
      {/* Phones: the full menu slides in from the side. */}
      {open && <div className="sidebar-scrim" onClick={() => setOpen(false)} />}
      <aside className={`sidebar drawer${open ? ' open' : ''}`} aria-hidden={!open}>
        <Link to="/" className="brand"><BrandMark /></Link>
        <nav className="side-nav">
          {NAV_GROUPS.map((group) => {
            const links = group.links.filter((l) => !l.admin || user?.role === 'admin');
            if (!links.length) return null;
            return (
              <div className="side-group" key={group.label}>
                <div className="side-group-label">{group.label}</div>
                {links.map((l) => (
                  <NavLink key={l.to} to={l.to} end={l.to === '/admin'} className="side-link">
                    <Icon name={l.icon} size={17} />
                    {user?.role === 'admin' && l.adminLabel ? l.adminLabel : l.label}
                    {l.badge === 'unread' && unread > 0 && <span className="side-badge">{unread}</span>}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="side-foot">
          <div className="me-toggles drawer-toggles"><span>Sound &amp; theme</span><ThemeToggle /></div>
          <button className="side-logout" onClick={logout}><Icon name="logout" size={15} /> Sign out</button>
        </div>
      </aside>

      <header className="topnav">
        <button className="menu-btn tn-menu" onClick={() => setOpen(true)} aria-label="Open the menu"><Icon name="menu" size={18} /></button>
        <Link to="/feed" className="brand tn-brand"><BrandMark /></Link>

        <nav className="tn-nav" aria-label="Main">
          {TOP_NAV.map((l) => (
            <NavLink key={l.to} to={l.to} className={`tn-btn${l.hot ? ' hot' : ''}${l.sub ? ' tn-sub' : ''}`} title={l.label}>
              <span className="tn-tile"><BrandIcon name={l.icon} /></span>
              <span className="tn-label">{l.label}</span>
              {l.tag && <em className={`tn-tag${l.hot ? ' hot' : ''}`}>{l.tag}</em>}
              {l.badge === 'unread' && unread > 0 && <span className="tn-count">{unread > 9 ? '9+' : unread}</span>}
            </NavLink>
          ))}
          <div className="tn-more" ref={moreRef}>
            <button type="button" className={`tn-btn tn-sub${moreActive ? ' active' : ''}${more ? ' open' : ''}`} onClick={() => setMore((v) => !v)} aria-expanded={more}>
              <span className="tn-tile"><BrandIcon name="more" /></span>
              <span className="tn-label">More</span>
            </button>
            {more && (
              <div className="tn-pop more-pop">
                {moreLinks.map((l) => (
                  <NavLink key={l.to} to={l.to} end={l.to === '/admin'} className="tn-pop-link">
                    <Icon name={l.icon} size={16} />
                    {user?.role === 'admin' && l.adminLabel ? l.adminLabel : l.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="tn-right">
          <LimesChip />
          <XpRing />
          <div className="tn-create" ref={createRef}>
            <button type="button" className="tn-create-btn" onClick={() => setCreating((v) => !v)} aria-expanded={creating}>
              <BrandIcon name="create" size={24} /><span>Create</span>
            </button>
            {creating && <div className="tn-pop create-pop">{createChoices}</div>}
          </div>
          <ThemeToggle className="tn-toggles" />
          <NotificationBell />
          <div className="tn-me" ref={meRef}>
            <button type="button" className="tn-avatar" onClick={() => setMeMenu((v) => !v)} aria-label="Your account" aria-expanded={me}>
              {meStats?.avatar_url ? <img src={meStats.avatar_url} alt="" /> : initials(user?.name)}
            </button>
            {me && (
              <div className="tn-pop me-pop">
                <div className="me-head"><b>{user?.name}</b><span>{user?.email}</span></div>
                {/* Sound and light/dark live here too — on phones the top bar has no room for them. */}
                <div className="me-toggles"><span>Sound &amp; theme</span><ThemeToggle /></div>
                <Link to="/u/me" className="tn-pop-link"><Glyph name="sparkle" size={16} /> My profile & badges</Link>
                <Link to="/profile" className="tn-pop-link"><Icon name="settings" size={16} /> Account settings</Link>
                <Link to="/dashboard" className="tn-pop-link"><Icon name="package" size={16} /> {user?.role === 'admin' ? 'All listings' : 'My listings'}</Link>
                <button type="button" className="tn-pop-link danger" onClick={logout}><Icon name="logout" size={16} /> Sign out</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="shell-main">
        {/* Keyed by path: every page change replays the fade-up entrance. */}
        <div key={pathname} className="page-enter"><Suspense fallback={<PageLoading />}>{children}</Suspense></div>
      </main>

      {/* Phones: the + button's choices, as a sheet from the bottom. */}
      {creating && (
        <div className="create-sheet-backdrop only-phone" onClick={() => setCreating(false)}>
          <div className="create-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Create">
            <b className="create-title">What do you want to do?</b>
            {createChoices}
          </div>
        </div>
      )}

      {/* Phones: an app-style tab bar with the five things people do most. */}
      <nav className="tabbar" aria-label="Main" style={{ '--tab': tabIndex(pathname) }}>
        {tabIndex(pathname) >= 0 && <span className="tab-pill" aria-hidden="true" />}
        <NavLink to="/feed"><BrandIcon name="feed" size={24} />Feed</NavLink>
        <NavLink to="/communities"><BrandIcon name="communities" size={24} />Communities</NavLink>
        <button type="button" className="tab-create" aria-label="Create" onClick={() => setCreating(true)}><span className="tab-plus"><BrandIcon name="create" size={34} /></span></button>
        <NavLink to="/browse"><BrandIcon name="rent" size={24} />Rent</NavLink>
        <NavLink to="/messages">
          <BrandIcon name="messages" size={24} />Messages
          {unread > 0 && <span className="tab-badge">{unread}</span>}
        </NavLink>
      </nav>
    </div>
  );
}

function PublicShell({ children }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  return (
    <>
      <header className="pubnav">
        <Link to="/" className="brand"><BrandMark /></Link>
        <NavLink to="/browse" className="hide-sm">Browse</NavLink>
        <NavLink to="/feed" className="hide-sm">Community</NavLink>
        <div className="spacer" />
        <ThemeToggle />
        {user ? (
          <Link to="/dashboard" className="btn small">Open workspace</Link>
        ) : (
          <>
            <NavLink to="/login" className="hide-sm">Log in</NavLink>
            <Link to="/login" className="btn small">Get started</Link>
          </>
        )}
      </header>
      <div key={pathname} className="page-enter"><Suspense fallback={<PageLoading />}>{children}</Suspense></div>
    </>
  );
}

// Guard: only an admin may pass (Sprint 4 / F20 admin console).
function RequireAdmin({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <AppShell>{children}</AppShell>;
}

// A new member must confirm their email before the workspace opens. (The API
// enforces the same rule; this just avoids flashing a page that would only
// answer "verification required".) The ID check comes later, at the first listing.
function needsVerification(user) {
  return user?.role === 'member' && user.emailVerified === false;
}

// Guard: any logged-in user (member or admin) may pass.
function RequireAuth({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (needsVerification(user)) return <Navigate to="/verify" replace />;
  return <AppShell>{children}</AppShell>;
}

// The verification flow: signed in, full screen, no workspace chrome.
function RequireLogin({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// Browse is public, so it gets whichever shell fits the visitor.
function AnyShell({ children }) {
  const { user } = useAuth();
  const Shell = user && !needsVerification(user) ? AppShell : PublicShell;
  return <Shell>{children}</Shell>;
}

// An invite link: remember who invited us, then sign up. The reward layer
// credits both people once the new account exists.
function JoinWithInvite() {
  const { code } = useParams();
  const { user } = useAuth();
  try { localStorage.setItem('rentalflow_invite', String(code).toUpperCase()); } catch { /* private mode */ }
  return <Navigate to={user ? '/feed' : '/login?mode=signup&next=/feed'} replace />;
}

export default function App() {
  const navigate = useNavigate();
  useEffect(() => installLinkTransitions(navigate), [navigate]);
  usePrefetch();
  return (
    <>
    {/* XP pops, level ups, badges and moderation notices — on every page. */}
    <RewardLayer />
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/" element={<PublicShell><Landing /></PublicShell>} />
        <Route path="/browse" element={<AnyShell><PublicBooking /></AnyShell>} />
        <Route path="/product/:id" element={<AnyShell><ProductDetail /></AnyShell>} />
        <Route path="/feed" element={<AnyShell><Feed /></AnyShell>} />
        <Route path="/c/:slug" element={<AnyShell><Feed /></AnyShell>} />
        <Route path="/post/:id" element={<AnyShell><PostPage /></AnyShell>} />
        <Route path="/u/:who" element={<AnyShell><UserProfile /></AnyShell>} />
        <Route path="/communities" element={<AnyShell><Communities /></AnyShell>} />
        <Route path="/flows" element={<Flow />} />
        <Route path="/flow" element={<Navigate to="/flows" replace />} />
        <Route path="/reels" element={<Navigate to="/flows" replace />} />
        <Route path="/sell" element={<Navigate to="/feed?tab=sale&compose=sell" replace />} />
        <Route path="/admin/moderation" element={<RequireAdmin><Moderation /></RequireAdmin>} />
        <Route path="/admin/revenue" element={<RequireAdmin><Revenue /></RequireAdmin>} />
        <Route path="/limes" element={<RequireAuth><Limes /></RequireAuth>} />
        <Route path="/checkout/:tran" element={<RequireAuth><TestCheckout /></RequireAuth>} />
        <Route path="/studio" element={<RequireAuth><Studio /></RequireAuth>} />
        <Route path="/join/:code" element={<JoinWithInvite />} />
        <Route path="/messages" element={<RequireAuth><Messages /></RequireAuth>} />
        <Route path="/messages/:id" element={<RequireAuth><Messages /></RequireAuth>} />
        <Route path="/login" element={<Login />} />
        <Route path="/verify" element={<RequireLogin><Verify /></RequireLogin>} />
        <Route path="/verify/phone/:token" element={<PhoneHandoff />} />
        <Route path="/scan/:token" element={<PublicShell><Scan /></PublicShell>} />
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/bookings" element={<RequireAuth><Bookings /></RequireAuth>} />
        <Route path="/items/new" element={<RequireAuth><ItemForm /></RequireAuth>} />
        <Route path="/items/:id/edit" element={<RequireAuth><ItemForm /></RequireAuth>} />
        <Route path="/bookings/:id/checkout" element={<RequireAuth><Checkout mode="checkout" /></RequireAuth>} />
        <Route path="/bookings/:id/checkin" element={<RequireAuth><Checkout mode="checkin" /></RequireAuth>} />
        <Route path="/customers" element={<RequireAuth><Customers /></RequireAuth>} />
        <Route path="/analytics" element={<RequireAuth><Analytics /></RequireAuth>} />
        <Route path="/documents" element={<RequireAuth><Documents /></RequireAuth>} />
        <Route path="/maintenance" element={<RequireAuth><Maintenance /></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
        <Route path="/admin/verifications" element={<RequireAdmin><VerificationReview /></RequireAdmin>} />
        <Route path="/admin/incidents" element={<RequireAdmin><Incidents /></RequireAdmin>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
    </>
  );
}
