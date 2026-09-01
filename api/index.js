// ============================================================
//  RentalFlow  |  Deployment  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: Vercel serverless entry for the API
// ============================================================
// Vercel turns every file in /api into a serverless function. An Express app is
// itself a (req, res) handler, so exporting it is all that is needed — Vercel
// invokes it per request instead of us calling app.listen().
//
// vercel.json rewrites every /api/* path to this one function, so Express keeps
// doing its own routing exactly as it does locally.
import app from '../server/src/app.js';

export default app;
