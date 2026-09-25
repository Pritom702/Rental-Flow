import test from 'node:test';
import assert from 'node:assert/strict';
import {
  trustTier, depositFor, validPhone, checkGuarantor, dueAt, escalationStage, hoursLate,
  settle, isUnpaid, renterBlocks, handoverCode, GUARANTOR_FROM,
} from './protectionUtils.js';

test('trust grows with clean returns and late returns hold it back', () => {
  assert.equal(trustTier({}).level, 0);
  assert.equal(trustTier({ cleanReturns: 1 }).level, 0);
  assert.equal(trustTier({ cleanReturns: 2 }).level, 1);
  assert.equal(trustTier({ cleanReturns: 5 }).level, 2);
  assert.equal(trustTier({ cleanReturns: 5, lateReturns: 1 }).level, 1);
  assert.equal(trustTier({ cleanReturns: 0, lateReturns: 3 }).score, 0);
  assert.equal(trustTier({ cleanReturns: 1 }).toNext, 1);
  assert.equal(trustTier({ cleanReturns: 9 }).nextName, null);
});

test('deposit: new renters leave half, top renters a fifth', () => {
  assert.deepEqual(depositFor({ replacementCost: 20000, tier: trustTier({}) }), { rate: 0.5, amount: 10000, overCap: false, unverified: false, needsGuarantor: false });
  assert.equal(depositFor({ replacementCost: 20000, tier: trustTier({ cleanReturns: 6 }) }).amount, 4000);
});

test('renting above your level needs the full value as deposit', () => {
  const d = depositFor({ replacementCost: 380000, tier: trustTier({}) });
  assert.equal(d.overCap, true);
  assert.equal(d.rate, 1);
  assert.equal(d.amount, 380000);
  // a top renter has no cap
  assert.equal(depositFor({ replacementCost: 380000, tier: trustTier({ cleanReturns: 5 }) }).overCap, false);
});

test('a renter who has not verified their ID leaves the full value', () => {
  const d = depositFor({ replacementCost: 20000, tier: trustTier({ cleanReturns: 6 }), verified: false });
  assert.equal(d.rate, 1);
  assert.equal(d.amount, 20000);
  assert.equal(d.unverified, true);
  assert.equal(depositFor({ replacementCost: 200000, tier: trustTier({}), verified: false }).needsGuarantor, false);
});

test('valuable items need a guarantor unless the renter is a top renter', () => {
  assert.equal(depositFor({ replacementCost: GUARANTOR_FROM, tier: trustTier({ cleanReturns: 2 }) }).needsGuarantor, true);
  assert.equal(depositFor({ replacementCost: GUARANTOR_FROM - 1, tier: trustTier({}) }).needsGuarantor, false);
  assert.equal(depositFor({ replacementCost: 200000, tier: trustTier({ cleanReturns: 5 }) }).needsGuarantor, false);
});

test('guarantor details are checked', () => {
  assert.equal(validPhone('01712345678'), true);
  assert.equal(validPhone('+8801712345678'), true);
  assert.equal(validPhone('0171-234-5678'), true);
  assert.equal(validPhone('01212345678'), false);
  assert.equal(validPhone('12345'), false);
  assert.equal(checkGuarantor({ name: 'Abdul Karim', phone: '01812345678', relation: 'father' }), null);
  assert.match(checkGuarantor({ name: 'A', phone: '01812345678', relation: 'father' }), /name/);
  assert.match(checkGuarantor({ name: 'Abdul Karim', phone: '999', relation: 'father' }), /mobile/);
  assert.match(checkGuarantor({ name: 'Abdul Karim', phone: '01812345678', relation: '' }), /knows you/);
});

test('an item is due at the end of its last day, Bangladesh time', () => {
  assert.equal(dueAt('2026-09-20').toISOString(), '2026-09-20T17:59:59.000Z');
});

test('escalation stages follow the hours past due', () => {
  const due = dueAt('2026-09-20').getTime();
  const at = (h) => new Date(due + h * 3600000);
  assert.equal(escalationStage('2026-09-20', at(-30)), 0);
  assert.equal(escalationStage('2026-09-20', at(-6)), 1);
  assert.equal(escalationStage('2026-09-20', at(1)), 2);
  assert.equal(escalationStage('2026-09-20', at(25)), 3);
  assert.equal(escalationStage('2026-09-20', at(49)), 4);
  assert.equal(escalationStage('2026-09-20', at(73)), 5);
  assert.equal(hoursLate('2026-09-20', at(-5)), 0);
  assert.equal(hoursLate('2026-09-20', at(50.5)), 50);
});

test('charges come out of the deposit first', () => {
  assert.deepEqual(settle({ charges: 3000, deposit: 10000 }), { charges: 3000, depositApplied: 3000, balance: 0, refund: 7000 });
  assert.deepEqual(settle({ charges: 15000, deposit: 10000 }), { charges: 15000, depositApplied: 10000, balance: 5000, refund: 0 });
  assert.deepEqual(settle({ charges: 0, deposit: 500 }), { charges: 0, depositApplied: 0, balance: 0, refund: 500 });
});

test('unpaid balances and pending claims block new rentals', () => {
  assert.equal(isUnpaid({ status: 'accepted', balance: 100 }), true);
  assert.equal(isUnpaid({ status: 'accepted', balance: 100, paid_at: '2026-01-01' }), false);
  assert.equal(isUnpaid({ status: 'resolved', balance: 0 }), false);
  assert.equal(isUnpaid({ status: 'disputed', balance: 100 }), false);
  assert.deepEqual(renterBlocks({ claims: [{ status: 'accepted', balance: 50 }] }), ['unpaid-balance']);
  assert.deepEqual(renterBlocks({ claims: [{ status: 'open', balance: 50 }] }), ['claim-pending']);
  assert.deepEqual(renterBlocks({ claims: [{ status: 'open', balance: 0 }] }), []);
  assert.deepEqual(renterBlocks({}), []);
});

test('a rental two days overdue, or reported missing, blocks new rentals', () => {
  const now = new Date(dueAt('2026-09-20').getTime() + 49 * 3600000);
  assert.deepEqual(renterBlocks({ activeRentals: [{ status: 'Approved', end_date: '2026-09-20' }], now }), ['overdue-return']);
  assert.deepEqual(renterBlocks({ activeRentals: [{ status: 'Approved', end_date: '2026-09-22' }], now }), []);
  assert.deepEqual(renterBlocks({ activeRentals: [{ status: 'Missing', end_date: '2026-09-20' }], now }), ['missing-item']);
});

test('hand-over codes are six digits', () => {
  assert.equal(handoverCode(() => 0), '000000');
  assert.equal(handoverCode(() => 0.123456), '123456');
  assert.match(handoverCode(), /^\d{6}$/);
});
