// ============================================================
//  RentalFlow  |  Sprint 4  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: F17 unit tests (node --test)
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeEmail, customerTier, reliabilityScore, reliabilityLabel, buildProfile,
} from './customerUtils.js';

test('emails are normalized so one person is one customer', () => {
  assert.equal(normalizeEmail('  Rahim@Example.COM '), 'rahim@example.com');
  assert.equal(normalizeEmail(null), '');
});

test('tier rises with spend or with rental count (thresholds are in Taka)', () => {
  assert.equal(customerTier({ totalSpend: 0, bookingCount: 1 }), 'New');
  assert.equal(customerTier({ totalSpend: 30000, bookingCount: 1 }), 'Regular');
  assert.equal(customerTier({ totalSpend: 0, bookingCount: 4 }), 'Regular');
  assert.equal(customerTier({ totalSpend: 120000, bookingCount: 2 }), 'VIP');
  assert.equal(customerTier({ totalSpend: 10, bookingCount: 9 }), 'VIP');
});

test('a small Taka amount is not enough to be a VIP', () => {
  // Guards the currency migration: these thresholds were written for dollars,
  // where ৳1,000 of spend would wrongly have qualified as VIP.
  assert.equal(customerTier({ totalSpend: 1000, bookingCount: 1 }), 'New');
  assert.equal(customerTier({ totalSpend: 350, bookingCount: 1 }), 'New');
});

test('reliability only counts finished rentals', () => {
  const bookings = [
    { status: 'Completed', late_fee_amount: 0, penalty_amount: 0 },
    { status: 'Completed', late_fee_amount: 12, penalty_amount: 0 },
    { status: 'Pending', late_fee_amount: 0, penalty_amount: 0 },
  ];
  assert.equal(reliabilityScore(bookings), 50);
  assert.equal(reliabilityScore([]), 100);
  assert.equal(reliabilityScore([{ status: 'Approved' }]), 100);
});

test('reliability labels', () => {
  assert.equal(reliabilityLabel(100), 'Excellent');
  assert.equal(reliabilityLabel(75), 'Good');
  assert.equal(reliabilityLabel(60), 'Watch');
  assert.equal(reliabilityLabel(20), 'At risk');
});

test('profile collapses a customer history into one CRM row', () => {
  const bookings = [
    // Amounts are Taka, at the scale the platform actually charges.
    { customer_name: 'Rahim U.', customer_email: 'Rahim@Example.com', start_date: '2026-01-05',
      status: 'Completed', revenue: 20000, late_fee_amount: 1500, penalty_amount: 0 },
    { customer_name: 'Rahim Uddin', customer_email: 'rahim@example.com', start_date: '2026-03-11',
      status: 'Approved', revenue: 15000, late_fee_amount: 0, penalty_amount: 0 },
  ];
  const profile = buildProfile(bookings);
  assert.equal(profile.name, 'Rahim Uddin');
  assert.equal(profile.email, 'rahim@example.com');
  assert.equal(profile.bookingCount, 2);
  // revenue already carries the late fee — it must not be added on top again
  assert.equal(profile.totalSpend, 35000);
  assert.equal(profile.firstRental, '2026-01-05');
  assert.equal(profile.lastRental, '2026-03-11');
  assert.equal(profile.activeCount, 1);
  assert.equal(profile.tier, 'Regular');
  assert.equal(profile.reliability, 0);
});
