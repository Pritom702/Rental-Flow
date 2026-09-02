// ============================================================
//  RentalFlow  |  Sprint 4  |  Owner: M4 - Radowanul Haque (Radowan)
//  Part: Sprint-4 demo data (rental history, repair jobs, staff account)
// ============================================================
// The Sprint-1 seed only creates users and items. Analytics (F19), the customer
// CRM (F17) and the maintenance log (F18) all need history to show anything, so
// this script back-fills six months of realistic rentals plus a few repair jobs.
//
// Usage:  npm run db:seed   (first)   then   npm run db:seed4
import bcrypt from 'bcryptjs';
import { pool, query } from './db.js';

// Dates are generated relative to today so the demo always shows a live period.
const today = new Date();
const dayString = (offsetDays) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

async function main() {
  // --- A staff account for F20 (admin can suspend / promote it) -------------
  await query(
    `INSERT INTO users (name, email, password_hash, role, status)
     VALUES ($1,$2,$3,'staff','active')
     ON CONFLICT (email) DO NOTHING`,
    ['Nadia Rahman', 'staff@rentalflow.test', bcrypt.hashSync('staff123', 10)]
  );

  const { rows: itemRows } = await query('SELECT id, serial_number, rental_price, replacement_cost FROM items');
  const item = (serial) => itemRows.find((i) => i.serial_number === serial);
  if (!itemRows.length) {
    console.error('❌ No items found — run `npm run db:seed` first.');
    process.exit(1);
  }

  // --- Rental history -------------------------------------------------------
  // [serial, customer, email, startOffset, endOffset, status, lateFee, penalty]
  const bookings = [
    ['CAM-0001', 'Rahim Uddin',   'rahim.customer@mail.test',  -170, -164, 'Completed', 0, 0],
    ['LEN-0001', 'Rahim Uddin',   'rahim.customer@mail.test',  -150, -145, 'Completed', 0, 0],
    ['CAM-0002', 'Sadia Islam',   'sadia@mail.test',           -140, -133, 'Completed', 8, 0],
    ['PWR-0001', 'Imran Chowdhury', 'imran@mail.test',         -120, -117, 'Completed', 0, 0],
    ['CAM-0001', 'Sadia Islam',   'sadia@mail.test',           -110, -101, 'Completed', 0, 0],
    ['EVT-0001', 'Tanvir Alam',   'tanvir@mail.test',           -95,  -92, 'Completed', 0, 450],
    ['TRP-0001', 'Imran Chowdhury', 'imran@mail.test',          -80,  -76, 'Completed', 0, 0],
    ['CAM-0002', 'Rahim Uddin',   'rahim.customer@mail.test',   -70,  -63, 'Completed', 0, 0],
    ['LEN-0001', 'Nusrat Jahan',  'nusrat@mail.test',           -55,  -50, 'Completed', 4, 0],
    ['CAM-0001', 'Rahim Uddin',   'rahim.customer@mail.test',   -40,  -33, 'Completed', 0, 0],
    ['PWR-0001', 'Tanvir Alam',   'tanvir@mail.test',           -28,  -25, 'Completed', 0, 0],
    ['CAM-0002', 'Sadia Islam',   'sadia@mail.test',            -20,  -14, 'Completed', 0, 60],
    ['CAM-0001', 'Nusrat Jahan',  'nusrat@mail.test',           -12,   -6, 'Completed', 0, 0],
    ['LEN-0001', 'Sadia Islam',   'sadia@mail.test',             -3,   +4, 'Approved',  0, 0],
    ['PWR-0001', 'Nusrat Jahan',  'nusrat@mail.test',            +2,   +6, 'Pending',   0, 0],
    ['CAM-0002', 'Imran Chowdhury', 'imran@mail.test',           +5,  +12, 'Pending',   0, 0],
    ['EVT-0001', 'Tanvir Alam',   'tanvir@mail.test',           -60,  -58, 'Cancelled', 0, 0],
  ];

  let inserted = 0;
  for (const [serial, name, email, from, to, status, lateFee, penalty] of bookings) {
    const target = item(serial);
    if (!target) continue;
    const deposit = Number((Number(target.replacement_cost) * 0.2).toFixed(2));
    const checkedOut = status === 'Completed' ? `${dayString(from)} 10:00` : null;
    const checkedIn = status === 'Completed' ? `${dayString(to)} 17:30` : null;
    const { rows } = await query(
      `INSERT INTO bookings
         (item_id, customer_name, customer_email, start_date, end_date, status,
          deposit_amount, late_fee_amount, penalty_amount, notes,
          checked_out_at, checked_in_at, agreement_number, agreement_generated_at, created_at)
       SELECT $1::int, $2::varchar, $3::varchar, $4::date, $5::date, $6::varchar,
              $7::numeric, $8::numeric, $9::numeric, $10::text,
              $11::timestamp, $12::timestamp, $13::text, $14::timestamp, $15::timestamp
        WHERE NOT EXISTS (
          SELECT 1 FROM bookings
           WHERE item_id = $1::int AND start_date = $4::date AND customer_email = $3::varchar
        )
       RETURNING id`,
      [target.id, name, email, dayString(from), dayString(to), status,
       deposit, lateFee, penalty, null, checkedOut, checkedIn,
       null, null, `${dayString(from)} 09:00`]
    );
    if (!rows[0]) continue;
    inserted += 1;
    // Give completed rentals their agreement number, the way the API would.
    if (status === 'Completed' || status === 'Approved') {
      await query(
        `UPDATE bookings SET agreement_number = $2, agreement_generated_at = created_at WHERE id = $1`,
        [rows[0].id, `RF-${rows[0].id}-${dayString(from).replace(/-/g, '')}`]
      );
    }
    // A completed rental has a condition report at both ends (F13).
    if (status === 'Completed') {
      const returnCondition = penalty > 0 ? 'Damaged' : 'Good';
      await query(
        `INSERT INTO condition_reports (booking_id, phase, condition_status, notes, repair_cost, created_at)
         VALUES ($1,'checkout','Good','Handed over in working order',0,$2),
                ($1,'checkin',$3,$4,$5,$6)
         ON CONFLICT (booking_id, phase) DO NOTHING`,
        [rows[0].id, `${dayString(from)} 10:00`, returnCondition,
         penalty > 0 ? 'Returned with visible damage' : 'Returned in the same condition',
         penalty > 0 ? Number((penalty / 2).toFixed(2)) : 0, `${dayString(to)} 17:30`]
      );
    }
  }

  // --- Maintenance & repair log (F18) --------------------------------------
  // [serial, type, priority, status, description, technician, parts, labour, reportedOffset, completedOffset]
  const jobs = [
    ['TRP-0001', 'Repair', 'Normal', 'Open', 'Centre column slips under load — needs a new locking collar', 'Arif', 35, 20, -6, null],
    ['EVT-0001', 'Repair', 'High', 'In Progress', 'Seam tear on the left wall after the last event rental', 'Shuvo', 180, 120, -3, null],
    ['CAM-0002', 'Service', 'Normal', 'Completed', 'Sensor clean and firmware update after 8 rentals', 'Arif', 0, 45, -22, -20],
    ['PWR-0001', 'Inspection', 'Low', 'Completed', 'Safety inspection and chuck lubrication', 'Nadia', 5, 15, -35, -34],
    ['CAM-0001', 'Cleaning', 'Low', 'Completed', 'Body clean and lens contact service', 'Shuvo', 0, 25, -50, -49],
  ];

  const { rows: adminRows } = await query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  const reporter = adminRows[0]?.id || null;

  let jobCount = 0;
  for (const [serial, type, priority, status, description, tech, parts, labour, from, to] of jobs) {
    const target = item(serial);
    if (!target) continue;
    const { rows } = await query(
      `INSERT INTO maintenance_logs
         (item_id, job_type, priority, status, description, technician, parts_cost, labour_cost,
          reported_by, reported_at, completed_at)
       SELECT $1::int, $2::varchar, $3::varchar, $4::varchar, $5::text, $6::varchar,
              $7::numeric, $8::numeric, $9::int, $10::timestamp, $11::timestamp
        WHERE NOT EXISTS (
          SELECT 1 FROM maintenance_logs WHERE item_id = $1::int AND description = $5::text
        )
       RETURNING id`,
      [target.id, type, priority, status, description, tech, parts, labour, reporter,
       `${dayString(from)} 09:00`, to === null ? null : `${dayString(to)} 16:00`]
    );
    if (rows[0]) jobCount += 1;
  }

  // Items with an open job are held out of the rental pool.
  await query(
    `UPDATE items SET status = 'Under Maintenance'
      WHERE id IN (SELECT item_id FROM maintenance_logs WHERE status IN ('Open','In Progress'))
        AND status <> 'Rented'`
  );

  // --- A little audit history so the admin console is not empty -------------
  await query(
    `INSERT INTO audit_logs (user_id, user_email, action, entity, entity_id, path, status_code, summary, created_at)
     SELECT $1::int, 'admin@rentalflow.test', 'PATCH', 'bookings', b.id::text,
            '/api/bookings/' || b.id || '/status', 200, 'status -> Completed', b.checked_in_at
       FROM bookings b
      WHERE b.status = 'Completed'
        AND NOT EXISTS (SELECT 1 FROM audit_logs a WHERE a.entity = 'bookings' AND a.entity_id = b.id::text)`,
    [reporter]
  );

  console.log(`✅ Sprint 4 demo data ready — ${inserted} bookings, ${jobCount} repair jobs.`);
  console.log('   Staff : staff@rentalflow.test / staff123');
  await pool.end();
}

main().catch((err) => {
  console.error('❌ Sprint 4 seed failed:', err.message);
  process.exit(1);
});
