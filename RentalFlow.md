# RentalFlow - Inventory & Booking for Equipment Renters

## Team Members

| Name               | ID       | Github User Name |
| ------------------ | -------- | ---------------- |
| Md. Safinuzzaman   | 22301419 | shaafin01        |
| Tawheed Bin Hamid  | 22301476 | pritom702        |
| Promit Ghosh Turjo | 22301425 | Promitturja      |
| Radowanul Haque    | 24101686 |                  |

---

## Project Overview

RentalFlow is an inventory and booking management system for businesses that rent physical equipment, such as camera gear shops, tool libraries, event equipment providers, and bouncy castle rental businesses.
It helps owners track item availability, prevent double booking, record product condition, handle check-out/check-in, and calculate deposits, late fees, damage penalties, and revenue analytics.

---

## Market Value

Many equipment rental businesses struggle to know which item is available, who currently has it, whether it was returned late, and whether it came back damaged.RentalFlow solves these problems by combining:

- Inventory tracking
- Booking conflict control
- QR-based checkout
- Condition reporting
- Damage control
- Financial reporting

---

## User Roles

- **Admin/Owner**: manages inventory, staff, customers, reports, and rental policies.
- **Staff**: handles item check-out, check-in, condition reports, damage records, and customer bookings.
- **Customer**: views available rental items, creates booking requests, and receives rental documents.

---

## Functional Features

### Member 1: Core Inventory

1. **Item catalog** – create/manage item profiles with photos, descriptions, serial numbers, rental price, replacement cost.
2. **Categorization and tagging** – group items by category and searchable tags.
3. **Item status tracking** – statuses: Available, Rented, Damaged, Under Maintenance, Retired.
4. **Barcode/QR code generation** – unique code for each item for scanning.
5. **Accessory tracking** – link accessories with main items (e.g., camera + lens + charger).

### Member 2: Booking Logic

6. **Availability calendar** – calendar view of item availability.
7. **Booking conflict detection** – prevents double booking.
8. **Booking creation/modification** – create, update, approve, cancel, reschedule bookings.
9. **Damage deposit calculation** – refundable deposit based on item value, duration, risk.
10. **Late fee calculation** – calculates late fees based on rental policy.

### Member 3: Documents and Checkout

11. **Digital rental agreement** – generates agreement with customer details, items, terms.
12. **QR-based check-out/check-in** – scan QR codes to update rental status.
13. **Condition report form** – record item condition before rental.
14. **Damage control & penalty management** – compare return condition, calculate penalties.
15. **PDF contract export** – export agreements and summaries as PDF.

### Member 4: Admin and Customers

16. **Public booking page** – customers browse items, check availability, submit requests.
17. **Customer CRM & rental history** – store customer profiles, rental history, payments.
18. **Maintenance & repair logging** – record repair notes, costs, dates.
19. **Revenue & utilization analytics** – reports on revenue, item performance, penalties.
20. **Staff accounts & audit logs** – manage staff accounts, track actions.

---

## Suggested Sprint Plan

| Sprint   | Duration        | Main Work                                                                            |
| -------- | --------------- | ------------------------------------------------------------------------------------ |
| Sprint 1 | July 20, 2026   | Project setup, DB design, item catalog, categories, item status, basic pages         |
| Sprint 2 | July 30, 2026   | Availability calendar, booking workflow, conflict detection, deposits, late fees     |
| Sprint 3 | August 13, 2026 | QR checkout/check-in, condition report, damage control, agreements, PDF export       |
| Sprint 4 | August 26, 2026 | Maintenance logs, customer history, analytics, audit logs, testing, bug fixing, demo |

---

## Proposed Technology Stack

- **Frontend**: React.js
- **Backend**: Node.js with Express.js
- **Database**: PostgreSQL or MySQL (raw SQL queries)
- **QR Code**: `qrcode` library or browser QR scanner
- **PDF Export**: PDFKit or jsPDF
- **Charts/Analytics**: Chart.js or Recharts
