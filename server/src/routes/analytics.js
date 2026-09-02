// ============================================================
//  RentalFlow  |  Sprint 4  |  Owner: M1 - Md. Safinuzzaman (Shafin)
//  GitHub: @shaafin01  |  Part: F19 Revenue & utilization analytics API (raw SQL)
// ============================================================
import { Router } from 'express';
import { query } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { monthlySeries, averageOrderValue, growthPct, fleetUtilization } from '../analyticsUtils.js';

const router = Router();

// Revenue counted per booking, straight in SQL:
//   rental days x daily price  +  late fee  +  damage penalty
// The deposit is a refundable hold, so it is never added to revenue.
const REVENUE_SQL = `
  ((b.end_date - b.start_date) * i.rental_price) + b.late_fee_amount + b.penalty_amount
`;

// Only money that was actually earned: cancelled / rejected requests are excluded.
const EARNING_STATUSES = `b.status IN ('Approved', 'Completed')`;

function windowDates(days) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

// GET /api/analytics/overview?days=30 — headline KPIs + this period vs. last.
router.get('/overview', authRequired, async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 365);
  const { start, end } = windowDates(days);

  const current = await query(
    `SELECT COALESCE(SUM(${REVENUE_SQL}), 0) AS revenue,
            COUNT(*)                          AS bookings,
            COALESCE(SUM(b.deposit_amount), 0) AS deposits_held,
            COALESCE(SUM(b.late_fee_amount), 0) AS late_fees,
            COALESCE(SUM(b.penalty_amount), 0)  AS penalties
       FROM bookings b JOIN items i ON i.id = b.item_id
      WHERE ${EARNING_STATUSES} AND b.start_date >= $1 AND b.start_date <= $2`,
    [start, end]
  );

  const previousStart = new Date(new Date(start).getTime() - days * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);
  const previous = await query(
    `SELECT COALESCE(SUM(${REVENUE_SQL}), 0) AS revenue
       FROM bookings b JOIN items i ON i.id = b.item_id
      WHERE ${EARNING_STATUSES} AND b.start_date >= $1 AND b.start_date < $2`,
    [previousStart, start]
  );

  // Fleet-wide utilization: booked days across every item vs. days available.
  const fleet = await query(
    `SELECT b.start_date, b.end_date FROM bookings b
      WHERE ${EARNING_STATUSES} AND b.end_date >= $1 AND b.start_date <= $2`,
    [start, end]
  );
  const itemCount = await query(`SELECT COUNT(*) AS count FROM items WHERE status != 'Retired'`);
  const totalItems = Number(itemCount.rows[0].count) || 0;
  const utilization = fleetUtilization(fleet.rows, start, end, totalItems);

  const row = current.rows[0];
  const revenue = Number(row.revenue);
  const bookings = Number(row.bookings);

  res.json({
    windowDays: days,
    from: start,
    to: end,
    revenue: Number(revenue.toFixed(2)),
    bookings,
    averageOrderValue: averageOrderValue(revenue, bookings),
    growthPct: growthPct(revenue, Number(previous.rows[0].revenue)),
    depositsHeld: Number(Number(row.deposits_held).toFixed(2)),
    lateFees: Number(Number(row.late_fees).toFixed(2)),
    penalties: Number(Number(row.penalties).toFixed(2)),
    fleetUtilization: utilization,
    totalItems,
  });
});

// GET /api/analytics/revenue-trend?months=6 — monthly revenue for the bar chart.
router.get('/revenue-trend', authRequired, async (req, res) => {
  const months = Math.min(Math.max(Number(req.query.months) || 6, 3), 12);
  const { rows } = await query(
    `SELECT TO_CHAR(b.start_date, 'YYYY-MM') AS month,
            COALESCE(SUM(${REVENUE_SQL}), 0) AS revenue
       FROM bookings b JOIN items i ON i.id = b.item_id
      WHERE ${EARNING_STATUSES}
      GROUP BY month
      ORDER BY month`
  );
  res.json(monthlySeries(rows, months));
});

// GET /api/analytics/top-items — best earning items, with their utilization.
router.get('/top-items', authRequired, async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 90, 7), 365);
  const { start, end } = windowDates(days);
  const { rows } = await query(
    `SELECT i.id, i.name, i.status, c.name AS category,
            COUNT(b.id)                                      AS bookings,
            COALESCE(SUM(${REVENUE_SQL}), 0)                 AS revenue,
            COALESCE(SUM(b.end_date - b.start_date), 0)      AS rented_days
       FROM items i
       LEFT JOIN bookings b
              ON b.item_id = i.id AND ${EARNING_STATUSES}
             AND b.end_date >= $1 AND b.start_date <= $2
       LEFT JOIN categories c ON c.id = i.category_id
      GROUP BY i.id, i.name, i.status, c.name
      ORDER BY revenue DESC, bookings DESC
      LIMIT 10`,
    [start, end]
  );
  const windowDays = days;
  res.json(rows.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    category: r.category || 'Uncategorized',
    bookings: Number(r.bookings),
    revenue: Number(Number(r.revenue).toFixed(2)),
    rentedDays: Number(r.rented_days),
    utilization: Number(Math.min(100, (Number(r.rented_days) / windowDays) * 100).toFixed(1)),
  })));
});

// GET /api/analytics/by-category — revenue split used by the donut chart.
router.get('/by-category', authRequired, async (_req, res) => {
  const { rows } = await query(
    `SELECT COALESCE(c.name, 'Uncategorized') AS label,
            COALESCE(SUM(${REVENUE_SQL}), 0)  AS value
       FROM bookings b
       JOIN items i ON i.id = b.item_id
       LEFT JOIN categories c ON c.id = i.category_id
      WHERE ${EARNING_STATUSES}
      GROUP BY label
      HAVING COALESCE(SUM(${REVENUE_SQL}), 0) > 0
      ORDER BY value DESC
      LIMIT 6`
  );
  res.json(rows.map((r) => ({ label: r.label, value: Number(Number(r.value).toFixed(2)) })));
});

// GET /api/analytics/inventory — how the fleet is split across statuses.
router.get('/inventory', authRequired, async (_req, res) => {
  const { rows } = await query(
    `SELECT status AS label, COUNT(*) AS value FROM items GROUP BY status ORDER BY value DESC`
  );
  res.json(rows.map((r) => ({ label: r.label, value: Number(r.value) })));
});

export default router;
