// ============================================================
//  RentalFlow  |  Identity verification  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: taking a photo of the NID card
// ============================================================
// Two big buttons: "Take photo" opens the phone's rear camera directly (the
// native camera app focuses far better than anything a web page can do), and
// "Choose from gallery" for a photo taken earlier. The picture is checked for
// blur the moment it is taken. A blurry one gets a warning and a nudge to
// retake it, but is never a dead end: the member can continue, and an admin
// checks that card by hand.
import { useRef, useState } from 'react';
import { Icon } from '../icons.jsx';
import { prepareCardPhoto } from '../verify/photo.js';

export default function IdPhotoInput({ label, hint, value, onChange, serverError }) {
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';           // allow picking the same file again after a retake
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const photo = await prepareCardPhoto(file);
      onChange(photo);
    } catch {
      setError('That file could not be opened as a photo. Take the picture again.');
      onChange(null);
    } finally {
      setBusy(false);
    }
  }

  const blurry = value && !value.sharp;
  const problem = error || serverError;

  return (
    <div className={`idphoto${problem ? ' bad' : blurry ? ' warn' : value ? ' good' : ''}`}>
      <div className="idphoto-head">
        <b>{label}</b>
        {value && !problem && !blurry && <span className="idphoto-ok"><Icon name="check" size={14} /> Clear</span>}
      </div>

      {value ? (
        <img className="idphoto-preview" src={value.dataUrl} alt={label} />
      ) : (
        <div className="idphoto-empty">
          <Icon name="camera" size={28} />
          <span>{hint}</span>
        </div>
      )}

      {problem && <div className="idphoto-problem">{problem}</div>}
      {!problem && blurry && (
        <div className="idphoto-warn">
          This photo looks a little blurry. Retake it to be verified faster, or continue and an admin will check it by hand.
        </div>
      )}

      <div className="idphoto-actions">
        <button type="button" className="btn" disabled={busy} onClick={() => cameraRef.current.click()}>
          <Icon name="camera" size={16} /> {busy ? 'Checking…' : value ? 'Retake' : 'Take photo'}
        </button>
        <button type="button" className="btn secondary" disabled={busy} onClick={() => galleryRef.current.click()}>
          Gallery
        </button>
      </div>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={pick} />
    </div>
  );
}
