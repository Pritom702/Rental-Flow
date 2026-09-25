// ============================================================
//  RentalFlow  |  Community  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: shrink photos in the browser, then upload
// ============================================================
// A phone photo is 3–8 MB. Before it leaves the device it is resized to at
// most 1600 px and saved as JPEG (about 150–350 KB), and its average colour is
// measured so the feed can paint a placeholder of the right shape and colour
// while it loads — no layout jumps, far less data for everyone.
import { getToken, announceReward } from '../api.js';

const MAX_UPLOAD = 3.5 * 1024 * 1024;

function toBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

// → { file: File, w, h, color }
export async function shrinkImage(file, maxSide = 1600) {
  // Always JPEG: the server checks every photo for adult content and reads
  // JPEG. (An animated GIF becomes its first frame.)
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
  if (!bitmap) throw new Error('That photo could not be read. Try a JPEG or PNG.');
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const g = canvas.getContext('2d');
  g.fillStyle = '#ffffff';            // JPEG has no transparency: see-through PNG parts become white
  g.fillRect(0, 0, w, h);
  g.drawImage(bitmap, 0, 0, w, h);

  // Average colour, from a 1×1 copy.
  const dot = document.createElement('canvas');
  dot.width = 1; dot.height = 1;
  const dg = dot.getContext('2d');
  dg.drawImage(bitmap, 0, 0, 1, 1);
  const [r, gg, b] = dg.getImageData(0, 0, 1, 1).data;
  const color = `#${[r, gg, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  bitmap.close?.();

  const blob = await toBlob(canvas, 'image/jpeg', 0.84);
  if (!blob) throw new Error('That photo could not be prepared. Try another one.');
  const name = `${(file.name || 'photo').replace(/\.[^.]+$/, '')}.jpg`;
  return { file: new File([blob], name, { type: blob.type }), w, h, color };
}

// Upload one file to the community store. → { url, type, mime, name, size }
export async function uploadFile(file, { imagesOnly = false } = {}) {
  if (file.size > MAX_UPLOAD) throw new Error(`${file.name} is over 3.5 MB.`);
  const form = new FormData();
  form.append('file', file);
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`/api/community/upload${imagesOnly ? '?images=1' : ''}`, { method: 'POST', headers, body: form });
  announceReward(res);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
  return data;
}

export function fileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ---------------------------------------------------------------- video
// Before a video is uploaded, the device reads it once: length, size, a cover
// frame (shown in the feed before any video data loads) and five small frames
// spread across it, which the server checks for adult content.
export const MAX_VIDEO_MB = 100;
export const MAX_VIDEO_SECONDS = 180;

function seek(video, t) {
  return new Promise((resolve, reject) => {
    const done = () => { video.removeEventListener('seeked', done); resolve(); };
    video.addEventListener('seeked', done);
    video.addEventListener('error', reject, { once: true });
    video.currentTime = t;
  });
}
function frameOf(video, maxSide, quality) {
  const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(video.videoWidth * scale);
  c.height = Math.round(video.videoHeight * scale);
  c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
  return new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', quality));
}

// → { poster: File, frames: Blob[], duration, w, h }
export async function readVideo(file) {
  preloadUploader();
  if (!['video/mp4', 'video/webm', 'video/quicktime'].includes(file.type)) throw new Error('Share videos as MP4, WebM or MOV.');
  if (file.size > MAX_VIDEO_MB * 1024 * 1024) throw new Error(`Videos can be up to ${MAX_VIDEO_MB} MB.`);
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true; video.playsInline = true; video.preload = 'auto'; video.src = url;
  try {
    await new Promise((resolve, reject) => {
      video.addEventListener('loadeddata', resolve, { once: true });
      video.addEventListener('error', () => reject(new Error('This video could not be read on this device. Try an MP4.')), { once: true });
    });
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('This video could not be read on this device. Try an MP4.');
    if (duration > MAX_VIDEO_SECONDS) throw new Error(`Videos can be up to ${MAX_VIDEO_SECONDS / 60} minutes long.`);
    const frames = [];
    for (const at of [0.08, 0.3, 0.5, 0.7, 0.92]) {
      await seek(video, duration * at);
      frames.push(await frameOf(video, 320, 0.7));
    }
    await seek(video, Math.min(1, duration * 0.1));
    const posterBlob = await frameOf(video, 960, 0.82);
    return {
      poster: new File([posterBlob], 'cover.jpg', { type: 'image/jpeg' }),
      frames, duration: Math.round(duration), w: video.videoWidth, h: video.videoHeight,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// The upload library is fetched ahead of time (when the Studio opens or a
// video is picked). Fetching it only at upload time broke when a new version
// was deployed while the tab was open: the old file name no longer exists.
let uploader = null;
export function preloadUploader() {
  if (!uploader) {
    uploader = import('@vercel/blob/client');
    uploader.catch(() => { uploader = null; });
  }
  return uploader;
}

// Check → token → straight to the Blob store. onProgress(0..1).
export async function uploadVideo(file, frames, onProgress) {
  const { api } = await import('../api.js');
  const form = new FormData();
  frames.forEach((f, i) => form.append('frames', f, `f${i}.jpg`));
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch('/api/community/video/check', { method: 'POST', headers, body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (['adult-warning', 'adult-banned'].includes(data.reason)) {
      window.dispatchEvent(new CustomEvent('rf:moderation', { detail: { reason: data.reason, message: data.error } }));
    }
    throw new Error(data.error || 'This video could not be checked.');
  }
  const { token: uploadToken, pathname } = await api.post('/community/video/token', { clearance: data.clearance, type: file.type, size: file.size });
  let put;
  try {
    ({ put } = await preloadUploader());
  } catch {
    throw new Error('RentalFlow was just updated. Refresh the page and try again.');
  }
  const blob = await put(pathname, file, {
    access: 'public',
    token: uploadToken,
    contentType: file.type,
    multipart: file.size > 8 * 1024 * 1024,
    onUploadProgress: (p) => onProgress?.(p.percentage / 100),
  });
  return blob.url;
}

export function duration(s) {
  const n = Math.round(Number(s) || 0);
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
}

// A profile photo: the centre square, 640 × 640, as JPEG.
export async function squarePhoto(file, side = 640) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
  if (!bitmap) throw new Error('That photo could not be read. Try a JPEG or PNG.');
  const s = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = side; canvas.height = side;
  const g = canvas.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, side, side);
  g.drawImage(bitmap, (bitmap.width - s) / 2, (bitmap.height - s) / 2, s, s, 0, 0, side, side);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
  return new File([blob], 'me.jpg', { type: 'image/jpeg' });
}

export async function uploadAvatar(file) {
  const form = new FormData();
  form.append('file', await squarePhoto(file));
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch('/api/community/avatar', { method: 'POST', headers, body: form });
  announceReward(res);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (['adult-warning', 'adult-banned'].includes(data.reason)) {
      window.dispatchEvent(new CustomEvent('rf:moderation', { detail: { reason: data.reason, message: data.error } }));
    }
    throw new Error(data.error || 'That photo could not be used.');
  }
  return data;
}
