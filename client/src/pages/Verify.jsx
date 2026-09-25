// ============================================================
//  RentalFlow  |  Identity verification  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: the new-member verification screens
// ============================================================
// Two separate moments use this page:
//   - right after sign-up: confirm the email (then straight into the platform);
//   - before the FIRST rental: the identity check (NID card + live selfie),
//     reached from the booking form with ?next=/browse?item=<id>, returning there.
// Built for a phone first: one column, one job per screen, big buttons at the
// bottom where a thumb reaches. The SERVER says which step the member is on
// (GET /api/verify/status); this page only draws it, so refreshing the page,
// switching phones or signing out and back in always resumes in the right place.
import { useCallback, useEffect, useState } from 'react';
import { celebrate } from '../fx.js';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Icon } from '../icons.jsx';
import IdPhotoInput from '../components/IdPhotoInput.jsx';
import LiveSelfie from '../components/LiveSelfie.jsx';
import ContinueOnPhone from '../components/ContinueOnPhone.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

const STEP_NUMBER = { nid: 1, selfie: 2 };   // the identity check; email is its own screen
const DEV_CODE_KEY = 'rentalflow_dev_code';

export default function Verify() {
  const { user, logout, setVerificationStatus, setEmailVerified } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Where to go afterwards — the booking the member was making, when that sent us here.
  const next = params.get('next') && params.get('next').startsWith('/') ? params.get('next') : null;
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const s = await api.get('/verify/status');
      setStatus(s);
      setVerificationStatus(s.status);
      setEmailVerified(s.emailVerified);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [setVerificationStatus, setEmailVerified]);

  // Email confirmed: straight into the platform, unless the member is on
  // their way to publishing a listing, in which case the ID check follows.
  const afterEmail = useCallback(() => {
    setEmailVerified(true);
    if (next) load();
    else navigate('/feed', { replace: true });
  }, [next, load, navigate, setEmailVerified]);

  useEffect(() => { load(); }, [load]);

  const step = status?.step;
  useEffect(() => {
    if (step === 'done') setVerificationStatus('verified');
  }, [step, setVerificationStatus]);

  return (
    <div className="verify">
      <header className="verify-top">
        <span className="wordmark">Rental<span>Flow</span></span>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <ThemeToggle />
          <button className="btn ghost small" onClick={() => { logout(); navigate('/login'); }}>Sign out</button>
        </span>
      </header>

      {STEP_NUMBER[step] && (
        <div className="verify-progress two" aria-label={`Step ${STEP_NUMBER[step]} of 2`}>
          {[1, 2].map((n) => <span key={n} className={n <= STEP_NUMBER[step] ? 'on' : ''} />)}
          <small>Identity check · step {STEP_NUMBER[step]} of 2</small>
        </div>
      )}

      <main className="verify-body">
        {!status && !error && <p className="muted center">Loading…</p>}
        {error && !status && <div className="error">{error}</div>}
        {step === 'email' && <EmailStep status={status} onDone={afterEmail} />}
        {(step === 'nid' || step === 'selfie') && <ContinueOnPhone onTick={load} />}
        {step === 'nid' && <NidStep onDone={load} name={user?.name} />}
        {step === 'selfie' && <SelfieStep challenge={status.challenge} onDone={load} />}
        {step === 'review' && <ReviewStep onRefresh={load} forListing={Boolean(next)} />}
        {step === 'rejected' && (
          <RejectedStep note={status.lastResult?.note} onRetry={() => setStatus({ ...status, step: 'nid' })} />
        )}
        {step === 'done' && <DoneStep next={next} onContinue={() => navigate(next || '/feed')} />}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------- step 1

function EmailStep({ status, onDone }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [wait, setWait] = useState(0);
  const [devCode, setDevCode] = useState(() => {
    try { return sessionStorage.getItem(DEV_CODE_KEY) || ''; } catch { return ''; }
  });

  useEffect(() => {
    if (!wait) return undefined;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function confirm(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/verify/email/confirm', { code });
      celebrate();
      try { sessionStorage.removeItem(DEV_CODE_KEY); } catch { /* ignore */ }
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError('');
    try {
      const r = await api.post('/verify/email/send', {});
      setWait(60);
      if (r.devCode) {
        setDevCode(r.devCode);
        try { sessionStorage.setItem(DEV_CODE_KEY, r.devCode); } catch { /* ignore */ }
      }
    } catch (err) {
      setError(err.message);
      const secs = Number(/(\d+) seconds/.exec(err.message)?.[1]);
      if (secs) setWait(secs);
    }
  }

  return (
    <form className="verify-step" onSubmit={confirm}>
      <div className="verify-icon"><Icon name="file" size={26} /></div>
      <h1>Check your email</h1>
      <p className="lead">We sent a 6-digit code to <b>{status.email}</b>.</p>

      {status.mailDevMode && (
        <div className="hint">
          <b>Test mode:</b> email sending is not set up yet
          {devCode ? <>, so here is your code: <b className="devcode">{devCode}</b></> : '. Tap “Send a new code” to see one here.'}
        </div>
      )}

      <input
        className="code-input"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        placeholder="••••••"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        aria-label="6-digit code"
        autoFocus
      />
      {error && <div className="error">{error}</div>}

      <div className="verify-actions">
        <button className="btn lg block" disabled={busy || code.length !== 6}>
          {busy ? 'Checking…' : 'Confirm email'}
        </button>
        <button type="button" className="btn ghost block" disabled={wait > 0} onClick={resend}>
          {wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- step 2

function NidStep({ onDone, name }) {
  const [form, setForm] = useState({ nid_number: '', nid_name: '', date_of_birth: '' });
  const [front, setFront] = useState(null);
  const [back, setBack] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [photoError, setPhotoError] = useState({});
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const ready = form.nid_number && form.nid_name && form.date_of_birth && front && back;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setPhotoError({});
    try {
      await api.post('/verify/nid', { ...form, front: front.dataUrl, back: back.dataUrl });
      onDone();
    } catch (err) {
      // Put a photo problem next to the photo it is about.
      const reason = err.reason || '';
      if (reason === 'blurry-front' || reason === 'no-card-face') setPhotoError({ front: err.message });
      else if (reason === 'blurry-back') setPhotoError({ back: err.message });
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="verify-step" onSubmit={submit}>
      <div className="verify-icon"><Icon name="shield" size={26} /></div>
      <h1>Verify your identity</h1>
      <p className="lead">Before your first rental we check that it's really you — it protects the people who lend you their things. Type your details exactly as printed on your NID card, then photograph both sides. It takes about 2 minutes, and it's saved on your account for good.</p>

      <div className="field">
        <label htmlFor="nid">NID number</label>
        <input id="nid" inputMode="numeric" autoComplete="off" placeholder="10, 13 or 17 digits"
          value={form.nid_number} onChange={set('nid_number')} required />
      </div>
      <div className="field">
        <label htmlFor="nidname">Name (in English, as on the card)</label>
        <input id="nidname" autoCapitalize="characters" placeholder={name ? name.toUpperCase() : 'MD RAHIM UDDIN'}
          value={form.nid_name} onChange={set('nid_name')} required />
      </div>
      <div className="field">
        <label htmlFor="dob">Date of birth</label>
        <input id="dob" type="date" value={form.date_of_birth} onChange={set('date_of_birth')} required
          max={new Date().toISOString().slice(0, 10)} />
      </div>

      <div className="tips">
        <b>For a clear photo</b>
        <span>Lay the card flat on a dark surface · good light, no flash glare · all four corners in the picture</span>
      </div>

      <IdPhotoInput label="Front of the card" hint="The side with your photo"
        value={front} onChange={(p) => { setFront(p); setPhotoError({}); }} serverError={photoError.front} />
      <IdPhotoInput label="Back of the card" hint="The side with your address"
        value={back} onChange={(p) => { setBack(p); setPhotoError({}); }} serverError={photoError.back} />

      {error && <div className="error">{error}</div>}

      <div className="verify-actions sticky">
        <button className="btn lg block" disabled={!ready || busy}>
          {busy ? 'Reading your card…' : 'Continue'}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- step 3

function SelfieStep({ challenge: initial, onDone }) {
  const [challenge, setChallenge] = useState(initial || ['left', 'up']);
  const [mode, setMode] = useState('intro');   // intro | camera | sending
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');

  async function send(frames) {
    setMode('sending');
    setError('');
    try {
      await api.post('/verify/selfie', { frames });
      onDone();
    } catch (err) {
      if (err.data?.challenge) setChallenge(err.data.challenge);
      setError(err.data?.triesLeft != null
        ? `${err.message} ${err.data.triesLeft} ${err.data.triesLeft === 1 ? 'try' : 'tries'} left.`
        : err.message);
      setMode('intro');
      if (err.status === 409) onDone();   // the attempt expired: back to the NID step
    }
  }

  if (mode === 'camera') {
    return (
      <div className="verify-step">
        <LiveSelfie key={attempt} challenge={challenge} onDone={send}
          onCancel={() => { setMode('intro'); setAttempt(attempt + 1); }} />
      </div>
    );
  }

  return (
    <div className="verify-step">
      <div className="verify-icon"><Icon name="user" size={26} /></div>
      <h1>Quick face check</h1>
      <p className="lead">We match your face with the photo on your NID. You will be asked to look at the camera, then do two simple head movements.</p>
      <ul className="checklist">
        <li><Icon name="check" size={16} /> Face a window or a bright light</li>
        <li><Icon name="check" size={16} /> Take off sunglasses, caps and masks</li>
        <li><Icon name="check" size={16} /> Hold the phone at eye level</li>
      </ul>
      {error && <div className="error">{error}</div>}
      <div className="verify-actions sticky">
        <button className="btn lg block" disabled={mode === 'sending'}
          onClick={() => { setAttempt(attempt + 1); setMode('camera'); }}>
          {mode === 'sending' ? 'Matching your face…' : error ? 'Try again' : 'Start face check'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- outcomes

function ReviewStep({ onRefresh, forListing }) {
  useEffect(() => {
    const t = setInterval(onRefresh, 30000);
    return () => clearInterval(t);
  }, [onRefresh]);
  return (
    <div className="verify-step center">
      <div className="verify-icon big wait"><Icon name="refresh" size={34} /></div>
      <h1>We're checking your ID</h1>
      <p className="lead">Our team is reviewing your NID by hand. This usually takes a few hours. We'll email you and notify you here as soon as it's done.</p>
      <p className="lead">Meanwhile you can keep browsing, listing and chatting as usual — you can book as soon as you're approved.</p>
      <div className="verify-actions">
        <button className="btn secondary lg block" onClick={onRefresh}>Check again</button>
      </div>
    </div>
  );
}

function RejectedStep({ note, onRetry }) {
  return (
    <div className="verify-step center">
      <div className="verify-icon big bad"><Icon name="close" size={34} /></div>
      <h1>We couldn't verify your ID</h1>
      {note && <div className="error left">{note}</div>}
      <p className="lead">You can try again with clear photos of your own NID card.</p>
      <div className="verify-actions">
        <button className="btn lg block" onClick={onRetry}>Try again</button>
      </div>
    </div>
  );
}

function DoneStep({ next, onContinue }) {
  useEffect(() => { celebrate(); }, []);
  return (
    <div className="verify-step center">
      <div className="verify-icon big ok"><Icon name="check" size={34} /></div>
      <h1>You're verified</h1>
      <p className="lead">Thanks! Your identity is confirmed and saved on your account — you won't be asked again.</p>
      <div className="verify-actions">
        <button className="btn lg block" onClick={onContinue}>{next ? 'Continue' : 'Go to your feed'}</button>
      </div>
    </div>
  );
}
