// ============================================================
//  RentalFlow  |  Sprint 1  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: Local development server entry
// ============================================================
// Local entry point: takes the Express app and starts listening on a port.
// The app itself lives in app.js so the same routes can also be mounted as a
// serverless function on Vercel (see api/index.js), which never calls listen().
import app from './app.js';

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 RentalFlow API running on http://localhost:${PORT}`);
});
