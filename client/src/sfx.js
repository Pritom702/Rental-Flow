// ============================================================
//  RentalFlow  |  Design system  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: interface sounds
// ============================================================
// Sounds synthesised on the fly with the Web Audio API — no audio files to
// download. Small instruments (kalimba, marimba, FM bell, a breath of air) in a
// little generated room, one voice per purpose:
//   tap      a kalimba "plink" on a pentatonic note  (buttons)
//   nav      a soft glass chime                       (links, tabs, cards)
//   toggle   a swish that lands on two marimba notes  (light / dark switch)
//   send     a water-drop "bloop"                     (chat message sent)
//   success  a level-up: arpeggio, sparkle, chord     (booking, listing, verification)
//   error    a gentle falling marimba pair            (something went wrong)
// Voices sit between ~500 Hz and 4 kHz and go through a compressor, so they
// are clear on small phone speakers (which cannot play low notes).
//
// Two ways to play them:
//   • Most devices: live through Web Audio (instant).
//   • iPhone / iPad: the silent switch mutes Web Audio, so each voice is
//     rendered once into a tiny WAV clip and played as an ordinary audio
//     element, which iOS lets through.
// Phones only allow sound to start from a finished tap (touchend / click), so
// the first tap "unlocks" audio and plays its own sound as soon as it can.
// Sounds are on by default and can be muted; the choice is remembered.
const KEY = 'rentalflow_sfx';
let muted = false;
try { muted = localStorage.getItem(KEY) === 'off'; } catch { /* private mode */ }

const IOS = typeof navigator !== 'undefined'
  && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

// ---------------------------------------------------------------- the instruments
// Each draws into `dest` on context `ac`, starting `start` seconds from now.

// An enveloped tone (the building block).
function tone(ac, dest, { type = 'sine', f, to = f, start = 0, attack = 0.004, dur = 0.2, gain = 0.2, glide = 0.02 }) {
  const t = ac.currentTime + start;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f, t);
  if (to !== f) osc.frequency.exponentialRampToValueAtTime(to, t + glide);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + attack);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(amp);
  amp.connect(dest);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

// Marimba: a warm body plus a bright, quickly-fading overtone and a soft knock.
function marimba(ac, dest, f, start = 0, gain = 0.22, dur = 0.45) {
  tone(ac, dest, { f, start, dur, gain });
  tone(ac, dest, { f: f * 3.99, start, dur: dur * 0.22, gain: gain * 0.35 });
  tone(ac, dest, { f: f * 10.1, start, dur: 0.03, gain: gain * 0.15 });
}

// Kalimba / pop: a note that "plinks" in from slightly sharp.
function kalimba(ac, dest, f, start = 0, gain = 0.22) {
  tone(ac, dest, { f: f * 1.18, to: f, glide: 0.018, start, dur: 0.28, gain });
  tone(ac, dest, { f: f * 2.01, start, dur: 0.12, gain: gain * 0.3 });
}

// Bell: FM synthesis — a glassy, shimmering chime.
function bell(ac, dest, f, start = 0, gain = 0.14, dur = 1.1) {
  const t = ac.currentTime + start;
  const car = ac.createOscillator();
  const mod = ac.createOscillator();
  const depth = ac.createGain();
  const amp = ac.createGain();
  car.frequency.value = f;
  mod.frequency.value = f * 3.5;
  depth.gain.setValueAtTime(f * 2.2, t);
  depth.gain.exponentialRampToValueAtTime(f * 0.05, t + dur * 0.6);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.004);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  mod.connect(depth);
  depth.connect(car.frequency);
  car.connect(amp);
  amp.connect(dest);
  car.start(t); mod.start(t);
  car.stop(t + dur + 0.05); mod.stop(t + dur + 0.05);
}

// A soft band-passed breath of air (the swish).
function air(ac, dest, { start = 0, dur = 0.3, from = 800, to = 4000, gain = 0.2 }) {
  const t = ac.currentTime + start;
  const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  const filter = ac.createBiquadFilter();
  const amp = ac.createGain();
  src.buffer = buf;
  filter.type = 'bandpass';
  filter.Q.value = 0.9;
  filter.frequency.setValueAtTime(from, t);
  filter.frequency.exponentialRampToValueAtTime(to, t + dur);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + dur * 0.45);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter);
  filter.connect(amp);
  amp.connect(dest);
  src.start(t);
}

// ---------------------------------------------------------------- the voices
// Notes come from a major pentatonic scale, so anything played together — or
// one tap after another — always sounds musical. Taps pick a different note
// each time, so tapping around the app plays a little tune instead of beeping.
const PENTA = [1046.5, 1174.7, 1318.5, 1568, 1760];            // C6 D6 E6 G6 A6
const VOICES = {
  //       [clip length s, draw(ac, dest, variant), variants]
  tap: [0.45, (ac, d, v) => kalimba(ac, d, PENTA[v], 0, 0.46), PENTA.length],
  nav: [0.7, (ac, d, v) => bell(ac, d, PENTA[v] * 2, 0, 0.24, 0.55), PENTA.length],
  toggle: [0.9, (ac, d) => {
    air(ac, d, { dur: 0.34, from: 700, to: 5200, gain: 0.26 });
    marimba(ac, d, 784, 0.1, 0.16);                          // G5 …
    marimba(ac, d, 1174.7, 0.19, 0.16);                      // … up to D6
  }, 1],
  send: [0.7, (ac, d) => {                                   // a water-drop "bloop"
    tone(ac, d, { f: 380, to: 1250, glide: 0.06, dur: 0.16, gain: 0.55 });
    tone(ac, d, { f: 1250, to: 1900, glide: 0.05, start: 0.05, dur: 0.14, gain: 0.16 });
    bell(ac, d, 2637, 0.08, 0.1, 0.5);
  }, 1],
  success: [1.8, (ac, d) => {                                // a "level up": arpeggio → sparkle → chord
    [1046.5, 1318.5, 1568, 2093].forEach((f, i) => marimba(ac, d, f, i * 0.065, 0.19, 0.5));
    bell(ac, d, 2093, 0.27, 0.12, 1.3);
    bell(ac, d, 2637, 0.32, 0.08, 1.2);
    bell(ac, d, 3136, 0.37, 0.06, 1.1);
    [523.25, 659.25, 784].forEach((f) => tone(ac, d, { type: 'triangle', f, start: 0.26, attack: 0.08, dur: 1.2, gain: 0.05 }));
  }, 1],
  error: [0.7, (ac, d) => {                                  // soft, never harsh
    marimba(ac, d, 659.25, 0, 0.13, 0.3);                    // E5
    marimba(ac, d, 523.25, 0.12, 0.13, 0.45);                // → C5
  }, 1],
};

// A small generated room: a burst of decaying noise used as a reverb.
function room(ac) {
  const len = Math.ceil(ac.sampleRate * 1.1);
  const ir = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c += 1) {
    const data = ir.getChannelData(c);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3.2;
  }
  const conv = ac.createConvolver();
  conv.buffer = ir;
  return conv;
}

// Everything goes through: a little room reverb, a compressor, then a boost.
function master(ac) {
  const input = ac.createGain();
  const wet = ac.createGain();
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -20; comp.knee.value = 12; comp.ratio.value = 4;
  comp.attack.value = 0.002; comp.release.value = 0.12;
  const boost = ac.createGain();
  boost.gain.value = 1.7;
  wet.gain.value = 0.22;
  const verb = room(ac);
  input.connect(comp);
  input.connect(verb);
  verb.connect(wet);
  wet.connect(comp);
  comp.connect(boost);
  boost.connect(ac.destination);
  return input;
}

// ---------------------------------------------------------------- Web Audio (most devices)
let ctx = null;
let out = null;
let pending = null;
function context() {
  if (ctx) return ctx;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    out = master(ctx);
  } catch { ctx = null; }
  return ctx;
}
// Which variant plays: taps and chimes step through the scale (never the same
// note twice in a row); other voices have just one.
let lastVariant = -1;
function variant(name) {
  const n = VOICES[name][2];
  if (n < 2) return 0;
  let v = Math.floor(Math.random() * n);
  if (v === lastVariant) v = (v + 1) % n;
  lastVariant = v;
  return v;
}
function voice(ac, name) { VOICES[name][1](ac, out, variant(name)); }
function flush() {
  if (pending && ctx?.state === 'running' && performance.now() - pending.at < 800) voice(ctx, pending.name);
  pending = null;
}

// ---------------------------------------------------------------- audio clips (iPhone / iPad)
const clips = {};                                // name -> [HTMLAudioElement, …] (a few, so taps can overlap)
function wav(buffer) {
  const pcm = buffer.getChannelData(0);
  const bytes = new DataView(new ArrayBuffer(44 + pcm.length * 2));
  const str = (o, s) => [...s].forEach((c, i) => bytes.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); bytes.setUint32(4, 36 + pcm.length * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); bytes.setUint32(16, 16, true); bytes.setUint16(20, 1, true); bytes.setUint16(22, 1, true);
  bytes.setUint32(24, buffer.sampleRate, true); bytes.setUint32(28, buffer.sampleRate * 2, true);
  bytes.setUint16(32, 2, true); bytes.setUint16(34, 16, true);
  str(36, 'data'); bytes.setUint32(40, pcm.length * 2, true);
  pcm.forEach((v, i) => bytes.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 0x7fff, true));
  return URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
}
async function renderClips() {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OAC) return;
  await Promise.all(Object.entries(VOICES).map(async ([name, [len, draw, variants]]) => {
    try {
      // one clip per note (or two copies of a single-variant voice, so it can overlap itself)
      const urls = await Promise.all(Array.from({ length: variants }, async (_, v) => {
        const ac = new OAC(1, Math.ceil(44100 * len), 44100);
        draw(ac, master(ac), v);
        return wav(await ac.startRendering());
      }));
      const list = variants > 1 ? urls : [urls[0], urls[0]];
      clips[name] = list.map((url) => { const a = new Audio(url); a.preload = 'auto'; return a; });
    } catch { /* this voice stays silent */ }
  }));
}
let clipTurn = 0;
function playClip(name) {
  const pool = clips[name];
  if (!pool) return;
  const a = VOICES[name][2] > 1 ? pool[variant(name)] : pool[(clipTurn += 1) % pool.length];
  try { a.currentTime = 0; } catch { /* not loaded yet */ }
  a.play().catch(() => {});
}
// iOS only lets an audio element play by itself after it has played once
// inside a tap — so the first tap quietly plays (and stops) every clip.
let clipsUnlocked = false;
function unlockClips() {
  if (clipsUnlocked || !Object.keys(clips).length) return;
  clipsUnlocked = true;
  Object.values(clips).flat().forEach((a) => {
    a.muted = true;
    a.play().then(() => { a.pause(); a.currentTime = 0; a.muted = false; }, () => { a.muted = false; clipsUnlocked = false; });
  });
}

// ---------------------------------------------------------------- playing
let last = 0;
export function play(name) {
  if (muted || !VOICES[name]) return;
  const now = performance.now();
  if (now - last < 40) return;                   // never stack sounds from one gesture
  last = now;
  if (IOS) {
    if (clipsUnlocked) playClip(name); else pending = { name, at: now };
    return;
  }
  const ac = context();
  if (!ac) return;
  if (ac.state === 'running') { voice(ac, name); return; }
  pending = { name, at: now };                   // audio not allowed yet: hold it for the unlock
  ac.resume().then(flush, () => {});
}

// Runs on every finished tap / click / key press — the moments browsers accept
// as "the person wants this page to make sound".
function unlock() {
  if (muted) return;
  if (IOS) {
    const first = !clipsUnlocked;
    unlockClips();
    if (first && pending && performance.now() - pending.at < 800) { const { name } = pending; setTimeout(() => playClip(name), 60); }
    pending = null;
    return;
  }
  const ac = context();
  if (!ac) return;
  if (ac.state === 'running') { flush(); return; }
  try {                                          // older browsers also need a node started inside the gesture
    const src = ac.createBufferSource();
    src.buffer = ac.createBuffer(1, 1, 22050);
    src.connect(ac.destination);
    src.start(0);
  } catch { /* ignore */ }
  ac.resume().then(flush, () => {});
}

export const isMuted = () => muted;
export function setMuted(value) {
  muted = value;
  try { localStorage.setItem(KEY, value ? 'off' : 'on'); } catch { /* private mode */ }
}

// Buttons and links make their own sound without every page wiring it up.
// Pages add the special ones (send, success, error) where they happen.
export function installClickSounds() {
  if (IOS) renderClips();
  document.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const el = e.target.closest('button, a, [role="link"], [role="button"], summary, input[type="checkbox"], input[type="radio"]');
    if (!el || el.disabled || el.dataset.sfx === 'none') return;
    play(el.dataset.sfx || (el.matches('button, [role="button"], summary, input') ? 'tap' : 'nav'));
  }, { capture: true, passive: true });
  ['pointerup', 'touchend', 'click', 'keydown'].forEach((type) => {
    document.addEventListener(type, unlock, { capture: true, passive: true });
  });
}
