// ============================================================
//  RentalFlow  |  Identity verification  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: NID rules, card reading, final decision (pure)
// ============================================================
// Pure functions only — no database, no HTTP, no image libraries — so every
// rule that decides whether an identity is accepted can be unit tested.
//
// What a Bangladeshi NID number looks like:
//   17 digits  YYYY DD R UU NN SSSSSS   birth year + the 13-digit number below
//   13 digits  DD R UU NN SSSSSS        district, RMO, upazila, union, serial
//   10 digits  smart card (2016+)       no published structure
// DD is a district geocode from the Bangladesh Bureau of Statistics.

import { normalizeNid } from './profileUtils.js';

// The 64 district geocodes (BBS). Codes are not contiguous: the numbering was
// assigned before several districts were split, so e.g. 02, 05 and 07 are unused.
// An unknown code sends the NID to an admin rather than rejecting it outright,
// so a genuine card is never blocked by a gap in this table.
export const DISTRICT_CODES = new Set([
  '01', '03', '04', '06', '09', '10', '12', '13', '15', '18', '19', '22', '26', '27',
  '29', '30', '32', '33', '35', '36', '38', '39', '41', '42', '44', '46', '47', '48', '49',
  '50', '51', '52', '54', '55', '56', '57', '58', '59', '61', '64', '65', '67', '68',
  '69', '70', '72', '73', '75', '76', '77', '78', '79', '81', '82', '84', '85', '86',
  '87', '88', '89', '90', '91', '93', '94',
]);

// A card holder must be an adult (18+) and plausibly alive.
export const MIN_BIRTH_YEAR = 1900;
export const ADULT_AGE = 18;

// "1111111111", "1234567890", "9876543210", "1212121212" — typed by someone
// making a number up, never issued on a real card.
export function looksMadeUp(digits) {
  if (/^(\d)\1+$/.test(digits)) return true;
  const up = '01234567890123456789';
  const down = '98765432109876543210';
  if (up.includes(digits) || down.includes(digits)) return true;
  if (/^(\d\d)\1+$/.test(digits) || /^(\d\d\d)\1+\d{0,2}$/.test(digits)) return true;
  return false;
}

// Validate the NUMBER on its own, before any photo is looked at.
// Returns { ok, digits, canonical, birthYear, flags } or { ok: false, reason }.
export function checkNidStructure(value, now = new Date()) {
  const digits = normalizeNid(value);
  if (![10, 13, 17].includes(digits.length)) return { ok: false, reason: 'nid-length' };
  if (looksMadeUp(digits)) return { ok: false, reason: 'nid-pattern' };

  let birthYear = null;
  let core = digits;
  if (digits.length === 17) {
    birthYear = Number(digits.slice(0, 4));
    if (birthYear < MIN_BIRTH_YEAR || birthYear > now.getFullYear() - ADULT_AGE) {
      return { ok: false, reason: 'nid-birth-year' };
    }
    core = digits.slice(4);
  }
  const flags = [];
  if (core.length === 13 && !DISTRICT_CODES.has(core.slice(0, 2))) flags.push('nid-district-unknown');
  return { ok: true, digits, canonical: canonicalNid(digits), birthYear, flags };
}

// The value uniqueness is enforced on. 17 → its 13-digit core; 10 and 13 as-is.
export function canonicalNid(value) {
  const digits = normalizeNid(value);
  return digits.length === 17 ? digits.slice(4) : digits;
}

// ---------------------------------------------------------------- names

// Upper-case letters and single spaces only — OCR adds stray dots and commas.
export function normalizeName(name) {
  return String(name || '').toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function levenshtein(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const next = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = prev[j];
      prev[j] = next;
    }
  }
  return prev[b.length];
}

// 1 = identical, 0 = nothing alike. Tolerates the one-or-two-letter slips OCR
// makes ("MD. RAHIM" vs "MD RAHlM"), not a different person's name.
export function nameSimilarity(a, b) {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x || !y) return 0;
  return 1 - levenshtein(x, y) / Math.max(x.length, y.length);
}

// ---------------------------------------------------------------- dates

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// "26 Feb 1990" (how the card prints it) → "1990-02-26". null if unreadable.
export function parseCardDate(text) {
  const m = String(text || '').toUpperCase().match(/(\d{1,2})\s*([A-Z]{3})[A-Z]*\s*(\d{4})/);
  if (!m) return null;
  const month = MONTHS.indexOf(m[2]);
  if (month < 0) return null;
  const day = Number(m[1]);
  if (day < 1 || day > 31) return null;
  return `${m[3]}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ---------------------------------------------------------------- card reading

// OCR confuses these with digits inside a number.
const DIGIT_LOOKALIKES = { O: '0', D: '0', Q: '0', I: '1', L: '1', '|': '1', Z: '2', S: '5', B: '8', G: '6' };

function digitsFrom(fragment) {
  return fragment.toUpperCase().split('')
    .map((c) => DIGIT_LOOKALIKES[c] ?? c)
    .join('')
    .replace(/\D/g, '');
}

// Pull the NID number, name and date of birth out of the raw OCR text of the
// FRONT of the card. Missing fields come back null; the decision step treats a
// field it could not read as "needs a human", never as a pass.
export function extractCardFields(text) {
  const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let number = null;
  let name = null;
  let dob = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const upper = line.toUpperCase();

    // "ID NO: 461 728 9035" / "NID No. 19902612345678901"
    if (!number && /\bI\s*D\s*[N][O0]\b|\bNID\b/.test(upper)) {
      const after = line.replace(/^.*?(?:I\s*D\s*[Nn][Oo0]|NID(?:\s*[Nn][Oo0])?)[\s.:]*/i, '');
      // Trim junk at the ends first: the card's border often reads as "|" or
      // ":" after the number, and "|" would otherwise become an extra "1".
      const core = after.replace(/^[^0-9]+|[^0-9]+$/g, '');
      const d = [digitsFrom(core), core.replace(/\D/g, '')].find((x) => [10, 13, 17].includes(x.length));
      if (d) number = d;
    }

    // "Name: MD RAHIM UDDIN" or "Name" on one line and the value on the next.
    // The label can sit anywhere on the line: the card photo beside it often
    // reads as a few junk characters in front of it.
    const label = /\bNAME\b[\s.:]*(.*)$/i.exec(line);
    if (!name && label && !/FATHER|MOTHER|HUSBAND|SPOUSE/.test(upper)) {
      const inline = normalizeName(label[1]);
      const next = normalizeName(lines[i + 1] || '');
      name = inline.length >= 3 ? inline : (next.length >= 3 ? next : null);
    }

    if (!dob && /DATE\s*OF\s*BIRTH|\bDOB\b|BIRTH/.test(upper)) {
      dob = parseCardDate(line) || parseCardDate(lines[i + 1]);
    }
  }

  // Fallback: a long run of digits anywhere on the card.
  if (!number) {
    const runs = (String(text || '').match(/[\dOIl|SBZ ]{10,24}/g) || [])
      .map(digitsFrom)
      .filter((d) => [10, 13, 17].includes(d.length));
    number = runs[0] || null;
  }
  return { number, name, dob };
}

// ---------------------------------------------------------------- decision

// Face distance (Euclidean, 128-number descriptors). Measured with the model we
// ship: the same person scores roughly 0.30–0.48, different people 0.70+.
export const FACE_MATCH = 0.5;       // below: same person
export const FACE_UNSURE = 0.6;      // 0.5–0.6: a human should look
export const FACE_DUPLICATE = 0.45;  // selfie this close to ANOTHER member: same person
// Within one live selfie, the turned-head frames must still be the same person
// as the straight-on frame. A turned head changes the face numbers a lot (a
// real 30° turn scores 0.45–0.6 against the same face looking straight), so
// this is looser than FACE_MATCH; a different person still scores 0.7+.
export const FACE_SAME_ACROSS_POSES = 0.6;
export const NAME_MATCH = 0.8;
export const DHASH_NEAR = 6;         // bits of 64: same photo, resized or re-saved
export const MAX_LIVENESS_TRIES = 3;

// The whole automatic verdict in one place.
//   'verified'        every check passed
//   'pending_review'  a check could not confirm — an admin decides
// Hard failures (blurry photo, fake number, duplicate NID, failed liveness)
// are handled before this is called and never reach it.
export function decideVerification(c = {}) {
  const reasons = [];
  if (!c.ocrNumber) reasons.push('card-number-unreadable');
  else if (c.ocrNumber !== c.typedNumber) reasons.push('card-number-mismatch');

  if (!c.ocrName) reasons.push('card-name-unreadable');
  else if ((c.nameScore ?? 0) < NAME_MATCH) reasons.push('card-name-mismatch');

  if (c.birthYear && c.ocrDob && Number(c.ocrDob.slice(0, 4)) !== c.birthYear) {
    reasons.push('birth-year-mismatch');
  }
  if (c.typedDob && c.ocrDob && c.typedDob !== c.ocrDob) reasons.push('dob-mismatch');

  if (c.faceDistance == null) reasons.push('card-face-missing');
  else if (c.faceDistance >= FACE_UNSURE) reasons.push('face-mismatch');
  else if (c.faceDistance >= FACE_MATCH) reasons.push('face-unsure');

  if (!c.livenessPassed) reasons.push('liveness-failed');
  for (const flag of c.flags || []) reasons.push(flag);

  return { decision: reasons.length ? 'pending_review' : 'verified', reasons };
}

// Plain-language text for every reason code. Members see the retry ones;
// admins see all of them on the review screen.
export const REASON_TEXT = {
  'nid-length': 'A Bangladeshi NID number has 10, 13 or 17 digits.',
  'nid-pattern': 'That is not a real NID number. Type the number exactly as printed on your card.',
  'nid-birth-year': 'The first four digits of a 17-digit NID are your birth year, and that year is not valid.',
  'nid-district-unknown': 'The NID does not start with a known district code.',
  'nid-taken': 'This NID is already registered to another account. If it is yours, contact support.',
  'blurry-front': 'The photo of the front of the card is blurry.',
  'blurry-back': 'The photo of the back of the card is blurry.',
  'blurry-selfie': 'The selfie is blurry.',
  'model-low-confidence': 'Every rule passed, but the learning model (trained on past admin decisions) was not confident enough to approve automatically.',
  'manual-review': 'Every automatic check passed. Automatic approval is switched off, so an admin confirms each member.',
  'no-card-face': 'We could not find the photo on your NID. Make sure the whole card is in the picture, flat and without glare.',
  'no-selfie-face': 'We could not see your face. Look straight at the camera in good light.',
  'multiple-faces': 'More than one face is in the picture. Make sure only you are in front of the camera.',
  'liveness-failed': 'We could not confirm the head movements. Follow the on-screen instructions and try again.',
  'bad-image': 'That file could not be read as a photo. Take the picture again.',
  'card-number-unreadable': 'The NID number on the card photo could not be read.',
  'card-number-mismatch': 'The number printed on the card is different from the number typed.',
  'card-name-unreadable': 'The name on the card photo could not be read.',
  'card-name-mismatch': 'The name printed on the card is different from the name typed.',
  'birth-year-mismatch': 'The birth year on the card does not match the first four digits of the NID.',
  'dob-mismatch': 'The date of birth on the card is different from the one typed.',
  'card-face-missing': 'No face could be found on the card photo to compare with.',
  'face-mismatch': 'The selfie does not look like the person on the NID.',
  'face-unsure': 'The selfie only partly matches the person on the NID.',
  'duplicate-photo': 'This card photo is the same as one already submitted by another account.',
  'duplicate-face': 'This face already belongs to another verified account.',
  'too-many-liveness-tries': 'The live selfie check failed several times.',
  'identity-blacklisted': 'This identity is banned from RentalFlow after an item rented with it was not returned. Contact support if you think this is a mistake.',
};

// Combine several readings of the same card (the photo as-is, and an enlarged,
// high-contrast copy). Each pass tends to misread different characters, so for
// every field keep the reading that agrees with what the member typed; if none
// agrees, keep the first one found, so an admin sees what the card really says.
export function mergeCardReads(reads, typed = {}) {
  const found = reads.filter(Boolean);
  const pick = (field, same) => {
    const values = found.map((r) => r[field]).filter(Boolean);
    return values.find(same) || values[0] || null;
  };
  const byName = found.map((r) => r.name).filter(Boolean)
    .sort((a, b) => nameSimilarity(b, typed.name) - nameSimilarity(a, typed.name));
  return {
    number: pick('number', (v) => v === typed.number),
    name: byName[0] || null,
    dob: pick('dob', (v) => v === typed.dob),
  };
}

// True when a reading already confirms everything, so no second pass is needed.
export function readConfirms(read, typed = {}) {
  return Boolean(read.number === typed.number && read.dob === typed.dob
    && read.name && nameSimilarity(read.name, typed.name) >= NAME_MATCH);
}
