// ============================================================
//  RentalFlow  |  Sprint 4  |  Owner: M1 - Md. Safinuzzaman (Shafin)
//  GitHub: @shaafin01  |  Part: F19 unit tests (node --test)
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  daysBetween, bookingRevenue, utilizationRate, monthlySeries, averageOrderValue, growthPct,
  fleetUtilization, totalBookedDays,
} from './analyticsUtils.js';

test('daysBetween counts whole rental days', () => {
  assert.equal(daysBetween('2026-03-01', '2026-03-05'), 4);
  assert.equal(daysBetween('2026-03-05', '2026-03-01'), 0);
});

test('booking revenue = rental days x price, plus late fee and penalty', () => {
  const booking = {
    start_date: '2026-03-01', end_date: '2026-03-04',
    rental_price: 50, late_fee_amount: 5, penalty_amount: 20,
  };
  assert.equal(bookingRevenue(booking), 175);
});

test('the refundable deposit is not counted as revenue', () => {
  const booking = { start_date: '2026-03-01', end_date: '2026-03-02', rental_price: 100, deposit_amount: 500 };
  assert.equal(bookingRevenue(booking), 100);
});

test('utilization is the share of the window the item was on rental', () => {
  const bookings = [{ start_date: '2026-03-01', end_date: '2026-03-16' }];
  assert.equal(utilizationRate(bookings, '2026-03-01', '2026-03-31'), 50);
});

test('utilization clips bookings that spill outside the window', () => {
  const bookings = [{ start_date: '2026-02-20', end_date: '2026-04-10' }];
  assert.equal(utilizationRate(bookings, '2026-03-01', '2026-03-31'), 100);
  assert.equal(utilizationRate([], '2026-03-01', '2026-03-31'), 0);
});

test('fleet utilization spreads booked days over the whole fleet', () => {
  const bookings = [
    { start_date: '2026-03-01', end_date: '2026-03-11' },   // 10 days
    { start_date: '2026-03-01', end_date: '2026-03-06' },   // 5 days
  ];
  assert.equal(totalBookedDays(bookings, '2026-03-01', '2026-03-31'), 15);
  // 15 booked days over 30 days x 5 items = 10%
  assert.equal(fleetUtilization(bookings, '2026-03-01', '2026-03-31', 5), 10);
  assert.equal(fleetUtilization(bookings, '2026-03-01', '2026-03-31', 0), 0);
});

test('monthly series fills quiet months with zero', () => {
  const series = monthlySeries([{ month: '2026-03', revenue: 900 }], 3, new Date('2026-04-15T00:00:00Z'));
  assert.deepEqual(series.map((s) => s.month), ['2026-02', '2026-03', '2026-04']);
  assert.deepEqual(series.map((s) => s.revenue), [0, 900, 0]);
});

test('average order value and growth percentage', () => {
  assert.equal(averageOrderValue(1000, 4), 250);
  assert.equal(averageOrderValue(1000, 0), 0);
  assert.equal(growthPct(150, 100), 50);
  assert.equal(growthPct(50, 100), -50);
  assert.equal(growthPct(10, 0), 100);
  assert.equal(growthPct(0, 0), 0);
});
