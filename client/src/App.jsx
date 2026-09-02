// ============================================================
//  RentalFlow  |  Sprint 1  |  Owner: M4 - Radowanul Haque (Radowan)
//  GitHub: @___  |  Part: App routing + navigation shell
// ============================================================
// Two shells:
//   PublicShell — slim header for marketing / signed-out pages.
//   AppShell    — persistent sidebar + topbar for the signed-in workspace.
// Sidebar links are grouped so the workspace stays readable as features grow.
import { useEffect, useState } from 'react';
import { Routes, Route, NavLink, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { Icon } from './icons.jsx';
import Landing from './pages/Landing.jsx';
import PublicBooking from './pages/PublicBooking.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ItemForm from './pages/ItemForm.jsx';
import Bookings from './pages/Bookings.jsx';
import Scan from './pages/Scan.jsx';
import Checkout from './pages/Checkout.jsx';
import Customers from './pages/Customers.jsx';
import Analytics from './pages/Analytics.jsx';
import Documents from './pages/Documents.jsx';
import Maintenance from './pages/Maintenance.jsx';
import Admin from './pages/Admin.jsx';
import Profile from './pages/Profile.jsx';
import NotificationBell from './components/NotificationBell.jsx';

const BrandMark = () => (
  <>
    <span className="logo-mark"><Icon name="package" size={17} /></span>
    <span className="wordmark">Rental<span>Flow</span></span>
  </>
);

// Sidebar structure. `admin: true` entries only render for admins.
const NAV_GROUPS = [
  {
    label: 'Marketplace',
    links: [
      { to: '/browse', icon: 'search', label: 'Browse' },
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
    ],
  },
];

// Page title shown in the topbar, so you always know where you are.
const PAGE_TITLES = {
  '/browse': 'Browse', '/dashboard': 'Listings', '/bookings': 'Bookings',
  '/customers': 'Customers', '/maintenance': 'Maintenance', '/analytics': 'Analytics',
  '/documents': 'Documents', '/admin': 'Admin', '/items/new': 'New listing',
  '/profile': 'My Profile',
};
function titleFor(pathname) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.endsWith('/edit')) return 'Edit listing';
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

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setOpen(false); }, [pathname]);

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
                  <NavLink key={l.to} to={l.to} className="side-link">
                    <Icon name={l.icon} size={17} />
                    {user?.role === 'admin' && l.adminLabel ? l.adminLabel : l.label}
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
          <Link to="/items/new" className="btn small"><Icon name="plus" size={14} /> New listing</Link>
          <NotificationBell />
        </header>
        {children}
      </div>
    </div>
  );
}

function PublicShell({ children }) {
  const { user } = useAuth();
  return (
    <>
      <header className="pubnav">
        <Link to="/" className="brand"><BrandMark /></Link>
        <NavLink to="/browse" className="hide-sm">Browse</NavLink>
        <div className="spacer" />
        {user ? (
          <Link to="/dashboard" className="btn small">Open workspace</Link>
        ) : (
          <>
            <NavLink to="/login" className="hide-sm">Log in</NavLink>
            <Link to="/login" className="btn small">Get started</Link>
          </>
        )}
      </header>
      {children}
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

// Guard: any logged-in user (member or admin) may pass.
function RequireAuth({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <AppShell>{children}</AppShell>;
}

// Browse is public, so it gets whichever shell fits the visitor.
function AnyShell({ children }) {
  const { user } = useAuth();
  const Shell = user ? AppShell : PublicShell;
  return <Shell>{children}</Shell>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicShell><Landing /></PublicShell>} />
      <Route path="/browse" element={<AnyShell><PublicBooking /></AnyShell>} />
      <Route path="/login" element={<Login />} />
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
