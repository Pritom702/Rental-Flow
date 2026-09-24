// ============================================================
//  RentalFlow  |  Identity verification  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: liveness rules — blink + head turn (shared)
// ============================================================
// Used by BOTH sides:
//   - the phone, to guide the member live ("now turn your head left"),
//   - the server, to re-check the captured frames before trusting them.
// Same file, same thresholds, so the two can never disagree. No imports, so the
// browser bundle can use it as-is.
//
// Input is the 68 face landmarks the face model returns, as [{x, y}, ...]:
//   0–16 jaw line (0 = image-left end, 8 = chin, 16 = image-right end)
//   30   tip of the nose
//   36–41 and 42–47 the two eyes, six points each
//
// Why head movements and not a blink: this face model draws the eye outline
// from the shape of the face, not from the eyelid. Measured on a photo with the
// eyes painted fully shut, its eye-openness score did not change at all — so a
// blink could never be detected reliably. Head pose, on the other hand, it
// tracks accurately, so every challenge is a head movement.

export const ACTIONS = ['left', 'right', 'up'];

// Eye Aspect Ratio: eye height ÷ eye width. About 0.3 with the eye open,
// dropping towards 0.1 when it closes.
export const EYE_CLOSED = 0.2;
export const EYE_OPEN = 0.24;

// Where the nose sits between the two ends of the jaw: 0.5 looking straight
// at the camera, moving towards 0 or 1 as the head turns.
// Both are distances from that 0.5 centre.
export const TURNED = 0.15;       // at least this far = clearly turned
export const FACING = 0.1;        // at most this far = facing forward (the phone asks for 0.06)

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function eyeRatio(p) {
  return (dist(p[1], p[5]) + dist(p[2], p[4])) / (2 * dist(p[0], p[3]));
}

export function eyeAspectRatio(landmarks) {
  const left = landmarks.slice(36, 42);
  const right = landmarks.slice(42, 48);
  return (eyeRatio(left) + eyeRatio(right)) / 2;
}

// Nose position across the face, 0 → 1.
export function noseOffset(landmarks) {
  const a = landmarks[0].x;
  const b = landmarks[16].x;
  return (landmarks[30].x - a) / (b - a);
}

// Which way is the head turned, from the MEMBER'S point of view?
// Frames are analysed un-mirrored — exactly as the camera sees them. When you
// turn to YOUR left, your nose moves towards the camera's right, i.e. the
// image's right, so the offset goes UP.
export function headDirection(landmarks) {
  const off = noseOffset(landmarks) - 0.5;
  if (off >= TURNED) return 'left';
  if (off <= -TURNED) return 'right';
  if (Math.abs(off) <= FACING) return 'forward';
  return 'between';
}

// Where the nose tip sits between the eye line (0) and the chin (1). Tilting
// the head up moves the nose towards the eyes, so this number drops.
export function nosePitch(landmarks) {
  const eyeY = (landmarks[36].y + landmarks[45].y) / 2;
  return (landmarks[30].y - eyeY) / (landmarks[8].y - eyeY);
}

// "Up" is judged against the member's own straight-on frame, not a fixed
// number, because the resting value depends on how the phone is held.
export const TILT_UP = 0.04;

// Does this frame show the requested action? `baseline` is the landmarks of
// the straight-on frame, needed for "up".
export function frameShows(action, landmarks, baseline = null) {
  if (action === 'left' || action === 'right') return headDirection(landmarks) === action;
  if (action === 'up') {
    return Boolean(baseline) && nosePitch(baseline) - nosePitch(landmarks) >= TILT_UP
      && headDirection(landmarks) !== 'left' && headDirection(landmarks) !== 'right';
  }
  if (action === 'forward') return headDirection(landmarks) === 'forward';
  return false;
}

// Two different actions in a random order, chosen by the SERVER, so a
// pre-recorded video cannot know what it will be asked to do.
export function pickChallenge(random = Math.random) {
  const pool = [...ACTIONS];
  const first = pool.splice(Math.floor(random() * pool.length), 1)[0];
  const second = pool[Math.floor(random() * pool.length)];
  return [first, second];
}

// Instruction text shown on the phone for each action.
export const ACTION_TEXT = {
  forward: 'Look straight at the camera',
  left: 'Turn your head to your left',
  right: 'Turn your head to your right',
  up: 'Tilt your head up a little',
  blink: 'Blink slowly',            // retired; kept so old records still read well
};

// A stored challenge made before an action was retired is replaced.
export function challengeIsCurrent(challenge) {
  return Array.isArray(challenge) && challenge.length === 2 && challenge.every((a) => ACTIONS.includes(a));
}
