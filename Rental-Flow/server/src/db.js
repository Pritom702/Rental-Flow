// ============================================================
//  RentalFlow  |  Sprint 1  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: PostgreSQL pool + raw-SQL query helper
// ============================================================
// Central database access layer.
// We use the `pg` driver with RAW SQL only. No ORM is used anywhere in this
// project (this is a hard course requirement). Every query is hand-written SQL
// with parameterized values ($1, $2, ...) to prevent SQL injection.
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Small helper so route files can run raw SQL: query('SELECT ...', [params])
export function query(text, params) {
  return pool.query(text, params);
}
