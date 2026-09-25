// ============================================================
//  RentalFlow  |  Trust  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: "verify before you list or sell"
// ============================================================
// Owners and sellers verify their identity once (NID + live selfie) before
// their first listing or sale; renters never have to. useSellerGate() asks the
// server where the member stands; <SellerGate> explains it and sends them to
// the check, bringing them straight back afterwards.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Glyph } from './glyphs.jsx';

// → 'checking' | 'ok' | 'needed' | 'pending'
export function useSellerGate() {
  const { user } = useAuth();
  const [state, setState] = useState(user && user.role === 'member' ? 'checking' : 'ok');
  useEffect(() => {
    if (!user || user.role !== 'member') { setState('ok'); return; }
    api.get('/verify/status')
      .then((s) => setState(s.step === 'done' ? 'ok' : s.status === 'pending_review' ? 'pending' : 'needed'))
      .catch(() => setState('ok'));   // the server still enforces it
  }, [user]);
  return [state, setState];
}

export default function SellerGate({ state, returnTo, what = 'list or sell' }) {
  if (state === 'ok' || state === 'checking') return null;
  return (
    <div className="seller-gate">
      <span className="sg-badge"><Glyph name="shield" size={30} /></span>
      <div className="sg-text">
        {state === 'pending' ? (
          <>
            <b>Your ID is being checked</b>
            <span>Our team is reviewing it. You can {what} as soon as it is approved — we'll notify you.</span>
          </>
        ) : (
          <>
            <b>Verify once to {what}</b>
            <span>
              Owners and sellers confirm who they are with their National ID and a quick selfie, so
              renters and buyers can trust them. It takes about 2 minutes and you only do it once.
              Renting never needs it.
            </span>
          </>
        )}
      </div>
      {state === 'needed' && (
        <Link to={`/verify?next=${encodeURIComponent(returnTo)}`} className="btn accent">
          <Glyph name="shield" size={16} /> Verify my identity
        </Link>
      )}
    </div>
  );
}
