// ============================================================
//  RentalFlow  |  Sprint 1  |  Owner: M3 - Promit Ghosh Turjo (Promit)
//  GitHub: @___  |  Part: Demo data seeding
// ============================================================
// Seeds demo data so the Sprint 1 demo video has something to show.
// Usage: npm run db:seed  (run AFTER npm run db:init)
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { pool, query } from './db.js';

async function main() {
  // --- Users: one admin + two members (a marketplace has many peers) ---
  const adminHash = bcrypt.hashSync('admin123', 10);
  const rahimHash = bcrypt.hashSync('member123', 10);
  const karimHash = bcrypt.hashSync('member123', 10);

  await query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1,$2,$3,'admin'), ($4,$5,$6,'member'), ($7,$8,$9,'member')
     ON CONFLICT (email) DO NOTHING`,
    [
      'Platform Admin', 'admin@rentalflow.test', adminHash,
      'Rahim Uddin', 'rahim@rentalflow.test', rahimHash,
      'Karim Hasan', 'karim@rentalflow.test', karimHash,
    ]
  );

  const { rows: userRows } = await query('SELECT id, email FROM users');
  const userId = (email) => userRows.find((u) => u.email === email)?.id ?? null;
  const rahim = userId('rahim@rentalflow.test');
  const karim = userId('karim@rentalflow.test');

  // --- Categories (broad marketplace coverage) ---
  const cats = [
    'Cameras', 'Lenses', 'Tripods & Supports', 'Lighting', 'Audio & Microphones',
    'Drones', 'Power Tools', 'Hand Tools', 'Gardening Equipment', 'Event & Party',
    'Camping & Outdoor', 'Sports & Fitness', 'Musical Instruments',
    'Projectors & Screens', 'Computers & Laptops', 'Gaming & Consoles',
    'Kitchen Appliances', 'Furniture',
  ];
  for (const c of cats) {
    await query('INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [c]);
  }

  // --- Tags ---
  const tags = ['camera', 'lens', 'tripod', 'power tool', 'event', 'accessory'];
  for (const t of tags) {
    await query('INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [t]);
  }

  const { rows: catRows } = await query('SELECT id, name FROM categories');
  const catId = (name) => catRows.find((r) => r.name === name)?.id ?? null;

  // --- Items (listed by different members) ---
  // [owner, name, desc, serial, price, replacement, category, status]
  // Amounts are Bangladeshi Taka — day rates and replacement values priced for
  // the Dhaka rental market rather than converted from another currency.
  const items = [
    [rahim, 'Canon EOS R6', 'Full-frame mirrorless camera body', 'CAM-0001', 5500.0, 320000.0, 'Cameras', 'Available'],
    [rahim, 'Canon RF 24-70mm', 'Standard zoom lens', 'LEN-0001', 2500.0, 225000.0, 'Lenses', 'Available'],
    [rahim, 'Manfrotto Tripod', 'Aluminium video tripod', 'TRP-0001', 900.0, 30000.0, 'Tripods & Supports', 'Under Maintenance'],
    [karim, 'Sony A7 III', 'Full-frame mirrorless camera', 'CAM-0002', 4800.0, 250000.0, 'Cameras', 'Rented'],
    [karim, 'DeWalt Drill', 'Cordless hammer drill', 'PWR-0001', 1400.0, 22000.0, 'Power Tools', 'Available'],
    [karim, 'Bounce Castle', 'Large inflatable event castle', 'EVT-0001', 14000.0, 350000.0, 'Event & Party', 'Damaged'],
  ];

  for (const [owner, name, desc, serial, price, repl, cat, status] of items) {
    const { rows } = await query(
      `INSERT INTO items (owner_id, name, description, serial_number, rental_price, replacement_cost, category_id, status, qr_token)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (serial_number) DO NOTHING
       RETURNING id`,
      [owner, name, desc, serial, price, repl, catId(cat), status, randomUUID()]
    );
    if (rows[0]) {
      await query(
        `INSERT INTO item_tags (item_id, tag_id)
         SELECT $1, id FROM tags WHERE name = $2
         ON CONFLICT DO NOTHING`,
        [rows[0].id, cat.toLowerCase()]
      );
    }
  }

  // --- Accessories for Rahim's Canon camera (Feature 5) ---
  const { rows: canon } = await query("SELECT id FROM items WHERE serial_number = 'CAM-0001'");
  if (canon[0]) {
    for (const acc of ['Battery LP-E6', 'Charger', '64GB SD Card']) {
      await query('INSERT INTO accessories (parent_item_id, name) VALUES ($1, $2)', [canon[0].id, acc]);
    }
  }

  console.log('✅ Seed complete.');
  console.log('   Admin  : admin@rentalflow.test / admin123');
  console.log('   Member : rahim@rentalflow.test / member123');
  console.log('   Member : karim@rentalflow.test / member123');
  await pool.end();
}

main().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
