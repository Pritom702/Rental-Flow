// ============================================================
//  RentalFlow  |  Sprint 1  |  Owner: M3 - Promit Ghosh Turjo (Promit)
//  GitHub: @___  |  Part: Login / Signup page
// ============================================================
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { Icon } from '../icons.jsx';

export default function Login() {
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'member' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') await login(form.email, form.password);
      else await signup(form.name, form.email, form.password, form.role);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-split">
      <aside className="auth-aside">
        <h2>Rent smarter.<br />Earn from what you own.</h2>
        <p>Join RentalFlow to list your equipment and rent from members — all with tracked availability, deposits, and condition reports.</p>
        <div className="points">
          <div><Icon name="check" size={18} /> List an item in under a minute</div>
          <div><Icon name="check" size={18} /> Booking conflicts caught automatically</div>
          <div><Icon name="check" size={18} /> Deposits &amp; damage handled fairly</div>
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-wrap">
          <form className="form" onSubmit={submit} style={{ maxWidth: 'none' }}>
            <h2 style={{ fontSize: 26, marginBottom: 4 }}>{mode === 'login' ? 'Welcome back' : 'Join RentalFlow'}</h2>
            <p className="muted" style={{ marginBottom: 22 }}>
              {mode === 'login' ? 'Log in to manage your listings.' : 'Create an account to start listing and renting.'}
            </p>

            {mode === 'signup' && (
              <div className="field">
                <label>Full name</label>
                <input value={form.name} onChange={set('name')} required autoComplete="name" />
              </div>
            )}
            <div className="field">
              <label>Email</label>
              <input type="email" value={form.email} onChange={set('email')} required autoComplete="email" />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" value={form.password} onChange={set('password')} required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            </div>
            {mode === 'signup' && (
              <div className="field">
                <label>Sign up as</label>
                <select value={form.role} onChange={set('role')}>
                  <option value="member">Member — list &amp; rent equipment</option>
                  <option value="admin">Admin — manage the platform</option>
                </select>
              </div>
            )}

            {error && <div className="error"><Icon name="shield" size={16} /> {error}</div>}

            <button className="btn lg" style={{ width: '100%' }} disabled={busy}>
              {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
            </button>

            <p className="muted" style={{ textAlign: 'center', marginTop: 18 }}>
              {mode === 'login' ? "No account yet?" : 'Already have one?'}{' '}
              <a href="#" onClick={(e) => { e.preventDefault(); setError(''); setMode(mode === 'login' ? 'signup' : 'login'); }}>
                {mode === 'login' ? 'Sign up' : 'Log in'}
              </a>
            </p>

            {mode === 'login' && (
              <div className="hint">
                <b>Demo accounts</b><br />
                Member — rahim@rentalflow.test / member123<br />
                Member — karim@rentalflow.test / member123<br />
                Admin — admin@rentalflow.test / admin123
              </div>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}
