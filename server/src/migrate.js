// ============================================================
//  RentalFlow  |  Identity verification  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: upgrade an existing database WITHOUT wiping it
// ============================================================
// Usage: npm run db:migrate
//
// `db:init` rebuilds every table from scratch — it DROPS them first, so all
// users, items and bookings are lost. This script only applies the additive
// schema files (ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS ...), so it
// is safe on a database that already holds real data, including the hosted one.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADDITIVE = ['schema_profile.sql', 'schema_verification.sql', 'schema_images.sql', 'schema_messages.sql', 'schema_categories.sql', 'schema_protection.sql', 'schema_social.sql', 'schema_market.sql'];
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml' };

async function main() {
  for (const file of ADDITIVE) {
    await pool.query(fs.readFileSync(path.join(__dirname, file), 'utf8'));
    console.log(`✅ ${file} applied`);
  }

  // Copy photos that only exist on this machine's disk into the database, so
  // they also show up on the hosted site. Already-copied ones are skipped.
  let copied = 0;
  const files = fs.existsSync(UPLOAD_DIR) ? fs.readdirSync(UPLOAD_DIR) : [];
  for (const name of files) {
    const mime = MIME[path.extname(name).toLowerCase()];
    if (!mime) continue;
    const { rowCount } = await pool.query(
      'INSERT INTO public_images (name, mime, data) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING',
      [name, mime, fs.readFileSync(path.join(UPLOAD_DIR, name))]
    );
    copied += rowCount;
  }
  console.log(`✅ ${copied} photo(s) copied from uploads/ into the database`);
  await pool.end();
}

main().catch((err) => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
