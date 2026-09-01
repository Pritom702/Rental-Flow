// ============================================================
//  RentalFlow  |  Sprint 4  |  Owner: M3 - Promit Ghosh Turjo (Promit)
//  Part: F15 unit tests (node --test)
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  agreementNumber, statementNumber, formatMoney, statementTotals, availableDocuments,
} from './documentUtils.js';

test('agreement numbers embed the booking id and the issue date', () => {
  assert.equal(agreementNumber(12, new Date('2026-04-09T10:00:00Z')), 'RF-12-20260409');
});

test('statement numbers are per customer and per month', () => {
  assert.equal(statementNumber('rahim@rentalflow.test', new Date('2026-04-09T10:00:00Z')), 'RF-ST-RAHIM-202604');
  assert.equal(statementNumber('', new Date('2026-04-09T10:00:00Z')), 'RF-ST-GUEST-202604');
});

test('money is always printed with two decimals', () => {
  assert.equal(formatMoney(12.5), '$12.50');
  assert.equal(formatMoney(null), '$0.00');
});

test('statement totals split rental, late fees and penalties', () => {
  const history = [
    { status: 'Completed', revenue: 220, late_fee_amount: 20, penalty_amount: 0, deposit_amount: 100 },
    { status: 'Approved',  revenue: 150, late_fee_amount: 0,  penalty_amount: 0, deposit_amount: 60 },
    { status: 'Cancelled', revenue: 999, late_fee_amount: 0,  penalty_amount: 0, deposit_amount: 0 },
  ];
  const totals = statementTotals(history);
  assert.equal(totals.rentalCount, 2);
  assert.equal(totals.rentals, 350);
  assert.equal(totals.lateFees, 20);
  assert.equal(totals.penalties, 0);
  assert.equal(totals.depositsHeld, 60);
  assert.equal(totals.total, 370);
});

test('documents unlock as the booking progresses', () => {
  assert.deepEqual(availableDocuments({ status: 'Pending' }), []);
  assert.deepEqual(availableDocuments({ status: 'Approved' }), ['agreement']);
  assert.deepEqual(
    availableDocuments({ status: 'Completed', checked_in_at: '2026-04-01T09:00:00Z' }),
    ['agreement', 'return-summary']
  );
});
