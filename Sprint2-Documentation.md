# RentalFlow Sprint 2 Documentation

## 1. Purpose

Sprint 2 adds the booking workflow to the inventory system so that items can move from "listed" to "booked" in a controlled way. This phase focuses on:

- availability tracking
- booking creation and updates
- conflict prevention
- deposit and late-fee calculation

The goal is to turn the existing item catalog into a usable rental booking system.

---

## 2. Sprint 1 Review: What is already implemented

The current codebase already contains a strong Sprint 1 foundation.

### Implemented in the current project

| Feature from the project plan | Status | Evidence in codebase |
| --- | --- | --- |
| Item catalog | Implemented | [client/src/pages/ItemForm.jsx](client/src/pages/ItemForm.jsx), [server/src/routes/items.js](server/src/routes/items.js) |
| Item photos | Implemented | [client/src/pages/ItemForm.jsx](client/src/pages/ItemForm.jsx), [server/src/routes/uploads.js](server/src/routes/uploads.js) |
| Categories and tagging | Implemented | [server/src/routes/categories.js](server/src/routes/categories.js), [server/src/routes/items.js](server/src/routes/items.js) |
| Item status tracking | Implemented | [server/src/routes/items.js](server/src/routes/items.js), [client/src/pages/Dashboard.jsx](client/src/pages/Dashboard.jsx) |
| Accessory tracking | Implemented | [server/src/routes/items.js](server/src/routes/items.js), [client/src/pages/ItemForm.jsx](client/src/pages/ItemForm.jsx) |
| Public browse page | Implemented | [client/src/pages/PublicBooking.jsx](client/src/pages/PublicBooking.jsx) |
| Login and auth flow | Implemented | [client/src/auth.jsx](client/src/auth.jsx), [server/src/routes/auth.js](server/src/routes/auth.js) |

### Still missing or incomplete for Sprint 1

| Feature | Status | Notes |
| --- | --- | --- |
| QR/Barcode generation | Not implemented | No QR code generation or scanning logic exists yet. |
| Availability calendar | Not implemented | There is no calendar UI or date-based availability logic. |
| Booking conflict detection | Not implemented | The app does not prevent overlapping bookings. |
| Booking creation/modification | Not implemented | The public page has a button, but no actual booking workflow exists. |
| Deposit calculation | Not implemented | No deposit logic is stored or computed. |
| Late fee calculation | Not implemented | No overdue or rental fee calculation exists. |
| Booking approval/cancel/reschedule | Not implemented | No administrative booking workflow exists. |

### Summary

Sprint 1 is largely implemented for the inventory side. The biggest gap is that the system still behaves like a catalog, not yet a true booking platform.

---

## 3. Sprint 2 Scope

Sprint 2 will add the booking engine and the first operational rental workflow.

### Main features

1. Availability calendar
2. Booking creation
3. Booking conflict prevention
4. Booking updates and cancellation
5. Deposit calculation
6. Late fee calculation

---

## 4. Sprint 2 Feature Design

### 4.1 Availability calendar

The system should show whether an item is available for a selected date range.

#### Expected behavior

- A member or admin opens an item detail or booking page.
- The user selects start and end dates.
- The system checks whether the item already has a booking in that range.
- The UI shows available or unavailable dates.

#### Proposed implementation

- Add a booking calendar view on the frontend.
- Use the backend to query bookings by item and date range.
- Highlight dates that are already occupied.

### 4.2 Booking conflict detection

The key rule is that an item cannot be double-booked.

#### Rule

A new booking should be rejected if its date range overlaps with an existing booking for the same item and status is not cancelled or rejected.

#### Example

If Item A is booked from July 10 to July 15, then a request for July 12 to July 14 should be blocked.

### 4.3 Booking creation

A customer should be able to request a booking from the public or member-facing interface.

#### Workflow

1. User clicks “Request Booking” on a listing.
2. The app opens a booking form.
3. User enters:
   - start date
   - end date
   - customer name
   - customer email
   - notes (optional)
4. The backend validates the dates.
5. The system creates a booking record.
6. The booking status becomes “Pending” or “Approved” depending on the workflow chosen.

### 4.4 Booking modification and cancellation

Owners or staff should be able to manage bookings.

#### Supported actions

- approve booking
- cancel booking
- reschedule booking
- mark booking as completed

### 4.5 Deposit calculation

A refundable deposit should be calculated automatically for each booking.

#### Suggested formula

Deposit = replacement_cost × deposit_rate

Example:

- replacement_cost = $3000
- deposit_rate = 0.2
- deposit = $600

#### Recommended default

- deposit_rate = 20% of replacement cost

### 4.6 Late fee calculation

Late fees should be calculated if a booking is returned after the expected return date.

#### Suggested formula

Late fee = overdue_days × daily_late_fee

Example:

- overdue_days = 2
- daily_late_fee = $15
- late fee = $30

#### Recommended default

- daily_late_fee = 10% of rental_price or a fixed configured value

---

## 5. Proposed Database Changes

Sprint 2 will require a new table to hold booking records.

### Suggested table: bookings

```sql
CREATE TABLE bookings (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  customer_name VARCHAR(120) NOT NULL,
  customer_email VARCHAR(160) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Pending'
    CHECK (status IN ('Pending', 'Approved', 'Cancelled', 'Completed', 'Rejected')),
  deposit_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  late_fee_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Notes

- The booking should reference the existing item record.
- The status field will allow the workflow to move from request to completion.
- Deposit and late fee values should be persisted for reporting.

---

## 6. Backend API Design

### Suggested routes

| Method | Route | Purpose |
| --- | --- | --- |
| GET | /api/bookings | List bookings with optional filters |
| GET | /api/bookings/:id | Get one booking |
| POST | /api/bookings | Create a new booking |
| PUT | /api/bookings/:id | Update booking details |
| PATCH | /api/bookings/:id/status | Change booking status |
| GET | /api/items/:id/bookings | Get all bookings for an item |

### Validation rules

- start date must be before end date
- booking cannot overlap with existing approved bookings
- only authenticated users should create or manage bookings
- item must exist before booking creation

---

## 7. Frontend Design

### New UI components

- Booking form modal/page
- Availability calendar view
- Booking list for dashboard
- Booking status badge
- Booking summary card

### Existing pages to extend

- [client/src/pages/PublicBooking.jsx](client/src/pages/PublicBooking.jsx) for public booking requests
- [client/src/pages/Dashboard.jsx](client/src/pages/Dashboard.jsx) for managing bookings
- [client/src/App.jsx](client/src/App.jsx) for new routes

---

## 8. Example Sprint 2 Workflow

1. A customer opens the public browse page.
2. They select an available item.
3. They choose a date range.
4. The system checks for conflicts.
5. If available, the booking is created with a pending status.
6. The owner or staff approves the booking.
7. The booking remains linked to the item until checkout or completion.
8. When the rental is returned late, the system calculates a late fee.

---

## 9. Acceptance Criteria

Sprint 2 is complete when:

- items can be booked for a date range
- overlapping bookings are blocked
- bookings can be approved, cancelled, or completed
- deposit values are calculated and stored
- late fees are calculated automatically when overdue
- the UI clearly shows booking status and availability

---

## 10. Recommended implementation order

1. Add the bookings table to the database.
2. Create backend booking routes and validation logic.
3. Add conflict detection.
4. Add deposit and late-fee calculation.
5. Build the frontend booking form and calendar UI.
6. Connect the dashboard to booking management.
7. Test the full booking flow end to end.

---

## 11. Expected result after Sprint 2

After Sprint 2, RentalFlow will no longer be just an item catalog. It will become a real rental workflow system where users can:

- browse items
- request bookings
- see availability
- avoid double booking
- manage deposits and late fees

This is the bridge between Sprint 1 inventory management and the more advanced Sprint 3 checkout and document features.
