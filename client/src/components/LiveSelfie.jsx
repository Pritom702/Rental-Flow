// ============================================================
//  RentalFlow  |  Identity verification  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: live selfie with blink / head-turn liveness
// ============================================================
// Opens the front camera and walks the member through:
//   1. look straight at the camera   (the photo compared with the NID)
//   2. the two head movements the SERVER picked, e.g. "turn left" then "tilt up"
// Each frame is captured automatically the moment the action is seen, so there
// is no shutter button to fumble. The frames go to the server, which re-checks
// every one of them with its own, larger face model before trusting them.
import { useEffect, useRef, useState } from 'react';
import {
  ACTION_TEXT, noseOffset, nosePitch, TURNED, FACING, TILT_UP,
} from '@shared/livenessUtils.js';
import { MIN_SHARPNESS } from '@shared/pixelUtils.js';
import { loadFaceApi } from '../verify/faceModels.js';
import { drawScaled, canvasSharpness } from '../verify/photo.js';

// The phone is a little stricter than the server, so a frame the phone accepts
// is not then rejected by the server's slightly different face model.
const MARGIN = 0.03;
const FRAME_SIDE = 640;
const TICK_MS = 110;
const STEP_TIMEOUT_MS = 20000;

// `base` = landmarks of the straight-on frame, the reference for "up".
function shows(action, lm, base) {
  const off = noseOffset(lm) - 0.5;
  if (action === 'forward') return Math.abs(off) <= FACING - 0.04;
  if (action === 'left') return off >= TURNED + MARGIN;
  if (action === 'right') return off <= -(TURNED + MARGIN);
  if (action === 'up') return Boolean(base) && nosePitch(base) - nosePitch(lm) >= TILT_UP + 0.01 && Math.abs(off) < TURNED;
  return false;
}

export default function LiveSelfie({ challenge, onDone, onCancel }) {
  const videoRef = useRef(null);
  const [phase, setPhase] = useState('loading');   // loading | running | error | timeout
  const [stepIndex, setStepIndex] = useState(0);
  const [tip, setTip] = useState('');
  const [error, setError] = useState('');
  const steps = ['forward', ...challenge];

  useEffect(() => {
    let stream = null;
    let timer = null;
    let cancelled = false;
    const frames = {};
    let base = null;       // landmarks of the straight-on frame
    let index = 0;
    let stepStarted = Date.now();

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error(), { name: 'NoCamera' });
        const [faceapi, media] = await Promise.all([
          loadFaceApi(),
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } },
            audio: false,
          }),
        ]);
        stream = media;
        if (cancelled) return;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        setPhase('running');
        stepStarted = Date.now();
        loop(faceapi);
      } catch (err) {
        if (cancelled) return;
        setPhase('error');
        setError(err.name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow camera access for this site in your browser settings, then try again.'
          : err.name === 'NoCamera'
            ? 'This browser cannot open the camera. Open RentalFlow in Chrome or Safari on your phone.'
            : 'The camera could not be started. Close other apps using the camera and try again.');
      }
    }

    // Freeze the current video frame (un-mirrored, exactly what the camera
    // sees). The SAME frozen frame is analysed and, if it passes, sent — so
    // the photo the server checks is always the one that passed here, even if
    // the member has already moved on by the time the analysis finishes.
    function freeze() {
      const v = videoRef.current;
      return drawScaled(v, FRAME_SIDE, v.videoWidth, v.videoHeight);
    }

    async function loop(faceapi) {
      if (cancelled) return;
      if (Date.now() - stepStarted > STEP_TIMEOUT_MS) {
        // Could not see this movement. Without the straight-on photo there is
        // nothing to send; otherwise send what we have — the server treats the
        // missing movement as not done and hands out a different one.
        if (!frames.forward) { setPhase('timeout'); return; }
        cancelled = true;
        stream?.getTracks().forEach((t) => t.stop());
        onDone(frames);
        return;
      }
      try {
        const frame = freeze();
        const result = await faceapi
          .detectSingleFace(frame, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
          .withFaceLandmarks();
        const action = steps[index];
        if (!result) {
          setTip('Put your face inside the oval');
        } else if (result.detection.box.width < frame.width * 0.22) {
          setTip('Move the phone a little closer');
        } else {
          const lm = result.landmarks.positions.map((p) => ({ x: p.x, y: p.y }));
          if (shows(action, lm, base)) {
            // The straight-on photo is the one compared with the NID: it must be sharp.
            if (action === 'forward' && canvasSharpness(frame) < MIN_SHARPNESS) {
              setTip('Hold still — the picture is blurry');
            } else {
              frames[action] = frame.toDataURL('image/jpeg', 0.9);
              if (action === 'forward') base = lm;
              if (navigator.vibrate) navigator.vibrate(40);
              index += 1;
              stepStarted = Date.now();
              setStepIndex(index);
              setTip('');
              if (index >= steps.length) {
                cancelled = true;
                stream?.getTracks().forEach((t) => t.stop());
                onDone(frames);
                return;
              }
            }
          } else {
            setTip('');
          }
        }
      } catch { /* a dropped frame — try the next one */ }
      timer = setTimeout(() => loop(faceapi), TICK_MS);
    }

    start();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // challenge identity changes restart the whole capture
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge.join(',')]);

  if (phase === 'error' || phase === 'timeout') {
    return (
      <div className="selfie-msg">
        <div className="error">{phase === 'timeout'
          ? 'We could not see your face clearly. Face a window or a bright light and try again.'
          : error}</div>
        <button className="btn lg block" onClick={onCancel}>Try again</button>
      </div>
    );
  }

  const action = steps[Math.min(stepIndex, steps.length - 1)];
  return (
    <div className="selfie">
      <div className="selfie-stage">
        <video ref={videoRef} playsInline muted className="selfie-video" />
        <div className="selfie-oval" />
        {phase === 'loading' && <div className="selfie-loading">Starting camera…</div>}
      </div>
      <div className="selfie-steps" aria-hidden>
        {steps.map((s, i) => <span key={s} className={i < stepIndex ? 'done' : i === stepIndex ? 'now' : ''} />)}
      </div>
      <div className="selfie-instruction" aria-live="polite">{ACTION_TEXT[action]}</div>
      <div className="selfie-tip">{tip || ' '}</div>
      <button className="btn ghost block" onClick={onCancel}>Cancel</button>
    </div>
  );
}
