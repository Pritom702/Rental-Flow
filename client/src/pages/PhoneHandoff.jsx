// ============================================================
//  RentalFlow  |  Identity verification  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: phone side of the QR hand-off
// ============================================================
// The page a phone opens after scanning the QR code on a computer. It trades
// the one-time link for a normal session and drops the member straight into
// their current verification step — no password to type on a phone keyboard.
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

export default function PhoneHandoff() {
  const { token } = useParams();
  const { adoptSession } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const tried = useRef(false);   // a link works once: never send it twice

  useEffect(() => {
    if (tried.current) return;
    tried.current = true;
    api.post('/handoff/redeem', { token })
      .then(({ token: session, user }) => {
        adoptSession(session, user);
        navigate('/verify', { replace: true });
      })
      .catch((err) => setError(err.message));
  }, [token, adoptSession, navigate]);

  return (
    <div className="verify">
      <header className="verify-top"><span className="wordmark">Rental<span>Flow</span></span></header>
      <main className="verify-body">
        <div className="verify-step center">
          {error ? (
            <>
              <h1>This code can't be used</h1>
              <div className="error left">{error}</div>
              <p className="lead">On your computer, press “New code” and scan again — or sign in here instead.</p>
              <Link to="/login" className="btn lg block">Sign in</Link>
            </>
          ) : (
            <p className="lead">Opening your verification…</p>
          )}
        </div>
      </main>
    </div>
  );
}
