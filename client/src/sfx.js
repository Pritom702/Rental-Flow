// ============================================================
//  RentalFlow  |  Design system  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: interface sounds
// ============================================================
// Sounds synthesised on the fly with the Web Audio API — no audio files to
// download.
//
// Soft by design. The first version was found irritating: high glassy notes
// (1–3.5 kHz), boosted loud, with a reverb tail on every click. Now:
//   tap      a tiny water-drop "pop", ~60 ms       (every button)
//   nav      two quick rising drops, ~90 ms        (links, tabs, cards)
// Both sit in the mid range (about 500–900 Hz), far quieter than the moments
// below, and each tap takes the next note of a pentatonic scale, so moving
// around the app plays a soft little melody instead of one repeated beep.
// The bigger sounds mark moments that matter, and are short and warm too:
//   send     a soft water-drop                   (chat message, comment, post)
//   pop      a bright double drop                (a reaction, a like)
//   toggle   a hushed two-note step              (light / dark switch)
//   notify   two gentle notes                    (something new arrived)
//   success  a short warm rising pair            (booking, listing, verification)
//   levelup  a brief, still-soft arpeggio        (community level up, streak milestone)
//   error    one low, soft note                  (an action failed)
// On Android phones a matching tiny vibration goes with pop / success / levelup.
// Nothing plays while the tab is in the background. Sound and haptics are on
// by default and share one switch in the top bar; the choice is remembered.
//
// Two ways to play them:
//   • Most devices: live through Web Audio (instant).
//   • iPhone / iPad: the silent switch mutes Web Audio, so each voice is
//     rendered once into a tiny WAV clip and played as an ordinary audio
//     element, which iOS lets through.
// Phones only allow sound to start from a finished tap (touchend / click), so
// the first tap "unlocks" audio and plays its own sound as soon as it can.
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

// Marimba: a warm body plus a faint, quickly-fading overtone (no bright
// "knock" on top — that high click was the harshest part of the old sounds).
function marimba(ac, dest, f, start = 0, gain = 0.22, dur = 0.45) {
  tone(ac, dest, { f, start, dur, gain });
  tone(ac, dest, { f: f * 3.99, start, dur: dur * 0.15, gain: gain * 0.18 });
}

// ---------------------------------------------------------------- the voices
// Low-register sine and triangle tones (roughly 400–1300 Hz), no glassy bells,
// nothing longer than half a second except the rare level-up.

// A water drop: a pure tone that swoops up into its note and is gone. The
// upward swoop is what makes it feel like a "yes" rather than a beep.
function drop(ac, dest, f, start = 0, gain = 0.08) {
  tone(ac, dest, { f: f * 0.62, to: f, glide: 0.022, start, attack: 0.003, dur: 0.06, gain });
}

const SCALE = [523.25, 587.33, 659.25, 783.99, 880];         // C5 D5 E5 G5 A5 (pentatonic)
const VOICES = {
  //       [clip length s, draw(ac, dest, variant), variants]
  tap: [0.15, (ac, d, v) => drop(ac, d, SCALE[v], 0, 0.1), SCALE.length],
  nav: [0.2, (ac, d, v) => {
    drop(ac, d, SCALE[v], 0, 0.07);
    drop(ac, d, SCALE[v] * 1.5, 0.045, 0.05);                // a fifth above
  }, SCALE.length],
  send: [0.4, (ac, d) => {
    tone(ac, d, { f: 420, to: 820, glide: 0.07, dur: 0.14, gain: 0.22 });
  }],
  pop: [0.3, (ac, d) => {                                   // a brighter double drop
    drop(ac, d, 783.99, 0, 0.16);                           // G5
    drop(ac, d, 1174.66, 0.05, 0.09);                       // → D6
  }],
  toggle: [0.4, (ac, d) => {
    tone(ac, d, { f: 523.25, dur: 0.12, gain: 0.12 });
    tone(ac, d, { f: 659.25, start: 0.07, dur: 0.16, gain: 0.12 });
  }],
  notify: [0.5, (ac, d) => {
    marimba(ac, d, 659.25, 0, 0.1, 0.25);                   // E5
    marimba(ac, d, 880, 0.1, 0.09, 0.3);                    // → A5
  }],
  success: [0.6, (ac, d) => {
    marimba(ac, d, 523.25, 0, 0.12, 0.3);                   // C5
    marimba(ac, d, 784, 0.08, 0.12, 0.4);                   // → G5
  }],
  levelup: [0.9, (ac, d) => {
    [523.25, 659.25, 784, 1046.5].forEach((f, i) => marimba(ac, d, f, i * 0.07, 0.11, 0.35));
    tone(ac, d, { type: 'triangle', f: 1046.5, start: 0.28, attack: 0.03, dur: 0.5, gain: 0.04 });
  }],
  error: [0.4, (ac, d) => {
    tone(ac, d, { type: 'triangle', f: 330, to: 290, glide: 0.12, dur: 0.22, gain: 0.14 });
  }],
};
const HAPTICS = { pop: 8, success: [10, 40, 14], levelup: [12, 50, 12, 50, 20] };

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
  boost.gain.value = 0.9;
  wet.gain.value = 0.08;
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
// Taps and links step through the scale, never the same note twice in a row.
let lastVariant = -1;
function variant(name) {
  const n = VOICES[name][2] || 1;
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
  await Promise.all(Object.entries(VOICES).map(async ([name, [len, draw, variants = 1]]) => {
    try {
      // one clip per note (or two copies of a single-note voice, so it can overlap itself)
      const urls = await Promise.all(Array.from({ length: variants }, async (_, v) => {
        const ac = new OAC(1, Math.ceil(44100 * len), 44100);
        draw(ac, master(ac), v);
        return wav(await ac.startRendering());
      }));
      const list = variants > 1 ? urls : [urls[0], urls[0]];
      clips[name] = list.map((u) => { const a = new Audio(u); a.preload = 'auto'; return a; });
    } catch { /* this voice stays silent */ }
  }));
}
let clipTurn = 0;
function playClip(name) {
  const pool = clips[name];
  if (!pool) return;
  const a = (VOICES[name][2] || 1) > 1 ? pool[variant(name)] : pool[(clipTurn += 1) % pool.length];
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
  if (typeof document !== 'undefined' && document.hidden) return;   // never from a background tab
  const now = performance.now();
  if (now - last < 60) return;                   // never stack sounds from one gesture
  last = now;
  if (HAPTICS[name]) { try { navigator.vibrate?.(HAPTICS[name]); } catch { /* not supported */ } }
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

// Buttons and links make their own soft sound without every page wiring it
// up; an element can pick another voice with data-sfx="<voice>" or opt out
// with data-sfx="none". Pages play the special moments (send, pop, success,
// error) where they happen.
export function installClickSounds() {
  if (IOS) renderClips();
  document.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const el = e.target.closest('button, a, [role="link"], [role="button"], summary, input[type="checkbox"], input[type="radio"], [data-sfx]');
    if (!el || el.disabled || el.dataset.sfx === 'none') return;
    play(el.dataset.sfx || (el.matches('button, [role="button"], summary, input') ? 'tap' : 'nav'));
  }, { capture: true, passive: true });
  ['pointerup', 'touchend', 'click', 'keydown'].forEach((type) => {
    document.addEventListener(type, unlock, { capture: true, passive: true });
  });
}
