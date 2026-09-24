// ============================================================
//  RentalFlow  |  Identity verification  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: unit tests — NID rules, card reading, decision
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DISTRICT_CODES, looksMadeUp, checkNidStructure, canonicalNid,
  nameSimilarity, parseCardDate, extractCardFields, decideVerification, mergeCardReads, readConfirms,
} from './nidUtils.js';

const NOW = new Date('2026-09-23');

test('there are exactly 64 district codes', () => {
  assert.equal(DISTRICT_CODES.size, 64);
});

test('made-up numbers are recognised', () => {
  for (const n of ['1111111111', '1234567890', '9876543210', '1212121212', '0000000000000']) {
    assert.equal(looksMadeUp(n), true, n);
  }
  assert.equal(looksMadeUp('4617289035'), false);
});

test('a real-looking 10-digit smart card number passes', () => {
  const r = checkNidStructure('461 728 9035', NOW);
  assert.equal(r.ok, true);
  assert.equal(r.canonical, '4617289035');
  assert.deepEqual(r.flags, []);
});

test('wrong length and made-up patterns are refused', () => {
  assert.equal(checkNidStructure('12345', NOW).reason, 'nid-length');
  assert.equal(checkNidStructure('1234567890', NOW).reason, 'nid-pattern');
});

test('a 17-digit NID must start with a plausible adult birth year', () => {
  assert.equal(checkNidStructure('19902612345678901', NOW).ok, true);
  assert.equal(checkNidStructure('18502612345678901', NOW).reason, 'nid-birth-year');
  // born 2015: only 11 years old in 2026
  assert.equal(checkNidStructure('20152612345678901', NOW).reason, 'nid-birth-year');
});

test('an unknown district code is flagged for a human, not refused', () => {
  const r = checkNidStructure('0212345678901', NOW);   // 02 is not a district
  assert.equal(r.ok, true);
  assert.deepEqual(r.flags, ['nid-district-unknown']);
  assert.deepEqual(checkNidStructure('2612345678901', NOW).flags, []);   // 26 = Dhaka
});

test('the 17-digit form and the 13-digit form of one card collide', () => {
  assert.equal(canonicalNid('19902612345678901'), canonicalNid('2612345678901'));
  assert.equal(canonicalNid('4617289035'), '4617289035');
});

test('name similarity tolerates OCR slips but not a different name', () => {
  assert.ok(nameSimilarity('MD. RAHIM UDDIN', 'Md Rahim Uddin') > 0.99);
  assert.ok(nameSimilarity('MD RAHlM UDDIN', 'MD RAHIM UDDIN') >= 0.8);
  assert.ok(nameSimilarity('KARIM HOSSAIN', 'MD RAHIM UDDIN') < 0.8);
  assert.equal(nameSimilarity('', 'X'), 0);
});

test('card dates are read the way the card prints them', () => {
  assert.equal(parseCardDate('Date of Birth: 26 Feb 1990'), '1990-02-26');
  assert.equal(parseCardDate('05 SEPT 2001'), '2001-09-05');
  assert.equal(parseCardDate('nothing here'), null);
});

test('fields are pulled out of smart-card OCR text', () => {
  const text = [
    'Government of the People\'s Republic of Bangladesh',
    'National ID Card',
    'Name: MD RAHIM UDDIN',
    'Date of Birth: 26 Feb 1990',
    'ID NO: 461 728 9O35',          // OCR read a zero as the letter O
  ].join('\n');
  assert.deepEqual(extractCardFields(text), {
    number: '4617289035', name: 'MD RAHIM UDDIN', dob: '1990-02-26',
  });
});

test('the name may sit on the line after its label', () => {
  const r = extractCardFields('Name\nKARIM HOSSAIN\nNID No 2612345678901');
  assert.equal(r.name, 'KARIM HOSSAIN');
  assert.equal(r.number, '2612345678901');
});

test('junk read from the card photo in front of a label is ignored', () => {
  const text = 'ge \\ Name: SHELDON LEE COOPER\n| 4 % Date of Birth: 26 Feb 1990\na (1D NO: 461728 9035';
  assert.deepEqual(extractCardFields(text), {
    number: '4617289035', name: 'SHELDON LEE COOPER', dob: '1990-02-26',
  });
});

test("a father's or mother's name is never taken as the holder's", () => {
  assert.equal(extractCardFields("Father's Name: ABDUL KARIM\nName: RAHIM UDDIN").name, 'RAHIM UDDIN');
});

test('border lines read as "|" after the number do not become extra digits', () => {
  assert.equal(extractCardFields('ID NO: 4617289035 |').number, '4617289035');
  assert.equal(extractCardFields('ID NO: 461 728 9O35 :').number, '4617289035');
});

test('unreadable text gives nulls, never a guess', () => {
  assert.deepEqual(extractCardFields('#### blurry ####'), { number: null, name: null, dob: null });
});

const PASSING = {
  typedNumber: '4617289035', ocrNumber: '4617289035',
  ocrName: 'MD RAHIM UDDIN', nameScore: 1,
  typedDob: '1990-02-26', ocrDob: '1990-02-26',
  faceDistance: 0.35, livenessPassed: true, flags: [],
};

test('everything matching verifies automatically', () => {
  assert.deepEqual(decideVerification(PASSING), { decision: 'verified', reasons: [] });
});

test('any doubt sends the attempt to an admin, with the reason', () => {
  const cases = [
    [{ ocrNumber: null }, 'card-number-unreadable'],
    [{ ocrNumber: '4617289036' }, 'card-number-mismatch'],
    [{ nameScore: 0.5 }, 'card-name-mismatch'],
    [{ ocrDob: '1991-02-26' }, 'dob-mismatch'],
    [{ faceDistance: 0.55 }, 'face-unsure'],
    [{ faceDistance: 0.75 }, 'face-mismatch'],
    [{ faceDistance: null }, 'card-face-missing'],
    [{ livenessPassed: false }, 'liveness-failed'],
    [{ flags: ['duplicate-face'] }, 'duplicate-face'],
  ];
  for (const [change, reason] of cases) {
    const r = decideVerification({ ...PASSING, ...change });
    assert.equal(r.decision, 'pending_review', reason);
    assert.ok(r.reasons.includes(reason), `${reason} in ${r.reasons}`);
  }
});

test('a 17-digit NID whose birth year disagrees with the card is flagged', () => {
  const r = decideVerification({
    ...PASSING, typedNumber: '19902612345678901', ocrNumber: '19902612345678901',
    birthYear: 1990, typedDob: null, ocrDob: '1985-02-26',
  });
  assert.ok(r.reasons.includes('birth-year-mismatch'));
});

test('merging two card readings keeps the fields that match what was typed', () => {
  const typed = { number: '4617289035', name: 'MD RAHIM UDDIN', dob: '1990-02-26' };
  const first = { number: null, name: 'MD RAHIM UDDIN', dob: null };               // dropped a digit, lost the year
  const second = { number: '4617289035', name: 'MD RAHlM UDD1N', dob: '1990-02-26' };
  assert.deepEqual(mergeCardReads([first, second], typed), typed);
  assert.equal(readConfirms(first, typed), false);
  assert.equal(readConfirms(second, typed), true);
});

test('when no reading matches, the first real reading is kept for the admin', () => {
  const typed = { number: '4617289035', name: 'MD RAHIM UDDIN', dob: '1990-02-26' };
  const r = mergeCardReads([{ number: '7382045561', name: null, dob: null }, null], typed);
  assert.equal(r.number, '7382045561');
  assert.equal(r.name, null);
});
