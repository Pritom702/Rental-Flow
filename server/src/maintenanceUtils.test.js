// ============================================================
//  RentalFlow  |  Sprint 4  |  Owner: M4 - Radowanul Haque (Radowan)
//  Part: F18 unit tests (node --test)
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { isBlocking, jobCost, nextItemStatus, downtimeDays, summarizeJobs } from './maintenanceUtils.js';

test('open and in-progress jobs block the item, closed ones do not', () => {
  assert.equal(isBlocking('Open'), true);
  assert.equal(isBlocking('In Progress'), true);
  assert.equal(isBlocking('Completed'), false);
  assert.equal(isBlocking('Cancelled'), false);
});

test('job cost adds parts and labour', () => {
  assert.equal(jobCost({ parts_cost: 40.5, labour_cost: 9.5 }), 50);
  assert.equal(jobCost({}), 0);
});

test('item goes Under Maintenance while a job is open', () => {
  assert.equal(nextItemStatus([{ status: 'Open' }], 'Available'), 'Under Maintenance');
  assert.equal(nextItemStatus([{ status: 'In Progress' }], 'Damaged'), 'Under Maintenance');
});

test('item is released once every job is closed', () => {
  assert.equal(nextItemStatus([{ status: 'Completed' }], 'Under Maintenance'), 'Available');
  assert.equal(nextItemStatus([], 'Damaged'), 'Available');
});

test('a rented item keeps its Rented status when jobs close', () => {
  assert.equal(nextItemStatus([{ status: 'Completed' }], 'Rented'), 'Rented');
});

test('downtime counts calendar days, and open jobs count up to now', () => {
  const job = { reported_at: '2026-03-01T00:00:00Z', completed_at: '2026-03-04T00:00:00Z' };
  assert.equal(downtimeDays(job), 3);
  const stillOpen = { reported_at: '2026-03-01T00:00:00Z', completed_at: null };
  assert.equal(downtimeDays(stillOpen, new Date('2026-03-06T00:00:00Z')), 5);
  assert.equal(downtimeDays({}), 0);
});

test('summary rolls up counts, cost and downtime', () => {
  const asOf = new Date('2026-03-10T00:00:00Z');
  const jobs = [
    { status: 'Completed', parts_cost: 100, labour_cost: 50, reported_at: '2026-03-01T00:00:00Z', completed_at: '2026-03-03T00:00:00Z' },
    { status: 'Open', parts_cost: 20, labour_cost: 30, reported_at: '2026-03-08T00:00:00Z', completed_at: null },
  ];
  const s = summarizeJobs(jobs, asOf);
  assert.equal(s.jobCount, 2);
  assert.equal(s.openCount, 1);
  assert.equal(s.completedCount, 1);
  assert.equal(s.totalCost, 200);
  assert.equal(s.averageCost, 100);
  assert.equal(s.totalDowntimeDays, 4);
});
