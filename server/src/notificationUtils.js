// ============================================================
//  RentalFlow  |  Sprint 4  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: Notification wording + routing rules (pure, unit tested)
// ============================================================
// Keeping the "who gets told what" rules in pure functions means the booking
// routes stay readable and the rules can be unit tested without a database.

export const NOTIFICATION_TYPES = [
  'booking_requested', 'booking_approved', 'booking_rejected',
  'booking_cancelled', 'booking_completed',
];

// A booking status maps to the event the other side should hear about.
// Statuses with no entry (e.g. back to Pending) raise no notification.
const STATUS_EVENT = {
  Approved:  'booking_approved',
  Rejected:  'booking_rejected',
  Cancelled: 'booking_cancelled',
  Completed: 'booking_completed',
};

export function eventForStatus(status) {
  return STATUS_EVENT[status] || null;
}

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

// The title + body stored on the row. Written once here so the bell, the list
// and any future email all read the same sentence.
export function buildNotification(type, booking = {}) {
  const item = booking.item_name || `item #${booking.item_id}`;
  const dates = `${booking.start_date} to ${booking.end_date}`;
  switch (type) {
    case 'booking_requested':
      return {
        title: `New booking request for ${item}`,
        body: `${booking.customer_name || 'A customer'} requested ${item} for ${dates}. `
            + `Approve or reject it from the Bookings page.`,
      };
    case 'booking_approved':
      return {
        title: `Your booking for ${item} was approved`,
        body: `${item} is reserved for you from ${dates}. `
            + `A deposit of ${money(booking.deposit_amount)} is held until the item is returned.`,
      };
    case 'booking_rejected':
      return {
        title: `Your booking for ${item} was rejected`,
        body: `The owner could not accept ${item} for ${dates}. No deposit was charged.`,
      };
    case 'booking_cancelled':
      return {
        title: `Booking for ${item} was cancelled`,
        body: `The booking for ${dates} is no longer active.`,
      };
    case 'booking_completed':
      return {
        title: `Rental of ${item} is complete`,
        body: `${item} was returned and the rental for ${dates} is now closed.`,
      };
    default:
      return null;
  }
}

// Who hears about a status change: always the side that did NOT make it.
// The owner (or an admin/staff member acting for them) approves and rejects, so
// the customer is told; a customer cancelling their own booking tells the owner.
export function recipientSide(actor = {}, booking = {}) {
  const actorEmail = String(actor.email || '').toLowerCase();
  const customerEmail = String(booking.customer_email || '').toLowerCase();
  if (actorEmail && actorEmail === customerEmail) return 'owner';
  return 'customer';
}

// Can this account decide on this booking?
//   - the member who owns the item can
//   - an admin or a staff member can (they operate the counter)
//   - the customer can only cancel their own booking
export function canDecide(actor = {}, booking = {}, nextStatus = null) {
  if (!actor || !actor.id) return false;
  if (actor.role === 'admin' || actor.role === 'staff') return true;
  if (booking.owner_id && Number(booking.owner_id) === Number(actor.id)) return true;
  const actorEmail = String(actor.email || '').toLowerCase();
  const customerEmail = String(booking.customer_email || '').toLowerCase();
  if (actorEmail && actorEmail === customerEmail && nextStatus === 'Cancelled') return true;
  return false;
}
