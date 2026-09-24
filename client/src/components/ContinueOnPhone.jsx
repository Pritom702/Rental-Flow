// ============================================================
//  RentalFlow  |  Identity verification  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: "continue on your phone" QR card (computers only)
// ============================================================
// On a computer, the NID photos and the live selfie are much easier with a
// phone. This card shows a QR code that opens the same verification on the
// phone, already signed in. Meanwhile this page keeps checking the server, so
// the computer moves on by itself once the phone has finished a step.
//
// Phones never see the card: they are already the right device.
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../api.js';
import { Icon } from '../icons.jsx';

const POLL_MS = 5000;

function isPhone() {
  try {
    return window.matchMedia('(pointer: coarse)').matches && Math.min(window.screen.width, window.screen.height) < 820;
  } catch {
    return false;
  }
}

export default function ContinueOnPhone({ onTick }) {
  const [phone] = useState(isPhone);
  const [qr, setQr] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function makeCode() {
    setBusy(true);
    setError('');
    try {
      const { path } = await api.post('/verify/handoff', {});
      setQr(await QRCode.toDataURL(window.location.origin + path, { width: 220, margin: 1 }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (phone) return undefined;
    makeCode();
    // Follow the phone's progress: re-read the step every few seconds.
    const t = setInterval(onTick, POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  if (phone) return null;

  const local = /^(localhost|127\.)/.test(window.location.hostname);
  return (
    <section className="handoff">
      <div className="handoff-text">
        <b><Icon name="camera" size={16} /> Easier on your phone</b>
        <p>Scan this code with your phone's camera to take the NID photos and the selfie there. This page will move on by itself when you finish.</p>
        <p className="muted">Works once, for 15 minutes. You can also carry on here with this computer.</p>
        {local && <p className="muted">You opened this page as <code>localhost</code>, which a phone cannot reach — open it using this computer's network address instead.</p>}
        <button type="button" className="btn ghost small" disabled={busy} onClick={makeCode}>
          <Icon name="refresh" size={14} /> New code
        </button>
        {error && <div className="error">{error}</div>}
      </div>
      {qr ? <img className="handoff-qr" src={qr} alt="QR code to continue on your phone" /> : <div className="handoff-qr" />}
    </section>
  );
}
