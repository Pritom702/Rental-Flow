// ============================================================
//  RentalFlow  |  Community  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: video in the feed and in Flow
// ============================================================
// Light by design:
//   • nothing downloads until the video is on screen (preload="none" + the
//     cover frame captured at upload is shown instead)
//   • it plays muted once 60% of it is visible and pauses when it leaves,
//     and only ONE video plays at a time across the whole page
//   • tap to unmute; the choice is remembered for the next video
//   • double-tap loves the post (onLove)
import { useEffect, useRef, useState } from 'react';
import { duration as fmt } from './media.js';

const KEY = 'rentalflow_video_sound';
let soundOn = false;
try { soundOn = localStorage.getItem(KEY) === 'on'; } catch { /* private mode */ }

let playing = null;   // the one <video> currently playing
function claim(video) {
  if (playing && playing !== video) playing.pause();
  playing = video;
}

// One shared observer for every video on the page.
const watchers = new Map();
let observer = null;
function observe(el, cb) {
  if (!observer) {
    observer = new IntersectionObserver((entries) => {
      entries.forEach((e) => watchers.get(e.target)?.(e.intersectionRatio >= 0.6));
    }, { threshold: [0, 0.6, 1] });
  }
  watchers.set(el, cb);
  observer.observe(el);
  return () => { watchers.delete(el); observer.unobserve(el); };
}

export default function FeedVideo({ video, onLove, reel = false, active }) {
  const ref = useRef(null);
  const wrap = useRef(null);
  const [muted, setMuted] = useState(!soundOn);
  const [paused, setPaused] = useState(true);
  const [progress, setProgress] = useState(0);
  const [started, setStarted] = useState(false);
  const lastTap = useRef(0);
  const tapTimer = useRef(null);

  function tryPlay() {
    const v = ref.current;
    if (!v) return;
    claim(v);
    v.muted = !soundOn;
    setMuted(!soundOn);
    v.play().then(() => setStarted(true)).catch(() => {
      // The browser refused sound without a tap: fall back to muted.
      v.muted = true; setMuted(true);
      v.play().then(() => setStarted(true)).catch(() => {});
    });
  }

  // Feed: play while visible. Flow: the parent says which one is active.
  useEffect(() => {
    if (reel) return undefined;
    return observe(wrap.current, (visible) => {
      if (visible) tryPlay(); else ref.current?.pause();
    });
  }, [reel]);
  useEffect(() => {
    if (!reel) return;
    if (active) tryPlay(); else { ref.current?.pause(); if (ref.current) ref.current.currentTime = 0; }
  }, [reel, active]);
  useEffect(() => () => { if (playing === ref.current) playing = null; }, []);

  function toggleSound(e) {
    e.stopPropagation();
    soundOn = !soundOn;
    try { localStorage.setItem(KEY, soundOn ? 'on' : 'off'); } catch { /* ignore */ }
    if (ref.current) { ref.current.muted = !soundOn; if (soundOn) tryPlay(); }
    setMuted(!soundOn);
  }
  function onTap(e) {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      clearTimeout(tapTimer.current);
      lastTap.current = 0;
      onLove?.(e);
      return;
    }
    lastTap.current = now;
    tapTimer.current = setTimeout(() => {
      const v = ref.current;
      if (!v) return;
      if (v.paused) tryPlay(); else v.pause();
    }, 280);
  }

  const ratio = video.w && video.h ? video.w / video.h : 16 / 9;
  return (
    <div
      ref={wrap}
      className={`fv${reel ? ' fv-reel' : ''}${started ? ' started' : ''}`}
      style={reel ? undefined : { aspectRatio: Math.max(0.56, Math.min(1.9, ratio)), background: video.color || '#0c1511' }}
      onClick={onTap}
      role="button"
      tabIndex={0}
      aria-label="Video — tap to play or pause, double-tap to love"
      data-sfx="none"
    >
      <video
        ref={ref}
        src={video.url}
        poster={video.poster}
        preload="none"
        playsInline
        loop
        muted={muted}
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime / (e.currentTarget.duration || 1))}
      />
      {paused && started && <span className="fv-play" aria-hidden="true">▶</span>}
      {!started && <span className="fv-play idle" aria-hidden="true">▶</span>}
      {video.duration ? <span className="fv-time">{fmt(video.duration)}</span> : null}
      <button type="button" className="fv-sound" onClick={toggleSound} aria-label={muted ? 'Turn sound on' : 'Mute'} data-sfx="none">
        {muted ? '🔇' : '🔊'}
      </button>
      <i className="fv-bar" style={{ transform: `scaleX(${progress})` }} />
    </div>
  );
}
