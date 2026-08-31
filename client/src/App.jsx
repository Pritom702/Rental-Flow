// ============================================================
//  RentalFlow  |  Sprint 1  |  Owner: M4 - Radowanul Haque (Radowan)
//  GitHub: @___  |  Part: App routing + navigation bar
// ============================================================
import { Routes, Route, NavLink, Navigate, Link } from 'react-router-dom';
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

function Nav() {
  const { user, logout } = useAuth();
  return (
    <nav className="nav">
      <Link to="/" className="brand">
        <span className="logo-mark"><Icon name="package" size={17} /></span>
        <span className="wordmark">Rental<span>Flow</span></span>
      </Link>
      <NavLink to="/browse">Browse</NavLink>
      {user && <NavLink to="/dashboard">{user.role === 'admin' ? 'Manage' : 'My Listings'}</NavLink>}
      {user && <NavLink to="/bookings">Bookings</NavLink>}
      {user && <NavLink to="/customers">Customers</NavLink>}
      {user && <NavLink to="/analytics">Analytics</NavLink>}
      {user && <NavLink to="/documents">Documents</NavLink>}
      {user && <NavLink to="/maintenance">Maintenance</NavLink>}
      {user?.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
      <div className="spacer" />
      {user ? (
        <>
          <span className="who">{user.name} · <b>{user.role}</b></span>
          <button className="btn secondary small" onClick={logout}>
            <Icon name="logout" size={15} /> Logout
          </button>
        </>
      ) : (
        <>
          <NavLink to="/login">Log in</NavLink>
          <Link to="/login" className="btn small">Get started</Link>
        </>
      )}
    </nav>
  );
}

// Guard: only an admin may pass (Sprint 4 / F20 admin console).
function RequireAdmin({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
}

// Guard: any logged-in user (member or admin) may pass.
function RequireAuth({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <>
      <Nav />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/browse" element={<PublicBooking />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/bookings" element={<RequireAuth><Bookings /></RequireAuth>} />
        <Route path="/items/new" element={<RequireAuth><ItemForm /></RequireAuth>} />
        <Route path="/items/:id/edit" element={<RequireAuth><ItemForm /></RequireAuth>} />
        <Route path="/scan/:token" element={<Scan />} />
        <Route path="/bookings/:id/checkout" element={<RequireAuth><Checkout mode="checkout" /></RequireAuth>} />
        <Route path="/bookings/:id/checkin" element={<RequireAuth><Checkout mode="checkin" /></RequireAuth>} />
        <Route path="/customers" element={<RequireAuth><Customers /></RequireAuth>} />
        <Route path="/analytics" element={<RequireAuth><Analytics /></RequireAuth>} />
        <Route path="/documents" element={<RequireAuth><Documents /></RequireAuth>} />
        <Route path="/maintenance" element={<RequireAuth><Maintenance /></RequireAuth>} />
        <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
