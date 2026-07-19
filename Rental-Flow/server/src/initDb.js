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
  await pool.end();
}

main().catch((err) => {
  console.error('❌ Failed to init DB:', err.message);
  process.exit(1);
});
