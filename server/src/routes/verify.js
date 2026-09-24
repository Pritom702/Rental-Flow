// ============================================================
//  RentalFlow  |  Identity verification  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: onboarding API — email, NID, live selfie, review
// ============================================================
// A new member confirms their email at sign-up. The identity check (NID card
// + live selfie) happens the first time they put up a listing:
//
//   GET  /api/verify/status          where am I? (the app routes on this)
//   POST /api/verify/email/send      email me a 6-digit code
//   POST /api/verify/email/confirm   { code }
//   POST /api/verify/nid             { nid_number, nid_name, date_of_birth, front, back }
//   POST /api/verify/selfie          { frames: { forward, left | right | up } }
//   POST /api/verify/handoff         QR link to continue on a phone (handoff.js)
//
// and admins settle whatever the machine could not:
//
//   GET  /api/verify/admin/queue
//   GET  /api/verify/admin/attempts/:id
//   POST /api/verify/admin/attempts/:id/decision   { approve, note }
//   GET  /api/verify/admin/model                    what the learning model knows
//
// Only things the member can fix on the spot are refused (a mistyped NID, an
// NID that belongs to someone else, a file that is not a photo, no face in
// the selfie). Everything the machine is unsure about — blurry photos, a card
// it cannot read, a face that does not match — goes to an admin instead. Each
// admin decision trains the risk model (riskModel.js).
import { Router } from 'express';
import crypto from 'crypto';
import { query, pool } from '../db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import {
  checkNidStructure, nameSimilarity, extractCardFields, decideVerification, mergeCardReads, readConfirms,
  REASON_TEXT, FACE_MATCH, FACE_DUPLICATE, FACE_SAME_ACROSS_POSES, DHASH_NEAR, MAX_LIVENESS_TRIES,
} from '../nidUtils.js';
import { analysePhoto, regionHash, cardTextRegion, rotateRgba, encodeJpeg, MIN_SHARPNESS } from '../imageUtils.js';
import { frameShows, pickChallenge, challengeIsCurrent, ACTION_TEXT } from '../livenessUtils.js';
import { findFaces, findCardFace, faceDistance } from '../faceEngine.js';
import { readText } from '../ocrEngine.js';
import { sendMail, mailConfigured, codeEmail, decisionEmail } from '../mailer.js';
import { signFileUrl } from './files.js';
import { createHandoff } from './handoff.js';
import { identityVerified } from '../middleware/requireVerified.js';
import {
  FEATURES, PRIOR, featureVector, predict, priorModel, train, leaveOneOutAccuracy, explain, AUTO_APPROVE_MIN,
} from '../riskModel.js';

const router = Router();
router.use(authRequired);

const CODE_TTL_MINUTES = 10;
const CODE_MAX_ATTEMPTS = 5;
const RESEND_AFTER_SECONDS = 60;
// An abandoned half-finished attempt stops reserving its NID after this long.
const STALE_ATTEMPT_MINUTES = 30;

// A retry-able failure: 4xx with a reason code and the text to show. Logged,
// so the server log says WHICH check turned a member away.
function refuse(res, status, reason, extra = {}) {
  console.warn(`[verify] refused user=${res.req.user?.id} reason=${reason}`);
  return res.status(status).json({ error: REASON_TEXT[reason] || reason, reason, ...extra });
}

function hashCode(userId, code) {
  return crypto.createHash('sha256')
    .update(`${userId}:${code}:${process.env.JWT_SECRET}`)
    .digest('hex');
}

async function loadAccount(id) {
  const { rows } = await query(
    `SELECT id, name, email, role, verification_status, email_verified_at, nid_number
       FROM users WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function latestAttempt(userId) {
  const { rows } = await query(
    `SELECT * FROM identity_verifications WHERE user_id = $1
      ORDER BY created_at DESC, id DESC LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

// Which screen the member should be on. The client never decides this itself.
function stepFor(account, attempt) {
  if (identityVerified(account)) return 'done';
  if (!account.email_verified_at) return 'email';
  if (account.verification_status === 'pending_review') return 'review';
  if (account.verification_status === 'rejected') return 'rejected';
  if (attempt && attempt.decision === 'in_progress') return 'selfie';
  return 'nid';
}

// ---------------------------------------------------------------- learning

// One-way hash of the caller's network address (Vercel puts it first in
// x-forwarded-for). Lets the model notice many new accounts from one network
// without ever storing an address.
function ipHash(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  return crypto.createHash('sha256').update(`${process.env.JWT_SECRET}:${ip}`).digest('hex');
}

// What this member has done, as the model sees it.
async function activityFor(attempt) {
  const { rows } = await query(
    `SELECT
       (SELECT COUNT(*) FROM identity_verifications
         WHERE user_id = $1 AND decision = 'rejected' AND reviewed_by IS NOT NULL
           AND NOT ('nid-taken' = ANY(flags)))::int AS prior_rejections,
       (SELECT COUNT(*) FROM identity_verifications
         WHERE user_id = $1 AND 'nid-taken' = ANY(flags))::int AS nid_taken_attempts,
       (SELECT EXTRACT(EPOCH FROM ($3::timestamptz - created_at)) / 60 FROM users WHERE id = $1) AS minutes_since_signup,
       (SELECT COUNT(DISTINCT user_id) FROM identity_verifications
         WHERE ip_hash = $2 AND user_id <> $1 AND created_at > NOW() - INTERVAL '7 days')::int AS shared_network`,
    [attempt.user_id, attempt.ip_hash, attempt.created_at]
  );
  const r = rows[0];
  return {
    priorRejections: r.prior_rejections,
    nidTakenAttempts: r.nid_taken_attempts,
    minutesSinceSignup: r.minutes_since_signup == null ? null : Number(r.minutes_since_signup),
    sharedNetwork: r.shared_network,
  };
}

// True when the card itself could not be checked (no portrait found and no
// number read): the score then says little, and admins should judge by eye.
function cardUnread(f) {
  return Boolean(f && f.card_face_missing && f.number_unreadable);
}

async function currentModel() {
  const { rows } = await query('SELECT bias, weights FROM risk_models ORDER BY id DESC LIMIT 1');
  return rows[0] ? { bias: rows[0].bias, weights: rows[0].weights } : priorModel();
}

// Re-train on every finished attempt. Admin decisions are the real lessons
// (weight 1); automatic approvals count a quarter, so the model cannot simply
// learn to agree with itself. Called after each admin decision.
async function retrain() {
  const { rows } = await query(
    `SELECT features, decision, reviewed_by FROM identity_verifications
      WHERE features IS NOT NULL AND decision IN ('verified', 'rejected')
      ORDER BY id DESC LIMIT 2000`
  );
  const examples = rows.map((r) => ({ x: r.features, y: r.decision === 'verified' ? 1 : 0, weight: r.reviewed_by ? 1 : 0.25 }));
  const model = train(examples);
  const accuracy = leaveOneOutAccuracy(examples.slice(0, 200));
  await query(
    `INSERT INTO risk_models (bias, weights, examples, admin_decisions, accuracy)
     VALUES ($1, $2, $3, $4, $5)`,
    [model.bias, JSON.stringify(model.weights), examples.length, rows.filter((r) => r.reviewed_by).length, accuracy]
  );
}

// ---------------------------------------------------------------- email

// Create (or replace) the account's code and email it. Also called by signup.
export async function sendVerificationCode(account) {
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await query(
    `INSERT INTO email_codes (user_id, code_hash, expires_at, attempts, last_sent_at)
     VALUES ($1, $2, NOW() + ($3 || ' minutes')::interval, 0, NOW())
     ON CONFLICT (user_id) DO UPDATE
       SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at,
           attempts = 0, last_sent_at = NOW()`,
    [account.id, hashCode(account.id, code), String(CODE_TTL_MINUTES)]
  );
  const mail = codeEmail(account.name, code);
  const result = await sendMail({ to: account.email, ...mail });
  // Dev mode only: hand the code back so the screen can show it.
  return result.dev ? { devCode: code } : {};
}

// An attempt still holding a retired challenge (e.g. "blink") gets a new one.
async function freshChallenge(attempt) {
  if (!attempt || attempt.decision !== 'in_progress' || challengeIsCurrent(attempt.liveness_challenge)) return attempt;
  const challenge = pickChallenge();
  await query('UPDATE identity_verifications SET liveness_challenge = $2, updated_at = NOW() WHERE id = $1', [attempt.id, challenge]);
  return { ...attempt, liveness_challenge: challenge };
}

router.get('/status', async (req, res) => {
  const account = await loadAccount(req.user.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  const attempt = await freshChallenge(await latestAttempt(account.id));
  const step = stepFor(account, attempt);
  res.json({
    step,
    status: account.verification_status,
    email: account.email,
    emailVerified: Boolean(account.email_verified_at),
    mailDevMode: !mailConfigured(),
    challenge: step === 'selfie' ? attempt.liveness_challenge : null,
    lastResult: attempt && ['retry', 'rejected', 'pending_review'].includes(attempt.decision)
      ? {
        decision: attempt.decision,
        reasons: attempt.reasons,
        note: attempt.review_note,
      }
      : null,
  });
});

// A one-time QR link that opens this verification on the member's phone.
router.post('/handoff', async (req, res) => {
  const account = await loadAccount(req.user.id);
  if (identityVerified(account)) {
    return res.status(409).json({ error: 'This account is already verified.' });
  }
  res.status(201).json(await createHandoff(account.id));
});

router.post('/email/send', async (req, res) => {
  const account = await loadAccount(req.user.id);
  if (account.email_verified_at) return res.json({ ok: true, alreadyVerified: true });

  const { rows } = await query(
    `SELECT EXTRACT(EPOCH FROM (NOW() - last_sent_at))::int AS age FROM email_codes WHERE user_id = $1`,
    [account.id]
  );
  if (rows[0] && rows[0].age < RESEND_AFTER_SECONDS) {
    return res.status(429).json({
      error: `Please wait ${RESEND_AFTER_SECONDS - rows[0].age} seconds before asking for another code.`,
      retryAfter: RESEND_AFTER_SECONDS - rows[0].age,
    });
  }
  res.json({ ok: true, ...(await sendVerificationCode(account)) });
});

router.post('/email/confirm', async (req, res) => {
  const code = String(req.body.code || '').replace(/\D/g, '');
  const { rows } = await query(
    `SELECT code_hash, attempts, expires_at < NOW() AS expired FROM email_codes WHERE user_id = $1`,
    [req.user.id]
  );
  const row = rows[0];
  if (!row) return res.status(400).json({ error: 'Ask for a code first.' });
  if (row.expired) return res.status(400).json({ error: 'That code has expired. Ask for a new one.', reason: 'code-expired' });
  if (row.attempts >= CODE_MAX_ATTEMPTS) {
    return res.status(429).json({ error: 'Too many wrong codes. Ask for a new one.', reason: 'code-locked' });
  }
  // Constant-time compare, so response timing cannot leak how close a guess was.
  const ok = code.length === 6 && crypto.timingSafeEqual(
    Buffer.from(hashCode(req.user.id, code)), Buffer.from(row.code_hash)
  );
  if (!ok) {
    await query('UPDATE email_codes SET attempts = attempts + 1 WHERE user_id = $1', [req.user.id]);
    const left = CODE_MAX_ATTEMPTS - row.attempts - 1;
    return res.status(400).json({ error: `That code is not right. ${left} ${left === 1 ? 'try' : 'tries'} left.`, reason: 'code-wrong' });
  }
  await query('UPDATE users SET email_verified_at = NOW() WHERE id = $1', [req.user.id]);
  await query('DELETE FROM email_codes WHERE user_id = $1', [req.user.id]);
  res.json({ ok: true, step: 'nid' });
});

// ---------------------------------------------------------------- photos

// "data:image/jpeg;base64,...." or bare base64 → Buffer (null if not JPEG).
function jpegFrom(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl) return null;
  const buf = Buffer.from(dataUrl.replace(/^data:image\/\w+;base64,/, ''), 'base64');
  return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 ? buf : null;
}

function analyse(dataUrl) {
  const buf = jpegFrom(dataUrl);
  if (!buf) return null;
  try {
    return { buf, ...analysePhoto(buf) };
  } catch {
    return null;
  }
}

async function saveFile(client, ownerId, kind, photo) {
  const { rows } = await client.query(
    `INSERT INTO private_files (owner_id, kind, mime, data, sha256, dhash)
     VALUES ($1, $2, 'image/jpeg', $3, $4, $5) RETURNING id`,
    [ownerId, kind, photo.buf, photo.sha256, photo.dhash == null ? null : photo.dhash.toString()]
  );
  return rows[0].id;
}

// ---------------------------------------------------------------- step 2: NID

router.post('/nid', async (req, res) => {
  const account = await loadAccount(req.user.id);
  if (identityVerified(account)) {
    return res.status(409).json({ error: 'This account is already verified.' });
  }
  if (account.verification_status === 'pending_review') {
    return res.status(409).json({ error: 'Your ID is already being reviewed by an admin.' });
  }
  if (!account.email_verified_at) return res.status(409).json({ error: 'Confirm your email first.' });

  // 1. The number on its own.
  const structure = checkNidStructure(req.body.nid_number);
  if (!structure.ok) return refuse(res, 400, structure.reason);
  const nidName = String(req.body.nid_name || '').trim();
  if (nidName.length < 3) return res.status(400).json({ error: 'Enter your full name exactly as printed on the NID.' });
  const typedDob = /^\d{4}-\d{2}-\d{2}$/.test(req.body.date_of_birth || '') ? req.body.date_of_birth : null;
  if (!typedDob) return res.status(400).json({ error: 'Enter your date of birth as printed on the NID.' });

  // 2. Photos must be readable. A blurry one is NOT turned away — the member
  //    was already warned on their phone — it is flagged for an admin instead.
  const front = analyse(req.body.front);
  const back = analyse(req.body.back);
  if (!front || !back) return refuse(res, 400, 'bad-image');
  const flags = [...structure.flags];
  if (front.sharpness < MIN_SHARPNESS) flags.push('blurry-front');
  if (back.sharpness < MIN_SHARPNESS) flags.push('blurry-back');

  // 2b. Banned identity? Someone who kept a rented item is blacklisted by NID,
  //     so a fresh account with the same card is refused — and suspended.
  const banned = await query('SELECT 1 FROM identity_blacklist WHERE nid_canonical = $1 LIMIT 1', [structure.canonical]);
  if (banned.rows.length) {
    await query(
      `INSERT INTO identity_verifications
         (user_id, decision, nid_number, nid_canonical, nid_name, date_of_birth, flags, reasons)
       VALUES ($1, 'rejected', $2, $3, $4, $5, '{identity-blacklisted}', '{identity-blacklisted}')`,
      [account.id, structure.digits, structure.canonical, nidName, typedDob]
    );
    await query(`UPDATE users SET status = 'suspended', verification_status = 'rejected' WHERE id = $1 AND role = 'member'`, [account.id]);
    return refuse(res, 403, 'identity-blacklisted');
  }

  // 3. Is this NID already someone else's? Free up stale reservations first,
  //    and drop this member's own unfinished attempt (they are starting over).
  await query(
    `UPDATE identity_verifications SET decision = 'retry', updated_at = NOW()
      WHERE decision = 'in_progress'
        AND (user_id = $1 OR updated_at < NOW() - ($2 || ' minutes')::interval)`,
    [account.id, String(STALE_ATTEMPT_MINUTES)]
  );
  const taken = await query(
    `SELECT 1 FROM users WHERE nid_canonical = $1 AND id <> $2
     UNION ALL
     SELECT 1 FROM identity_verifications
      WHERE nid_canonical = $1 AND user_id <> $2
        AND decision IN ('in_progress', 'pending_review', 'verified')
     LIMIT 1`,
    [structure.canonical, account.id]
  );
  if (taken.rows.length) {
    // Logged for admins: someone tried to use an NID that belongs to another account.
    await query(
      `INSERT INTO identity_verifications
         (user_id, decision, nid_number, nid_canonical, nid_name, date_of_birth, flags, reasons)
       VALUES ($1, 'rejected', $2, $3, $4, $5, '{nid-taken}', '{nid-taken}')`,
      [account.id, structure.digits, structure.canonical, nidName, typedDob]
    );
    return refuse(res, 409, 'nid-taken');
  }

  // 4. Find the portrait on the card — it is what the selfie is compared
  //    against. If it cannot be found the member still continues; with no
  //    card face to match, the attempt goes to an admin (see decideVerification).
  //    Phones take tall photos, so the card is often sideways or upside down:
  //    if no portrait is found, try the other three orientations (the likelier
  //    quarter-turns first for a tall photo) and carry on with the upright one.
  //    The upright copy is what gets stored, so admins see it the right way up;
  //    the duplicate check keeps the fingerprint of the file as uploaded.
  let cardFace = await findCardFace(front.rgba);
  if (!cardFace) {
    const tall = front.rgba.height > front.rgba.width;
    for (const turns of tall ? [3, 1, 2] : [2, 1, 3]) {
      const turned = rotateRgba(front.rgba, turns);
      const found = await findCardFace(turned);
      if (found) {
        cardFace = found;
        front.rgba = turned;
        front.buf = encodeJpeg(turned);
        break;
      }
    }
  }
  // The fingerprint stored for the front is of the PORTRAIT, not the whole card.
  front.dhash = cardFace ? regionHash(front.rgba, cardFace.box) : null;

  // 5. Read the printed text and compare it with what was typed. The card's
  //    print is small in a phone photo, so if the first reading does not
  //    confirm everything, read an enlarged, high-contrast copy as well and
  //    keep the best of both (on a real card this recovered a dropped digit).
  const typed = { number: structure.digits, name: nidName, dob: typedDob };
  const texts = [];
  let card = { number: null, name: null, dob: null };
  try {
    texts.push(await readText(front.buf));
    card = extractCardFields(texts[0]);
    if (!readConfirms(card, typed)) {
      texts.push(await readText(cardTextRegion(front.rgba, null, 2)));
      card = mergeCardReads([card, extractCardFields(texts[1])], typed);
    }
  } catch (err) {
    console.error('OCR failed:', err.message);   // unreadable → a human checks it
  }
  const ocrText = texts.join('\n----- enhanced reading -----\n');

  // 6. Has this exact card photo (or a resized copy of its portrait) been used
  //    by someone else?
  const dup = await query(
    `SELECT 1 FROM private_files
      WHERE kind = 'nid_front' AND owner_id <> $1
        AND (sha256 = $2
             OR ($3::bigint IS NOT NULL AND bit_count((dhash # $3::bigint)::bit(64)) <= $4))
      LIMIT 1`,
    [account.id, front.sha256, front.dhash == null ? null : front.dhash.toString(), DHASH_NEAR]
  );
  if (dup.rows.length) flags.push('duplicate-photo');

  const challenge = pickChallenge();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const frontId = await saveFile(client, account.id, 'nid_front', front);
    const backId = await saveFile(client, account.id, 'nid_back', back);
    await client.query(
      `INSERT INTO identity_verifications
         (user_id, nid_number, nid_canonical, nid_name, date_of_birth,
          front_file_id, back_file_id, front_sharpness, back_sharpness,
          ocr_text, ocr_number, ocr_name, ocr_dob, name_score,
          card_descriptor, liveness_challenge, flags, ip_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [account.id, structure.digits, structure.canonical, nidName, typedDob,
        frontId, backId, front.sharpness, back.sharpness,
        ocrText, card.number, card.name, card.dob,
        card.name ? nameSimilarity(card.name, nidName) : null,
        cardFace ? cardFace.descriptor : null, challenge, flags, ipHash(req)]
    );
    await client.query("UPDATE users SET verification_status = 'unverified' WHERE id = $1", [account.id]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    // The partial unique index lost a race: someone else claimed it this instant.
    if (err.code === '23505') return refuse(res, 409, 'nid-taken');
    throw err;
  } finally {
    client.release();
  }

  res.status(201).json({ step: 'selfie', challenge, instructions: challenge.map((a) => ACTION_TEXT[a]) });
});

// ---------------------------------------------------------------- step 3: selfie

router.post('/selfie', async (req, res) => {
  const account = await loadAccount(req.user.id);
  const attempt = await freshChallenge(await latestAttempt(account.id));
  if (!attempt || attempt.decision !== 'in_progress') {
    return res.status(409).json({ error: 'Start with your NID card.', step: stepFor(account, attempt) });
  }
  const frames = req.body.frames || {};
  const needed = ['forward', ...attempt.liveness_challenge];

  // Every captured frame must be a readable photo with exactly one face. The
  // straight-on frame is required; a movement the phone could not capture in
  // time (sent as missing) simply counts as not done — the member gets another
  // movement to try instead of a dead end.
  const seen = {};
  for (const action of needed) {
    if (action !== 'forward' && !frames[action]) continue;
    const photo = analyse(frames[action]);
    if (!photo) return refuse(res, 400, 'bad-image');
    const faces = await findFaces(photo.rgba, 0.5);
    if (!faces.length) return refuse(res, 400, 'no-selfie-face');
    // A second face at least a third the size of the main one is a real person
    // (or a photo being held up), not background noise.
    if (faces.length > 1 && faces[1].area > faces[0].area / 3) return refuse(res, 400, 'multiple-faces');
    seen[action] = { photo, face: faces[0] };
  }

  // Liveness: each frame shows what was asked, and it is the same person in
  // every frame (so frames cannot be stitched together from different people).
  const main = seen.forward.face;
  const missed = needed.find((action) => !seen[action]
    || !frameShows(action, seen[action].face.landmarks, main.landmarks)
    || faceDistance(seen[action].face.descriptor, main.descriptor) >= FACE_SAME_ACROSS_POSES);
  const live = !missed;

  const tries = attempt.liveness_attempts + 1;
  const flags = [...attempt.flags];
  if (seen.forward.photo.sharpness < MIN_SHARPNESS) flags.push('blurry-selfie');
  if (!live) {
    if (tries < MAX_LIVENESS_TRIES) {
      const challenge = pickChallenge();
      await query(
        `UPDATE identity_verifications
            SET liveness_attempts = $2, liveness_challenge = $3, updated_at = NOW()
          WHERE id = $1`,
        [attempt.id, tries, challenge]
      );
      return res.status(422).json({
        error: `We could not confirm "${ACTION_TEXT[missed]}". Follow the on-screen instructions and try again.`,
        reason: 'liveness-failed',
        missed,
        challenge,
        instructions: challenge.map((a) => ACTION_TEXT[a]),
        triesLeft: MAX_LIVENESS_TRIES - tries,
      });
    }
    flags.push('too-many-liveness-tries');
  }

  // Face on the card vs the live face (none if the card portrait was not found).
  const distance = attempt.card_descriptor ? faceDistance(attempt.card_descriptor, main.descriptor) : null;

  // Same face already verified on a different account? Distance computed in SQL
  // by lining the two 128-number arrays up element by element.
  const twin = await query(
    `SELECT u.id, SQRT(SUM((a.v - b.v) ^ 2)) AS d
       FROM users u
       CROSS JOIN LATERAL unnest(u.face_descriptor) WITH ORDINALITY AS a(v, i)
       JOIN unnest($2::real[]) WITH ORDINALITY AS b(v, i) ON a.i = b.i
      WHERE u.id <> $1 AND u.face_descriptor IS NOT NULL
      GROUP BY u.id
     HAVING SQRT(SUM((a.v - b.v) ^ 2)) < $3
      LIMIT 1`,
    [account.id, main.descriptor, FACE_DUPLICATE]
  );
  if (twin.rows.length) flags.push('duplicate-face');

  // A banned face, even behind a different NID card: refused and suspended.
  const bannedFace = await query(
    `SELECT l.id
       FROM identity_blacklist l
       CROSS JOIN LATERAL unnest(l.face_descriptor) WITH ORDINALITY AS a(v, i)
       JOIN unnest($1::real[]) WITH ORDINALITY AS b(v, i) ON a.i = b.i
      WHERE l.face_descriptor IS NOT NULL
      GROUP BY l.id
     HAVING SQRT(SUM((a.v - b.v) ^ 2)) < $2
      LIMIT 1`,
    [main.descriptor, FACE_DUPLICATE]
  );
  if (bannedFace.rows.length) {
    await query(
      `UPDATE identity_verifications SET decision = 'rejected', flags = $2, reasons = '{identity-blacklisted}', updated_at = NOW()
        WHERE id = $1`,
      [attempt.id, [...flags, 'identity-blacklisted']]
    );
    await query(`UPDATE users SET status = 'suspended', verification_status = 'rejected' WHERE id = $1 AND role = 'member'`, [account.id]);
    return refuse(res, 403, 'identity-blacklisted');
  }

  const verdict = decideVerification({
    typedNumber: attempt.nid_number,
    ocrNumber: attempt.ocr_number,
    ocrName: attempt.ocr_name,
    nameScore: attempt.name_score,
    birthYear: attempt.nid_number.length === 17 ? Number(attempt.nid_number.slice(0, 4)) : null,
    typedDob: attempt.date_of_birth,
    ocrDob: attempt.ocr_dob,
    faceDistance: distance,
    livenessPassed: live,
    flags,
  });
  // The learning model's view: how likely is an admin to approve this, given
  // everything admins have decided so far? It can hold back an approval the
  // rules would have given, never grant one the rules refused.
  const features = featureVector({
    ...attempt, face_distance: distance, liveness_passed: live, liveness_attempts: tries,
    flags, reasons: verdict.reasons,
  }, await activityFor(attempt));
  const riskScore = predict(await currentModel(), features);
  const doubted = verdict.decision === 'verified' && riskScore < AUTO_APPROVE_MIN;

  // VERIFY_AUTO_APPROVE=false sends every attempt to an admin, even clean ones.
  const manual = process.env.VERIFY_AUTO_APPROVE === 'false' && verdict.decision === 'verified';
  const decision = manual || doubted ? 'pending_review' : verdict.decision;
  const reasons = manual ? ['manual-review'] : doubted ? ['model-low-confidence'] : verdict.reasons;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const selfieId = await saveFile(client, account.id, 'selfie', seen.forward.photo);
    for (const action of attempt.liveness_challenge) {
      if (seen[action]) await saveFile(client, account.id, 'liveness', seen[action].photo);
    }
    await client.query(
      `UPDATE identity_verifications
          SET decision = $2, selfie_file_id = $3, selfie_sharpness = $4,
              face_distance = $5, selfie_descriptor = $6, liveness_attempts = $7,
              liveness_passed = $8, flags = $9, reasons = $10, updated_at = NOW(),
              risk_score = $11, features = $12
        WHERE id = $1`,
      [attempt.id, decision, selfieId, seen.forward.photo.sharpness, distance,
        main.descriptor, tries, live, flags, reasons, riskScore, JSON.stringify(features)]
    );
    if (decision === 'verified') {
      await approveInto(client, attempt, selfieId, main.descriptor);
    } else {
      await client.query("UPDATE users SET verification_status = 'pending_review' WHERE id = $1", [account.id]);
      await notifyAdmins(client, account);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return refuse(res, 409, 'nid-taken');
    throw err;
  } finally {
    client.release();
  }

  res.json({ decision, step: decision === 'verified' ? 'done' : 'review' });
});

// Make the attempt's identity the account's identity. Used by the automatic
// pass and by an admin's approval, so both write exactly the same thing.
async function approveInto(client, attempt, selfieId, descriptor) {
  await client.query(
    `UPDATE users
        SET verification_status = 'verified',
            nid_number = $2, nid_canonical = $3, nid_name = $4,
            nid_front_url = $5, nid_back_url = $6, nid_submitted_at = NOW(),
            face_descriptor = $7
      WHERE id = $1`,
    [attempt.user_id, attempt.nid_number, attempt.nid_canonical, attempt.nid_name,
      `/api/files/${attempt.front_file_id}`, `/api/files/${attempt.back_file_id}`,
      descriptor]
  );
}

async function notifyAdmins(client, account) {
  await client.query(
    `INSERT INTO notifications (user_id, type, title, body)
     SELECT id, 'verification_review', 'ID check needs review', $1
       FROM users WHERE role = 'admin' AND status = 'active'`,
    [`${account.name} (${account.email}) could not be verified automatically.`]
  );
}

async function notifyMember(account, approved, note) {
  await query(
    `INSERT INTO notifications (user_id, type, title, body) VALUES ($1, $2, $3, $4)`,
    [account.id, approved ? 'verification_approved' : 'verification_rejected',
      approved ? 'Your account is verified' : 'Your ID check was not approved',
      approved ? 'You can now use RentalFlow.' : (note || 'Open RentalFlow to try again.')]
  );
  try {
    await sendMail({ to: account.email, ...decisionEmail(account.name, approved, note) });
  } catch (err) {
    console.error('Decision email failed:', err.message);   // the in-app note still lands
  }
}

// ---------------------------------------------------------------- admin review

const admin = Router();
admin.use(requireRole('admin'));

admin.get('/queue', async (_req, res) => {
  const { rows } = await query(
    `SELECT v.id, v.decision, v.nid_name, v.face_distance, v.flags, v.reasons,
            v.risk_score, v.features, v.created_at, u.id AS user_id, u.name, u.email
       FROM identity_verifications v JOIN users u ON u.id = v.user_id
      WHERE v.decision = 'pending_review'
         OR (v.decision = 'rejected' AND 'nid-taken' = ANY(v.flags) AND v.reviewed_at IS NULL)
      ORDER BY (v.decision = 'pending_review') DESC, v.created_at`
  );
  res.json(rows.map((r) => ({ ...r, reasonText: r.reasons.map((x) => REASON_TEXT[x] || x) })));
});

admin.get('/attempts/:id', async (req, res) => {
  const { rows } = await query(
    `SELECT v.*, u.name, u.email, u.created_at AS member_since
       FROM identity_verifications v JOIN users u ON u.id = v.user_id WHERE v.id = $1`,
    [req.params.id]
  );
  const v = rows[0];
  if (!v) return res.status(404).json({ error: 'Not found' });
  // Who else holds this NID (for the "someone used my NID" case).
  const holder = await query(
    'SELECT id, name, email FROM users WHERE nid_canonical = $1 AND id <> $2',
    [v.nid_canonical, v.user_id]
  );
  const file = (id) => (id ? signFileUrl(`/api/files/${id}`) : null);
  res.json({
    id: v.id,
    decision: v.decision,
    member: { id: v.user_id, name: v.name, email: v.email, since: v.member_since },
    typed: { number: v.nid_number, name: v.nid_name, dob: v.date_of_birth },
    card: { number: v.ocr_number, name: v.ocr_name, dob: v.ocr_dob, nameScore: v.name_score, text: v.ocr_text },
    face: { distance: v.face_distance, match: FACE_MATCH, livenessPassed: v.liveness_passed, tries: v.liveness_attempts },
    sharpness: { front: v.front_sharpness, back: v.back_sharpness, selfie: v.selfie_sharpness, min: MIN_SHARPNESS },
    images: { front: file(v.front_file_id), back: file(v.back_file_id), selfie: file(v.selfie_file_id) },
    flags: v.flags,
    reasons: v.reasons.map((r) => ({ code: r, text: REASON_TEXT[r] || r })),
    nidHeldBy: holder.rows[0] || null,
    risk: v.features
      ? { score: v.risk_score, factors: explain(await currentModel(), v.features, 5), cardUnread: cardUnread(v.features) }
      : null,
    createdAt: v.created_at,
  });
});

admin.post('/attempts/:id/decision', async (req, res) => {
  const approve = req.body.approve === true;
  const note = String(req.body.note || '').trim();

  const { rows } = await query('SELECT * FROM identity_verifications WHERE id = $1', [req.params.id]);
  const attempt = rows[0];
  if (!attempt) return res.status(404).json({ error: 'Not found' });

  // A logged fraud attempt (someone else's NID) is only acknowledged, never approved.
  if (attempt.decision === 'rejected') {
    await query(
      'UPDATE identity_verifications SET reviewed_by = $2, reviewed_at = NOW(), review_note = $3 WHERE id = $1',
      [attempt.id, req.user.id, note || 'Acknowledged']
    );
    return res.json({ ok: true });
  }
  if (attempt.decision !== 'pending_review') return res.status(409).json({ error: 'This attempt was already decided.' });
  if (!approve && !note) return res.status(400).json({ error: 'Give the member a reason for the rejection.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE identity_verifications
          SET decision = $2, reviewed_by = $3, review_note = $4, reviewed_at = NOW(), updated_at = NOW()
        WHERE id = $1`,
      [attempt.id, approve ? 'verified' : 'rejected', req.user.id, note || null]
    );
    if (approve) {
      await approveInto(client, attempt, attempt.selfie_file_id, attempt.selfie_descriptor);
    } else {
      await client.query("UPDATE users SET verification_status = 'rejected' WHERE id = $1", [attempt.user_id]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'This NID is already verified on another account.' });
    }
    throw err;
  } finally {
    client.release();
  }
  const account = await loadAccount(attempt.user_id);
  await notifyMember(account, approve, note);
  // Every decision is a lesson: re-train before answering (on a serverless
  // host, work after the response may never run).
  try {
    await retrain();
  } catch (err) {
    console.error('Model training failed:', err.message);
  }
  res.json({ ok: true });
});

// A member's identity, for admins only: what is on the account and every
// verification attempt with its photos (short-lived signed links).
admin.get('/users/:id', async (req, res) => {
  const { rows } = await query(
    `SELECT id, name, email, role, status, verification_status, created_at,
            nid_number, nid_name, nid_submitted_at
       FROM users WHERE id = $1`,
    [req.params.id]
  );
  const u = rows[0];
  if (!u) return res.status(404).json({ error: 'Not found' });
  const { rows: attempts } = await query(
    `SELECT id, decision, date_of_birth, face_distance, liveness_passed, risk_score, reasons,
            front_file_id, back_file_id, selfie_file_id, reviewed_at, created_at
       FROM identity_verifications WHERE user_id = $1 ORDER BY id DESC`,
    [u.id]
  );
  const file = (id) => (id ? signFileUrl(`/api/files/${id}`) : null);
  const latest = attempts.find((a) => a.decision === 'verified') || attempts[0] || null;
  res.json({
    account: {
      id: u.id, name: u.name, email: u.email, role: u.role, status: u.status,
      verificationStatus: u.verification_status, verified: identityVerified(u), memberSince: u.created_at,
    },
    nid: u.nid_number
      ? { number: u.nid_number, name: u.nid_name, dob: latest?.date_of_birth || null, submittedAt: u.nid_submitted_at }
      : null,
    photos: latest
      ? { front: file(latest.front_file_id), back: file(latest.back_file_id), selfie: file(latest.selfie_file_id) }
      : null,
    attempts: attempts.map((a) => ({
      id: a.id, decision: a.decision, faceDistance: a.face_distance, livenessPassed: a.liveness_passed,
      riskScore: a.risk_score, reasons: a.reasons.map((r) => REASON_TEXT[r] || r),
      reviewedAt: a.reviewed_at, createdAt: a.created_at,
    })),
  });
});

// What the model has learned so far, in plain language.
admin.get('/model', async (_req, res) => {
  const { rows } = await query('SELECT * FROM risk_models ORDER BY id DESC LIMIT 1');
  const m = rows[0];
  const weights = m ? m.weights : PRIOR;
  res.json({
    trained: Boolean(m),
    trainedAt: m?.trained_at || null,
    examples: m?.examples || 0,
    adminDecisions: m?.admin_decisions || 0,
    accuracy: m?.accuracy ?? null,
    autoApproveMin: AUTO_APPROVE_MIN,
    signals: FEATURES.map(([key, label, prior]) => ({
      key, label, prior, weight: weights[key], shift: weights[key] - prior,
    })).sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)),
  });
});

router.use('/admin', admin);

export default router;
