// ============================================================
//  RentalFlow  |  Sprint 4  |  Owner: M4 - Radowanul Haque (Radowan)
//  Part: Unit tests for NID + payment-method rules
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeNid, isValidNid, maskNid, canSubmitNid, hasVerifiedNid,
  isValidPaymentMethod, maskAccountRef, defaultLabel,
  canRemovePaymentMethod, shouldBecomeDefault,
} from './profileUtils.js';

test('a NID is accepted at 10, 13 or 17 digits and nothing else', () => {
  assert.equal(isValidNid('1234567890'), true);
  assert.equal(isValidNid('1234567890123'), true);
  assert.equal(isValidNid('12345678901234567'), true);
  assert.equal(isValidNid('12345'), false);
  assert.equal(isValidNid(''), false);
});

test('separators people type are stripped before validating', () => {
  assert.equal(normalizeNid('1234 5678 90'), '1234567890');
  assert.equal(isValidNid('1234-5678-90'), true);
});

test('a NID is masked down to its last four digits', () => {
  assert.equal(maskNid('1234567890'), '••••••7890');
  assert.equal(maskNid(''), null);
});

test('a NID can be submitted once and then never again', () => {
  const fresh = {};
  const submission = { nid_number: '1234567890', nid_name: 'Rahim Uddin', nid_front_url: '/uploads/a.jpg' };
  assert.deepEqual(canSubmitNid(fresh, submission), { ok: true });

  const already = { nid_number: '9999999999' };
  assert.deepEqual(canSubmitNid(already, submission), { ok: false, reason: 'already-on-file' });
});

test('a NID submission needs a valid number, a name and the front image', () => {
  const base = { nid_number: '1234567890', nid_name: 'Rahim', nid_front_url: '/uploads/a.jpg' };
  assert.equal(canSubmitNid({}, { ...base, nid_number: '123' }).reason, 'invalid-number');
  assert.equal(canSubmitNid({}, { ...base, nid_name: '  ' }).reason, 'missing-name');
  assert.equal(canSubmitNid({}, { ...base, nid_front_url: null }).reason, 'missing-front-image');
});

test('the booking gate only opens for an account with a NID on file', () => {
  assert.equal(hasVerifiedNid({ nid_number: '1234567890' }), true);
  assert.equal(hasVerifiedNid({}), false);
});

test('mobile wallets must be a Bangladeshi 11-digit number', () => {
  assert.equal(isValidPaymentMethod({ kind: 'bKash', account_ref: '01712345678' }).ok, true);
  assert.equal(isValidPaymentMethod({ kind: 'Nagad', account_ref: '0171234567' }).reason, 'invalid-mobile');
  assert.equal(isValidPaymentMethod({ kind: 'Rocket', account_ref: '91712345678' }).reason, 'invalid-mobile');
});

test('cards and bank accounts have their own shape rules', () => {
  assert.equal(isValidPaymentMethod({ kind: 'Card', account_ref: '4111111111111111' }).ok, true);
  assert.equal(isValidPaymentMethod({ kind: 'Card', account_ref: '4111' }).reason, 'invalid-card');
  assert.equal(isValidPaymentMethod({ kind: 'Bank', account_ref: '00112233' }).ok, true);
  assert.equal(isValidPaymentMethod({ kind: 'Crypto', account_ref: 'x' }).reason, 'invalid-kind');
});

test('an account reference is stored masked, never in full', () => {
  assert.equal(maskAccountRef('Card', '4111111111111111'), '**** **** **** 1111');
  assert.equal(maskAccountRef('bKash', '01712345678'), '017****678');
  assert.equal(maskAccountRef('Bank', '00112233'), '****2233');
});

test('a payment method gets a readable default label', () => {
  assert.equal(defaultLabel('bKash', '017****678'), 'bKash · 017****678');
});

test('a payment method can never be removed', () => {
  assert.equal(canRemovePaymentMethod(), false);
});

test('the first active method becomes the default automatically', () => {
  assert.equal(shouldBecomeDefault([]), true);
  assert.equal(shouldBecomeDefault([{ is_active: false }]), true);
  assert.equal(shouldBecomeDefault([{ is_active: true }]), false);
});
