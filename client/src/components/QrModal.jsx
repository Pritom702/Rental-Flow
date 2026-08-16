// ============================================================
//  RentalFlow  |  Sprint 3  |  Part: Item QR code modal (F4)
// ============================================================
// Shows a printable QR code for an item. The QR encodes the app's own
// /scan/<token> URL (built from the current origin), so a phone's native
// camera opens the scan page directly. No in-app scanner needed.
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../api.js';
import { Icon } from '../icons.jsx';

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16,
};

export default function QrModal({ item, onClose }) {
  const [dataUrl, setDataUrl] = useState('');
  const [scanUrl, setScanUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { qr_token } = await api.get(`/items/${item.id}/qr`);
        const url = `${window.location.origin}/scan/${qr_token}`;
        const png = await QRCode.toDataURL(url, { width: 260, margin: 2 });
        if (!alive) return;
        setScanUrl(url);
        setDataUrl(png);
      } catch (err) {
        if (alive) setError(err.message);
      }
    })();
    return () => { alive = false; };
  }, [item.id]);

  return (
    <div style={overlay} onClick={onClose}>
      <div className="card" style={{ maxWidth: 340, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
        <h3>QR — {item.name}</h3>
        <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          Scan with a phone camera to check this item out or in.
        </div>
        {error && <div className="error"><Icon name="shield" size={16} /> {error}</div>}
        {dataUrl
          ? <img src={dataUrl} alt="Item QR code" style={{ width: 260, height: 260, maxWidth: '100%' }} />
          : <div className="center-empty">Generating…</div>}
        {scanUrl && <div className="muted" style={{ fontSize: 11, wordBreak: 'break-all', marginTop: 8 }}>{scanUrl}</div>}
        <div className="card-actions" style={{ justifyContent: 'center', marginTop: 16 }}>
          <button className="btn secondary small" onClick={() => window.print()}>Print</button>
          <button className="btn small" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
