// ============================================================
//  RentalFlow  |  Sprint 4  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: Notification rule unit tests (node --test)
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  eventForStatus, buildNotification, recipientSide, canDecide,
} from './notificationUtils.js';

const BOOKING = {
  item_id: 5, item_name: 'DeWalt Drill', owner_id: 2,
  customer_name: 'abcd', customer_email: 'abcd.test@test.com',
  start_date: '2026-09-09', end_date: '2026-09-10', deposit_amount: 36,
};

test('only meaningful status changes raise an event', () => {
  assert.equal(eventForStatus('Approved'), 'booking_approved');
  assert.equal(eventForStatus('Rejected'), 'booking_rejected');
  assert.equal(eventForStatus('Cancelled'), 'booking_cancelled');
  assert.equal(eventForStatus('Completed'), 'booking_completed');
  assert.equal(eventForStatus('Pending'), null);
});

test('the request notification tells the owner who wants what', () => {
  const n = buildNotification('booking_requested', BOOKING);
  assert.match(n.title, /New booking request for DeWalt Drill/);
  assert.match(n.body, /abcd requested/);
  assert.match(n.body, /2026-09-09 to 2026-09-10/);
});

test('the approval notification names the item and the held deposit', () => {
  const n = buildNotification('booking_approved', BOOKING);
  assert.match(n.title, /was approved/);
  assert.match(n.body, /\$36\.00/);
});

test('an unknown event type builds nothing', () => {
  assert.equal(buildNotification('something_else', BOOKING), null);
});

test('the side that did not act is the side that gets told', () => {
  const owner = { id: 2, email: 'rahim@rentalflow.test', role: 'member' };
  const customer = { id: 9, email: 'abcd.test@test.com', role: 'member' };
  assert.equal(recipientSide(owner, BOOKING), 'customer');
  assert.equal(recipientSide(customer, BOOKING), 'owner');
});

test('only the item owner, an admin or staff can approve', () => {
  assert.equal(canDecide({ id: 2, role: 'member' }, BOOKING, 'Approved'), true);
  assert.equal(canDecide({ id: 1, role: 'admin' }, BOOKING, 'Approved'), true);
  assert.equal(canDecide({ id: 4, role: 'staff' }, BOOKING, 'Approved'), true);
  assert.equal(canDecide({ id: 7, role: 'member' }, BOOKING, 'Approved'), false);
  assert.equal(canDecide({}, BOOKING, 'Approved'), false);
});

test('a customer may cancel their own booking but not approve it', () => {
  const customer = { id: 9, role: 'member', email: 'abcd.test@test.com' };
  assert.equal(canDecide(customer, BOOKING, 'Cancelled'), true);
  assert.equal(canDecide(customer, BOOKING, 'Approved'), false);
});
