// ============================================================
//  RentalFlow  |  Sprint 4  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: F17 Customer CRM & rental history API (raw SQL)
// ============================================================
// Customers are not a separate table: the public booking page (F16) captures a
// name + email per booking, so a "customer" is the set of bookings sharing an
// email. This file does that grouping in SQL and layers the CRM scoring on top.
import { Router } from 'express';
import { query } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { normalizeEmail, buildProfile, customerTier, reliabilityLabel } from '../customerUtils.js';
import { overdueDays } from '../bookingUtils.js';

const router = Router();

// Revenue earned from one booking (deposit excluded — it is refundable).
const REVENUE_SQL = `
  ((b.end_date - b.start_date) * i.rental_price) + b.late_fee_amount + b.penalty_amount
`;
// Real customers only: people with a RentalFlow account who booked, and only
// what they actually paid (not requests, not seeded demo bookings).
const PAID_REVENUE_SQL = `CASE WHEN b.paid_at IS NOT NULL AND b.status IN ('Approved', 'Completed') THEN ${REVENUE_SQL} ELSE 0 END`;
const REAL = `b.renter_id IS NOT NULL`;

// Admin and staff run the whole counter. A member's customers are the people
// who booked the member's own listings — never anyone else's.
const isTeam = (user) => user.role === 'admin' || user.role === 'staff';

// GET /api/customers?q= — the CRM list, best customers first.
router.get('/', authRequired, async (req, res) => {
  const params = [];
  let where = `WHERE b.status <> 'Rejected' AND ${REAL}`;
  if (req.query.q) {
    params.push(`%${String(req.query.q).toLowerCase()}%`);
    where += ` AND (LOWER(b.customer_email) LIKE $1 OR LOWER(b.customer_name) LIKE $1)`;
  }
  if (!isTeam(req.user)) {
    params.push(req.user.id);
    where += ` AND i.owner_id = $${params.length}`;
  }
  const { rows } = await query(
    `SELECT LOWER(b.customer_email)                              AS email,
            MAX(b.customer_name)                                 AS name,
            COUNT(*)                                             AS booking_count,
            COALESCE(SUM(${PAID_REVENUE_SQL}), 0)                AS total_spend,
            COALESCE(SUM(b.late_fee_amount), 0)                  AS late_fees,
            COALESCE(SUM(b.penalty_amount), 0)                   AS penalties,
            MIN(b.start_date)                                    AS first_rental,
            MAX(b.start_date)                                    AS last_rental,
            COUNT(*) FILTER (WHERE b.status IN ('Pending','Approved'))  AS active_count,
            COUNT(*) FILTER (WHERE b.status = 'Completed')              AS completed_count,
            COUNT(*) FILTER (WHERE b.status = 'Completed'
                               AND b.late_fee_amount = 0
                               AND b.penalty_amount = 0)               AS clean_count
       FROM bookings b
       JOIN items i ON i.id = b.item_id
       ${where}
      GROUP BY LOWER(b.customer_email)
      ORDER BY total_spend DESC, booking_count DESC`,
    params
  );

  res.json(rows.map((r) => {
    const completed = Number(r.completed_count);
    const reliability = completed ? Math.round((Number(r.clean_count) / completed) * 100) : 100;
    const totalSpend = Number(Number(r.total_spend).toFixed(2));
    const bookingCount = Number(r.booking_count);
    return {
      email: r.email,
      name: r.name,
      bookingCount,
      totalSpend,
      lateFees: Number(Number(r.late_fees).toFixed(2)),
      penalties: Number(Number(r.penalties).toFixed(2)),
      firstRental: r.first_rental,
      lastRental: r.last_rental,
      activeCount: Number(r.active_count),
      completedCount: completed,
      reliability,
      reliabilityLabel: reliabilityLabel(reliability),
      tier: customerTier({ totalSpend, bookingCount }),
    };
  }));
});

// GET /api/customers/summary — headline CRM numbers for the page header.
router.get('/summary', authRequired, async (req, res) => {
  const params = [];
  let scope = '';
  if (!isTeam(req.user)) {
    params.push(req.user.id);
    scope = ` AND b.item_id IN (SELECT id FROM items WHERE owner_id = $1)`;
  }
  const { rows } = await query(
    `SELECT COUNT(DISTINCT LOWER(customer_email)) AS customers,
            COUNT(*)                              AS bookings,
            COUNT(DISTINCT LOWER(customer_email))
              FILTER (WHERE created_at > NOW() - INTERVAL '30 days') AS new_customers
       FROM bookings b WHERE status <> 'Rejected' AND ${REAL}${scope}`,
    params
  );
  const repeat = await query(
    `SELECT COUNT(*) AS repeat_customers FROM (
        SELECT LOWER(customer_email) FROM bookings b
         WHERE status <> 'Rejected' AND ${REAL}${scope}
         GROUP BY LOWER(customer_email) HAVING COUNT(*) > 1
     ) AS repeats`,
    params
  );
  const r = rows[0];
  const customers = Number(r.customers);
  res.json({
    customers,
    bookings: Number(r.bookings),
    newCustomers: Number(r.new_customers),
    repeatCustomers: Number(repeat.rows[0].repeat_customers),
    repeatRate: customers ? Number(((Number(repeat.rows[0].repeat_customers) / customers) * 100).toFixed(1)) : 0,
  });
});

// GET /api/customers/:email — one customer's profile + full rental history (F17).
router.get('/:email', authRequired, async (req, res) => {
  const email = normalizeEmail(req.params.email);
  const params = [email];
  // A member may pull their own statement (everything they rented), or the
  // history of a customer on their own listings only.
  let scope = '';
  if (!isTeam(req.user) && email !== normalizeEmail(req.user.email || '')) {
    params.push(req.user.id);
    scope = ` AND i.owner_id = $2`;
  }
  const { rows } = await query(
    `SELECT b.*, i.name AS item_name, i.rental_price,
            ${PAID_REVENUE_SQL} AS revenue
       FROM bookings b
       JOIN items i ON i.id = b.item_id
      WHERE LOWER(b.customer_email) = $1 AND ${REAL}${scope}
      ORDER BY b.start_date DESC`,
    params
  );
  if (!rows.length) return res.status(404).json({ error: 'Customer not found' });

  const history = rows.map((b) => ({
    ...b,
    revenue: Number(Number(b.revenue).toFixed(2)),
    overdue_days: ['Completed', 'Cancelled', 'Rejected'].includes(b.status) ? 0 : overdueDays(b.end_date),
  }));
  res.json({ profile: buildProfile(history), history });
});

export default router;
