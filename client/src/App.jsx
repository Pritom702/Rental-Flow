// ============================================================
//  RentalFlow  |  Sprint 1  |  Owner: M4 - Radowanul Haque (Radowan)
//  GitHub: @___  |  Part: App routing + navigation shell
// ============================================================
// Two shells:
//   PublicShell — slim header for marketing / signed-out pages.
//   AppShell    — persistent sidebar + topbar for the signed-in workspace.
// Sidebar links are grouped so the workspace stays readable as features grow.
import { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route, NavLink, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
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
import { api } from './api.js';
import ThemeToggle from './components/ThemeToggle.jsx';
import NotificationBell from './components/NotificationBell.jsx';
import RewardLayer, { XpRing } from './social/RewardLayer.jsx';
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
const TABS = ['/feed', '/browse', null, '/messages', '/bookings'];
function tabIndex(pathname) {
  return TABS.findIndex((t) => t && (pathname === t || pathname.startsWith(`${t}/`)));
}

const BrandMark = () => (
  <>
    <span className="logo-mark"><Icon name="package" size={17} /></span>
    <span className="wordmark">Rental<span>Flow</span></span>
  </>
);

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
    ],
  },
];

// Page title shown in the topbar, so you always know where you are.
const PAGE_TITLES = {
  '/browse': 'Browse', '/dashboard': 'Listings', '/bookings': 'Bookings',
  '/customers': 'Customers', '/maintenance': 'Maintenance', '/analytics': 'Analytics',
  '/documents': 'Documents', '/admin': 'Admin', '/items/new': 'New listing',
  '/profile': 'My Profile', '/admin/verifications': 'ID reviews', '/messages': 'Messages', '/admin/incidents': 'Incidents',
  '/feed': 'Feed', '/communities': 'Communities', '/admin/moderation': 'Moderation',
};
function titleFor(pathname) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.endsWith('/edit')) return 'Edit listing';
  if (pathname.startsWith('/messages')) return 'Messages';
  if (pathname.startsWith('/product/')) return 'Listing';
  if (pathname.startsWith('/c/')) return `c/${pathname.slice(3)}`;
  if (pathname.startsWith('/post/')) return 'Post';
  if (pathname.startsWith('/u/')) return 'Profile';
  if (pathname.endsWith('/checkout')) return 'Check out';
  if (pathname.endsWith('/checkin')) return 'Check in';
  return 'Workspace';
}

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

function AppShell({ children }) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  // Phones: the + button asks what you want to make.
  const [creating, setCreating] = useState(false);

  // Close the mobile drawer (and the + sheet) whenever the route changes.
  useEffect(() => { setOpen(false); setCreating(false); }, [pathname]);

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

  return (
    <div className="shell">
      {open && <div className="sidebar-scrim" onClick={() => setOpen(false)} />}
      <aside className={`sidebar${open ? ' open' : ''}`}>
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
          <div className="side-user">
            <span className="side-avatar">{initials(user?.name)}</span>
            <div className="side-user-meta">
              <div className="side-user-name">{user?.name}</div>
              <div className="side-user-role">{user?.role}</div>
            </div>
          </div>
          <button className="side-logout" onClick={logout}>
            <Icon name="logout" size={15} /> Sign out
          </button>
        </div>
      </aside>

      <div className="shell-main">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setOpen(true)} aria-label="Open navigation">
            <Icon name="menu" size={18} />
          </button>
          <span className="crumb">RentalFlow / <b>{titleFor(pathname)}</b></span>
          <div className="spacer" />
          <Link to="/items/new" className="btn small hide-sm"><Icon name="plus" size={14} /> New listing</Link>
          <XpRing />
          <ThemeToggle />
          <NotificationBell />
        </header>
        {/* Keyed by path: every page change replays the fade-up entrance. */}
        <div key={pathname} className="page-enter"><Suspense fallback={<PageLoading />}>{children}</Suspense></div>
      </div>

      {creating && (
        <div className="create-sheet-backdrop" onClick={() => setCreating(false)}>
          <div className="create-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Create">
            <b className="create-title">What do you want to do?</b>
            <Link to="/feed?compose=post" className="create-opt"><span>✍️</span><div><b>Post</b><small>Photos, videos, questions, polls</small></div></Link>
            <Link to="/feed?tab=sale&compose=sell" className="create-opt sell"><span>🏷️</span><div><b>Sell something</b><small>Buyers message you directly</small></div></Link>
            <Link to="/items/new" className="create-opt"><span>📦</span><div><b>Rent it out</b><small>List an item and earn every day</small></div></Link>
          </div>
        </div>
      )}

      {/* Phones: an app-style tab bar with the five things people do most. */}
      <nav className="tabbar" aria-label="Main" style={{ '--tab': tabIndex(pathname) }}>
        {tabIndex(pathname) >= 0 && <span className="tab-pill" aria-hidden="true" />}
        <NavLink to="/feed"><Icon name="sparkles" size={21} />Feed</NavLink>
        <NavLink to="/browse"><Icon name="search" size={21} />Rent</NavLink>
        <button type="button" className="tab-create" aria-label="Create" onClick={() => setCreating(true)}><span className="tab-plus"><Icon name="plus" size={24} /></span></button>
        <NavLink to="/messages">
          <Icon name="chat" size={21} />Messages
          {unread > 0 && <span className="tab-badge">{unread}</span>}
        </NavLink>
        <NavLink to="/bookings"><Icon name="calendar" size={21} />Bookings</NavLink>
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
        <Route path="/flow" element={<Flow />} />
        <Route path="/reels" element={<Navigate to="/flow" replace />} />
        <Route path="/sell" element={<Navigate to="/feed?tab=sale&compose=sell" replace />} />
        <Route path="/admin/moderation" element={<RequireAdmin><Moderation /></RequireAdmin>} />
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
