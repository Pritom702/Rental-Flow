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
        <Route path="/items/new" element={<RequireAuth><ItemForm /></RequireAuth>} />
        <Route path="/items/:id/edit" element={<RequireAuth><ItemForm /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
