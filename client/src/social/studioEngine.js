// ============================================================
//  RentalFlow  |  Studio  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: the video engine — runs in the browser, free
// ============================================================
// Turns 1–4 listings into a 720 × 1280 video, entirely on the member's device:
//   • a canvas draws every frame (hook → one scene per listing → closing card)
//   • WebAudio synthesises a soft beat, so there is no music licence to worry about
//   • MediaRecorder captures canvas + beat into a real video file (MP4 where the
//     browser can, WebM otherwise)
// No server work, no paid API — the file then goes through the normal video
// upload (frames checked for adult content, sent straight to storage).
//
// Smoothness: where the browser has WebCodecs (Chrome, Edge, Android, recent
// Safari) every frame is drawn at its exact moment and encoded straight into an
// MP4 — frame-perfect, and faster than real time. Recording the screen in real
// time (MediaRecorder) is only the fallback, because a busy device drops frames
// and the video stutters.
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

export const W = 720;
export const H = 1280;
export const FPS = 30;
const HOOK = 1.6;            // seconds
const SCENE = 3.0;
const OUTRO = 2.2;
const SLIDE = 0.45;          // transition between scenes

export const STYLES = {
  neon:   { label: 'Neon night', bg: ['#07100B', '#122019'], ink: '#EDF2E6', accent: '#C6F24E', card: '#0F1A14', glow: true },
  paper:  { label: 'Paper',      bg: ['#F5F1E8', '#EAE3D2'], ink: '#10291D', accent: '#4F8A0B', card: '#FFFFFF', glow: false },
  pop:    { label: 'Lime pop',   bg: ['#D9FA73', '#9ACD2B'], ink: '#0B140F', accent: '#0B140F', card: '#FFFFFF', glow: false, stripes: true },
  sunset: { label: 'Sunset',     bg: ['#FF9466', '#FFD84A'], ink: '#1A0C00', accent: '#1A0C00', card: '#FFFFFF', glow: false },
};

export function durationFor(n) { return HOOK + n * SCENE + OUTRO; }

const ease = (t) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;
const taka = (n) => `৳${Math.round(n).toLocaleString('en-IN')}`;

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function wrap(g, text, maxW) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}
function containRect(img, bw, bh) {
  const s = Math.min(bw / img.width, bh / img.height);
  return { w: img.width * s, h: img.height * s };
}

function background(g, st, t, photo) {
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, st.bg[0]); grad.addColorStop(1, st.bg[1]);
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  if (photo && st.glow) {   // the photo, huge and blurred, as a mood light
    g.save(); g.globalAlpha = 0.28; g.filter = 'blur(40px)';
    const s = Math.max(W / photo.width, H / photo.height) * 1.2;
    g.drawImage(photo, (W - photo.width * s) / 2, (H - photo.height * s) / 2, photo.width * s, photo.height * s);
    g.restore();
  }
  if (st.glow) {
    const r = g.createRadialGradient(W / 2, H * 0.38, 10, W / 2, H * 0.38, 620);
    r.addColorStop(0, 'rgba(198,242,78,.22)'); r.addColorStop(1, 'rgba(198,242,78,0)');
    g.fillStyle = r; g.fillRect(0, 0, W, H);
  }
  if (st.stripes) {
    g.save(); g.globalAlpha = 0.12; g.fillStyle = '#0B140F';
    const off = (t * 40) % 80;
    g.translate(W / 2, H / 2); g.rotate(-0.5);
    for (let x = -1400 + off; x < 1400; x += 80) g.fillRect(x, -1400, 26, 2800);
    g.restore();
  }
}

// RentalFlow's mark — the same logo file as the website (a box whose lid
// unfolds into a wave) — and the "Rental" + italic "Flow" wordmark.
let logoImg = null;
if (typeof Image !== 'undefined') {
  logoImg = new Image();
  logoImg.src = '/brand/logo-tile.svg';
}
function logoMark(g, x, y, s) {
  if (logoImg?.complete && logoImg.naturalWidth) { g.drawImage(logoImg, x, y, s, s); return; }
  g.save();
  const grad = g.createLinearGradient(x, y, x + s, y + s);
  grad.addColorStop(0, '#E4FF8A'); grad.addColorStop(0.5, '#C6F24E'); grad.addColorStop(1, '#8FD12A');
  roundRect(g, x, y, s, s, s * 0.28); g.fillStyle = grad; g.fill();
  const k = (s * 0.62) / 24; const ox = x + s * 0.19; const oy = y + s * 0.19;
  g.strokeStyle = '#0B140F'; g.lineWidth = Math.max(1.5, s * 0.06); g.lineJoin = 'round'; g.lineCap = 'round';
  g.beginPath();
  const P = (px, py) => [ox + px * k, oy + py * k];
  g.moveTo(...P(12, 2.6)); g.lineTo(...P(3.4, 7.4)); g.lineTo(...P(3.4, 16.6)); g.lineTo(...P(12, 21.4));
  g.lineTo(...P(20.6, 16.6)); g.lineTo(...P(20.6, 7.4)); g.closePath();
  g.moveTo(...P(3.4, 7.4)); g.lineTo(...P(12, 12.2)); g.lineTo(...P(20.6, 7.4));
  g.moveTo(...P(12, 12.2)); g.lineTo(...P(12, 21.4));
  g.stroke();
  g.restore();
}
function wordmark(g, x, y, size, ink, flow) {
  g.save();
  g.textBaseline = 'middle';
  g.font = `600 ${size}px Fraunces, Georgia, serif`;
  g.fillStyle = ink; g.fillText('Rental', x, y);
  const w = g.measureText('Rental').width;
  g.font = `italic 600 ${size}px Fraunces, Georgia, serif`;
  g.fillStyle = flow; g.fillText('Flow', x + w, y);
  const total = w + g.measureText('Flow').width;
  g.restore();
  return total;
}

// The watermark on every frame: logo + wordmark on a pill, top-left.
function brand(g, st) {
  g.save();
  const dark = st.glow;
  g.font = '600 30px Fraunces, Georgia, serif';
  const textW = g.measureText('RentalFlow').width + 6;
  roundRect(g, 36, 58, textW + 86, 62, 20);
  g.fillStyle = dark ? 'rgba(10,18,14,.72)' : 'rgba(255,255,255,.82)'; g.fill();
  logoMark(g, 46, 66, 46);
  wordmark(g, 104, 90, 30, dark ? '#EDF2E6' : '#10291D', dark ? '#C6F24E' : '#4F8A0B');
  g.restore();
}

function progress(g, st, t, total) {
  const x = 40; const w = W - 80;
  g.fillStyle = st.glow ? 'rgba(255,255,255,.18)' : 'rgba(16,41,29,.18)';
  roundRect(g, x, 30, w, 6, 3); g.fill();
  g.fillStyle = st.glow ? '#C6F24E' : st.accent;
  roundRect(g, x, 30, Math.max(6, w * (t / total)), 6, 3); g.fill();
}

function hookCard(g, st, hook, t) {
  const k = ease(t / 0.6);
  g.save();
  g.globalAlpha = k;
  g.fillStyle = st.ink; g.textAlign = 'center';
  g.font = '800 84px Inter, system-ui, sans-serif';
  const lines = wrap(g, hook, W - 120);
  const y0 = H / 2 - (lines.length - 1) * 50 + (1 - k) * 60;
  lines.forEach((l, i) => g.fillText(l, W / 2, y0 + i * 100));
  g.font = '600 30px Inter, system-ui, sans-serif';
  g.globalAlpha = k * 0.8;
  g.fillText('on RentalFlow', W / 2, y0 + lines.length * 100 + 10);
  g.restore();
}

function scene(g, st, item, img, local, index, count, slideIn) {
  const x0 = slideIn != null ? (1 - ease(slideIn)) * W : 0;
  g.save(); g.translate(x0, 0);
  // the product, on a card, slowly zooming
  const box = 600; const cx = W / 2; const cy = 560;
  g.save();
  g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 40; g.shadowOffsetY = 18;
  roundRect(g, cx - box / 2 - 20, cy - box / 2 - 20, box + 40, box + 40, 36);
  g.fillStyle = st.card; g.fill();
  g.restore();
  if (img) {
    const z = 1 + 0.07 * ease(local / SCENE);
    const { w, h } = containRect(img, box, box);
    g.save();
    roundRect(g, cx - box / 2 - 20, cy - box / 2 - 20, box + 40, box + 40, 36); g.clip();
    g.drawImage(img, cx - (w * z) / 2, cy - (h * z) / 2, w * z, h * z);
    g.restore();
  }
  // the words, rising in
  const k = ease((local - 0.2) / 0.5);
  g.globalAlpha = k;
  g.fillStyle = st.ink; g.textAlign = 'left';
  g.font = '800 52px Inter, system-ui, sans-serif';
  const lines = wrap(g, item.name, W - 110);
  const ty = 960 + (1 - k) * 40;
  lines.forEach((l, i) => g.fillText(l, 52, ty + i * 62));
  // price chip
  g.font = '800 40px Inter, system-ui, sans-serif';
  const price = `${taka(item.rental_price)}/day`;
  const pw = g.measureText(price).width + 44;
  const py = ty + lines.length * 62 + 12;
  roundRect(g, 52, py, pw, 66, 20);
  g.fillStyle = st.glow ? '#C6F24E' : st.ink; g.fill();
  g.fillStyle = st.glow ? '#0B140F' : st.card === '#FFFFFF' && !st.glow ? st.bg[0] : '#FFFFFF';
  g.textBaseline = 'middle'; g.fillText(price, 74, py + 34);
  g.textBaseline = 'alphabetic';
  // "2 / 3"
  if (count > 1) {
    g.font = '700 26px Inter, system-ui, sans-serif'; g.globalAlpha = k * 0.7; g.fillStyle = st.ink;
    g.textAlign = 'right'; g.fillText(`${index + 1} / ${count}`, W - 52, 1200);
  }
  g.restore();
}

// The closing card: the big logo, the wordmark, the price and where to go.
function outro(g, st, items, local) {
  const k = ease(local / 0.6);
  const total = items.reduce((s, i) => s + Number(i.rental_price || 0), 0);
  const dark = st.glow;
  g.save(); g.globalAlpha = k;
  const s = 150 + (1 - k) * 40;
  logoMark(g, W / 2 - s / 2, H / 2 - 360 + (1 - k) * 30, s);
  g.font = '600 92px Fraunces, Georgia, serif';
  const wm = g.measureText('RentalFlow').width;
  wordmark(g, W / 2 - wm / 2, H / 2 - 110, 92, st.ink, dark ? '#C6F24E' : st.accent);
  g.textAlign = 'center'; g.fillStyle = st.ink;
  g.font = '700 40px Inter, system-ui, sans-serif';
  const line = items.length > 1 ? `All of it from ${taka(total)} a day` : `Rent it from ${taka(total)} a day`;
  g.fillText(line, W / 2, H / 2 + 10);
  g.font = '600 27px Inter, system-ui, sans-serif'; g.globalAlpha = k * 0.78;
  g.fillText('Verified owners · deposit protection · damage cover', W / 2, H / 2 + 70);
  // the address, on a pill
  g.globalAlpha = k;
  const host = typeof window !== 'undefined' ? window.location.host : 'rentalflow';
  g.font = '800 32px Inter, system-ui, sans-serif';
  const pw = g.measureText(host).width + 60;
  roundRect(g, W / 2 - pw / 2, H / 2 + 130, pw, 70, 35);
  g.fillStyle = dark ? '#C6F24E' : '#10291D'; g.fill();
  g.fillStyle = dark ? '#0B140F' : '#F5F1E8';
  g.textBaseline = 'middle'; g.fillText(host, W / 2, H / 2 + 166);
  g.restore();
}

// Draw the frame at time t (seconds).
export function drawFrame(g, { items, images, style, hook }, t) {
  const st = STYLES[style] || STYLES.neon;
  const total = durationFor(items.length);
  const sceneAt = Math.min(items.length - 1, Math.max(0, Math.floor((t - HOOK) / SCENE)));
  background(g, st, t, t >= HOOK && t < HOOK + items.length * SCENE ? images[sceneAt] : images[0]);
  if (t < HOOK) {
    hookCard(g, st, hook, t);
  } else if (t < HOOK + items.length * SCENE) {
    const local = t - HOOK - sceneAt * SCENE;
    // the previous scene slides away while this one slides in
    if (local < SLIDE && sceneAt > 0) {
      g.save(); g.translate(-ease(local / SLIDE) * W, 0);
      scene(g, st, items[sceneAt - 1], images[sceneAt - 1], SCENE, sceneAt - 1, items.length, null);
      g.restore();
      scene(g, st, items[sceneAt], images[sceneAt], local, sceneAt, items.length, local / SLIDE);
    } else {
      scene(g, st, items[sceneAt], images[sceneAt], local, sceneAt, items.length, sceneAt === 0 && local < SLIDE ? local / SLIDE : null);
    }
  } else {
    outro(g, st, items, t - HOOK - items.length * SCENE);
  }
  brand(g, st);
  progress(g, st, t, total);
}

// The brand serif must be ready before the first frame is drawn.
export async function brandFontsReady() {
  try { if (logoImg && !logoImg.complete) await logoImg.decode(); } catch { /* the drawn cube stands in */ }
  try {
    await Promise.all([document.fonts.load('600 40px Fraunces'), document.fonts.load('italic 600 40px Fraunces'), document.fonts.load('800 40px Inter')]);
  } catch { /* falls back to Georgia */ }
}

export async function loadImages(items) {
  return Promise.all(items.map(async (i) => {
    if (!i.cover_url) return null;
    try {
      const res = await fetch(i.cover_url);
      return await createImageBitmap(await res.blob());
    } catch { return null; }
  }));
}

// A soft, royalty-free beat made on the spot: kick, hat and a warm chord pad.
function beat(ac, dest, seconds, bpm = 104) {
  const spb = 60 / bpm;
  const start = ac.currentTime + 0.05;
  const master = ac.createGain(); master.gain.value = 0.55; master.connect(dest);
  const hit = (time, f0, f1, len, gain, type = 'sine') => {
    const o = ac.createOscillator(); const g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, time); o.frequency.exponentialRampToValueAtTime(f1, time + len);
    g.gain.setValueAtTime(gain, time); g.gain.exponentialRampToValueAtTime(0.0001, time + len);
    o.connect(g); g.connect(master); o.start(time); o.stop(time + len + 0.02);
  };
  const noise = ac.createBuffer(1, ac.sampleRate * 0.05, ac.sampleRate);
  noise.getChannelData(0).forEach((_, i, a) => { a[i] = Math.random() * 2 - 1; });
  const hat = (time) => {
    const s = ac.createBufferSource(); s.buffer = noise;
    const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = ac.createGain(); g.gain.setValueAtTime(0.12, time); g.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    s.connect(f); f.connect(g); g.connect(master); s.start(time);
  };
  const chords = [[261.6, 329.6, 392], [220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7]];
  const beats = Math.ceil(seconds / spb);
  for (let b = 0; b < beats; b += 1) {
    const time = start + b * spb;
    if (b % 2 === 0) hit(time, 120, 45, 0.3, 0.9);          // kick
    hat(time + spb / 2);
    if (b % 4 === 0) {                                       // a chord every bar
      chords[(b / 4) % chords.length].forEach((f) => hit(time, f, f, spb * 3.8, 0.05, 'triangle'));
    }
  }
}

function pickMime() {
  const options = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return options.find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || '';
}

// Record the whole video in real time. onProgress(0..1). → File
export async function recordVideo(canvas, spec, { music = true, onProgress } = {}) {
  await brandFontsReady();
  const mime = pickMime();
  if (!mime) throw new Error('This browser cannot record video. Try Chrome, Edge or Safari.');
  const g = canvas.getContext('2d');
  const seconds = durationFor(spec.items.length);
  const stream = canvas.captureStream(FPS);
  let ac = null;
  if (music) {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    const dest = ac.createMediaStreamDestination();
    beat(ac, dest, seconds);
    dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
  }
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_500_000 });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const done = new Promise((resolve) => { rec.onstop = resolve; });
  rec.start(250);
  const t0 = performance.now();
  await new Promise((resolve) => {
    const tick = () => {
      const t = (performance.now() - t0) / 1000;
      drawFrame(g, spec, Math.min(t, seconds));
      onProgress?.(Math.min(1, t / seconds));
      if (t < seconds) requestAnimationFrame(tick); else resolve();
    };
    requestAnimationFrame(tick);
  });
  rec.stop();
  await done;
  stream.getTracks().forEach((tr) => tr.stop());
  ac?.close();
  const type = mime.split(';')[0];
  return new File(chunks, `rentalflow-${Date.now()}.${type === 'video/mp4' ? 'mp4' : 'webm'}`, { type });
}

// ---------------------------------------------------------------- frame-perfect encoding
const RATE = 48000;

// The beat, rendered offline into an audio buffer (no speakers involved).
async function renderBeatBuffer(seconds) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const ac = new OAC(2, Math.ceil(RATE * seconds), RATE);
  beat(ac, ac.destination, seconds);
  return ac.startRendering();
}

async function pickVideoConfig() {
  if (!window.VideoEncoder) return null;
  for (const codec of ['avc1.4d002a', 'avc1.42002a', 'avc1.640028']) {
    const cfg = { codec, width: W, height: H, bitrate: 3_500_000, framerate: FPS };
    try { if ((await VideoEncoder.isConfigSupported(cfg)).supported) return cfg; } catch { /* next */ }
  }
  return null;
}
async function pickAudioConfig() {
  if (!window.AudioEncoder) return null;
  for (const [codec, box] of [['mp4a.40.2', 'aac'], ['opus', 'opus']]) {
    const cfg = { codec, sampleRate: RATE, numberOfChannels: 2, bitrate: 128_000 };
    try { if ((await AudioEncoder.isConfigSupported(cfg)).supported) return { cfg, box }; } catch { /* next */ }
  }
  return null;
}

export async function canEncodeFramePerfect() {
  return Boolean(await pickVideoConfig());
}

// → File (video/mp4), every frame exactly 1/30 s apart.
export async function encodeVideo(spec, { music = true, onProgress } = {}) {
  await brandFontsReady();
  const vcfg = await pickVideoConfig();
  if (!vcfg) throw new Error('no-webcodecs');
  const audio = music ? await pickAudioConfig() : null;
  const seconds = durationFor(spec.items.length);
  const frames = Math.round(seconds * FPS);

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: W, height: H },
    ...(audio ? { audio: { codec: audio.box, numberOfChannels: 2, sampleRate: RATE } } : {}),
    fastStart: 'in-memory',
  });
  let failure = null;
  const venc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => { failure = e; } });
  venc.configure(vcfg);

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  for (let i = 0; i < frames; i += 1) {
    if (failure) throw failure;
    drawFrame(g, spec, i / FPS);
    const frame = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
    venc.encode(frame, { keyFrame: i % (FPS * 2) === 0 });
    frame.close();
    onProgress?.((i + 1) / frames * (audio ? 0.9 : 1));
    // let the page breathe (and the encoder catch up) every few frames
    if (i % 6 === 0 || venc.encodeQueueSize > 12) await new Promise((r) => setTimeout(r, 0));
  }
  await venc.flush();
  venc.close();

  if (audio) {
    const buffer = await renderBeatBuffer(seconds);
    const aenc = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: (e) => { failure = e; } });
    aenc.configure(audio.cfg);
    const L = buffer.getChannelData(0);
    const R = buffer.getChannelData(1);
    const STEP = 1024;
    for (let at = 0; at < buffer.length; at += STEP) {
      const n = Math.min(STEP, buffer.length - at);
      const planar = new Float32Array(n * 2);
      planar.set(L.subarray(at, at + n), 0);
      planar.set(R.subarray(at, at + n), n);
      const data = new AudioData({ format: 'f32-planar', sampleRate: RATE, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((at * 1e6) / RATE), data: planar });
      aenc.encode(data);
      data.close();
    }
    await aenc.flush();
    aenc.close();
    if (failure) throw failure;
    onProgress?.(1);
  }
  muxer.finalize();
  return new File([muxer.target.buffer], `rentalflow-${Date.now()}.mp4`, { type: 'video/mp4' });
}

// The Studio's one call: frame-perfect when the browser can, recorded otherwise.
export async function makeVideo(canvas, spec, opts = {}) {
  try {
    return await encodeVideo(spec, opts);
  } catch (e) {
    if (e?.message !== 'no-webcodecs') console.warn('Frame-perfect encoding failed, recording instead:', e);
    return recordVideo(canvas, spec, opts);
  }
}
