// ============================================================
//  RentalFlow  |  Sprint 1  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: Schema runner (npm run db:init)
// ============================================================
// Runs schema.sql against the database to create all tables.
// Usage: npm run db:init
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('✅ Schema created (tables: users, categories, tags, items, item_tags, item_images, accessories)');

  // Sprint 4 adds its own file so the sprint-by-sprint schema history stays readable.
  const sprint4 = fs.readFileSync(path.join(__dirname, 'schema_sprint4.sql'), 'utf8');
  await pool.query(sprint4);
  console.log('✅ Sprint 4 schema created (maintenance_logs, audit_logs, staff accounts)');

  // In-app notifications for the booking flow (owner <-> customer).
  const notifications = fs.readFileSync(path.join(__dirname, 'schema_notifications.sql'), 'utf8');
  await pool.query(notifications);
  console.log('✅ Notifications table created');

  // NID verification for damage control + permanent payment methods.
  const profile = fs.readFileSync(path.join(__dirname, 'schema_profile.sql'), 'utf8');
  await pool.query(profile);
  console.log('✅ Profile schema created (NID columns, payment_methods)');
  await pool.end();
}

main().catch((err) => {
  console.error('❌ Failed to init DB:', err.message);
  process.exit(1);
});
