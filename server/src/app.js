// ============================================================
//  RentalFlow  |  Sprint 1  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: Express app (routes, static uploads, health)
// ============================================================
// Builds and exports the Express application WITHOUT starting a listener.
// Two callers use it:
//   - server/src/index.js  → calls app.listen() for local development
//   - api/index.js         → exports it as a Vercel serverless function
// Keeping `listen` out of this file is what lets the same code run in both
// places: a serverless platform invokes the handler itself and never listens.
import 'express-async-errors';   // must precede route imports: it patches the Router
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import itemRoutes from './routes/items.js';
import categoryRoutes from './routes/categories.js';
import uploadRoutes, { UPLOAD_DIR } from './routes/uploads.js';
import bookingRoutes from './routes/bookings.js';
import scanRoutes from './routes/scan.js';
import customerRoutes from './routes/customers.js';
import analyticsRoutes from './routes/analytics.js';
import maintenanceRoutes from './routes/maintenance.js';
import adminRoutes from './routes/admin.js';
import notificationRoutes from './routes/notifications.js';
import profileRoutes from './routes/profile.js';
import { auditLogger } from './middleware/audit.js';
import { blockSuspended } from './middleware/accountStatus.js';
import { pool } from './db.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Sprint 4 (F20): every state-changing call is written to the audit log, and a
// suspended account is refused before it reaches any route.
app.use('/api', blockSuspended);
app.use('/api', auditLogger);

// Health check — also confirms DB connectivity.
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: 'connected' });
  } catch (err) {
    res.status(500).json({ ok: false, db: 'disconnected', error: err.message });
  }
});

// Serve uploaded product images.
app.use('/uploads', express.static(UPLOAD_DIR));

app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/scan', scanRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/profile', profileRoutes);

// Unknown /api path → JSON 404 (not the SPA's index.html), so a typo in a fetch
// surfaces as a clear error instead of "Unexpected token < in JSON".
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Last-resort error handler. Express 4 does not catch rejected promises from an
// async route, so a database outage would otherwise crash the whole process —
// fatal on a serverless platform. `express-async-errors` patches the router so
// those rejections arrive here and become a normal 500 JSON response.
app.use((err, _req, res, _next) => {
  console.error('Unhandled API error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

export default app;
