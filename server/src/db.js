// ============================================================
//  RentalFlow  |  Sprint 1  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: PostgreSQL pool + raw-SQL query helper
// ============================================================
// Central database access layer.
// We use the `pg` driver with RAW SQL only. No ORM is used anywhere in this
// project (this is a hard course requirement). Every query is hand-written SQL
// with parameterized values ($1, $2, ...) to prevent SQL injection.
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load server/.env by absolute path, not relative to the current working
// directory. Locally the API is started from server/, but the Vercel function
// is invoked from the repo root — resolving from this file works in both.
// On Vercel the real values come from the project's environment variables,
// which are already set and are never overwritten by dotenv.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Return DATE columns (type oid 1082) as plain 'YYYY-MM-DD' strings instead of
// JS Date objects. The default parser builds a Date in the server's timezone,
// which shifts booking dates by a day and breaks the day-accurate availability
// comparisons on the frontend calendar. Keeping DATE as a string avoids that.
pg.types.setTypeParser(1082, (value) => value);

const { Pool } = pg;

// Hosted Postgres (Neon, Supabase, Railway…) requires TLS, while the local
// Docker database does not offer it. Turn SSL on only for a remote host so the
// same code connects in both places.
const isLocalDb = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || '');

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocalDb ? false : { rejectUnauthorized: false },
  // A serverless function is frozen between requests, so keep the pool small
  // and let idle connections drop rather than exhausting the database.
  max: process.env.VERCEL ? 1 : 10,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
});

// A pool error must never take the whole process down — on Vercel that would
// turn one bad connection into a FUNCTION_INVOCATION_FAILED for every request.
pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

// Small helper so route files can run raw SQL: query('SELECT ...', [params])
export function query(text, params) {
  return pool.query(text, params);
}
