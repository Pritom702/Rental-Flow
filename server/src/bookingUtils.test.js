import test from 'node:test';
import assert from 'node:assert/strict';
import { severityPct, calculatePenalty, buildBill } from './bookingUtils.js';

test('severityPct maps conditions', () => {
  assert.equal(severityPct('New'), 0);
  assert.equal(severityPct('Good'), 0);
  assert.equal(severityPct('Fair'), 0.05);
  assert.equal(severityPct('Poor'), 0.15);
  assert.equal(severityPct('Damaged'), 0.30);
  assert.equal(severityPct('unknown'), 0);
});

test('calculatePenalty sums severity, repair, missing and caps at replacement', () => {
  // Damaged: 0.30*200=60 + repair 20 + missing 10 = 90
  assert.equal(calculatePenalty({ conditionStatus: 'Damaged', replacementCost: 200, repairCost: 20, missingCharge: 10 }), 90);
  // cap at replacement cost
  assert.equal(calculatePenalty({ conditionStatus: 'Damaged', replacementCost: 100, repairCost: 500, missingCharge: 0 }), 100);
  // good condition, no repair -> 0
  assert.equal(calculatePenalty({ conditionStatus: 'Good', replacementCost: 200, repairCost: 0, missingCharge: 0 }), 0);
});

test('buildBill reconciles deposit against charges', () => {
  // 3 days * 12 = 36 rental; deposit 36; lateFee 6; penalty 40 -> charges 46
  const bill = buildBill({ rentalPrice: 12, startDate: '2026-09-10', endDate: '2026-09-13', depositAmount: 36, lateFee: 6, penalty: 40 });
  assert.equal(bill.rentalDays, 3);
  assert.equal(bill.rentalSubtotal, 36);
  assert.equal(bill.charges, 46);
  assert.equal(bill.depositRefund, 0);
  assert.equal(bill.balanceDue, 10);
  // charges under deposit -> refund, no balance
  const bill2 = buildBill({ rentalPrice: 12, startDate: '2026-09-10', endDate: '2026-09-13', depositAmount: 36, lateFee: 0, penalty: 5 });
  assert.equal(bill2.depositRefund, 31);
  assert.equal(bill2.balanceDue, 0);
});
