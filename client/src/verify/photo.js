// ============================================================
//  RentalFlow  |  Identity verification  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: preparing a photo on the phone before upload
// ============================================================
// A phone camera photo is 3–12 MB. We shrink it to at most 1280 px on the long
// side and re-encode it as JPEG (~250 KB) so the upload is quick on mobile data,
// and score its sharpness with the SAME function the server uses — so the
// "too blurry, retake" message appears instantly instead of after an upload.
import { toGray, shrink, sharpness, MIN_SHARPNESS } from '@shared/pixelUtils.js';

export const MAX_SIDE = 1280;

// File from <input type="file"> → a decoded image, rotated upright.
async function decode(file) {
  if (window.createImageBitmap) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch { /* older Safari: fall through to <img> */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Draw `source` (an image, bitmap or <video>) onto a canvas no bigger than
// `maxSide`, and return the canvas.
export function drawScaled(source, maxSide, srcWidth, srcHeight) {
  const w = srcWidth || source.width;
  const h = srcHeight || source.height;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function canvasSharpness(canvas) {
  const { width, height } = canvas;
  const { data } = canvas.getContext('2d').getImageData(0, 0, width, height);
  return sharpness(shrink(toGray({ width, height, data })));
}

// → { dataUrl, sharpness, sharp }
export async function prepareCardPhoto(file) {
  const image = await decode(file);
  const canvas = drawScaled(image, MAX_SIDE);
  const score = canvasSharpness(canvas);
  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.88),
    sharpness: score,
    sharp: score >= MIN_SHARPNESS,
  };
}
