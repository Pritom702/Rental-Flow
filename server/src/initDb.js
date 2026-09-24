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

  // Identity verification: email codes, NID + face checks, admin review queue.
  const verification = fs.readFileSync(path.join(__dirname, 'schema_verification.sql'), 'utf8');
  await pool.query(verification);
  console.log('✅ Verification schema created (email codes, private files, identity checks)');

  // Product photos kept in the database, so they survive on a serverless host.
  const images = fs.readFileSync(path.join(__dirname, 'schema_images.sql'), 'utf8');
  await pool.query(images);
  console.log('✅ Image storage created (public_images)');

  // Renter <-> lister chat.
  const messages = fs.readFileSync(path.join(__dirname, 'schema_messages.sql'), 'utf8');
  await pool.query(messages);
  console.log('✅ Messaging created (conversations, messages)');

  // Categories added after the first release.
  await pool.query(fs.readFileSync(path.join(__dirname, 'schema_categories.sql'), 'utf8'));

  // Rental protection: claims, incidents, identity blacklist (a fresh start drops them too).
  await pool.query('DROP TABLE IF EXISTS damage_claims, incidents, identity_blacklist, system_state CASCADE');
  await pool.query(fs.readFileSync(path.join(__dirname, 'schema_protection.sql'), 'utf8'));
  console.log('✅ Rental protection created (claims, incidents, blacklist)');

  // Community: communities, posts, comments, reactions, moments, rewards.
  await pool.query(`DROP TABLE IF EXISTS communities, community_members, posts, post_reactions, post_saves,
    poll_votes, comments, comment_likes, content_reports, stories, story_views, follows, user_stats CASCADE`);
  await pool.query(fs.readFileSync(path.join(__dirname, 'schema_social.sql'), 'utf8'));
  console.log('✅ Community created (posts, comments, moments, rewards)');
  await pool.end();
}

main().catch((err) => {
  console.error('❌ Failed to init DB:', err.message);
  process.exit(1);
});
