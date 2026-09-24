import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));

// Frontend runs on 5173. API calls to /api are proxied to the Express server
// on port 4000 so we avoid CORS issues during development.
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Rules shared with the API (blur threshold, liveness geometry) are imported
    // straight from the server's source, so the phone and the server can never
    // disagree about what counts as "blurry" or "turned left".
    alias: { '@shared': path.resolve(here, '../server/src') },
  },
  server: {
    fs: { allow: ['..'] },
    port: 5173,
    // Expose on the LAN so a phone (same Wi-Fi) can open the QR scan URL,
    // which is built from the address you load the app on.
    host: true,
    proxy: {
      '/api': 'http://localhost:4000',
      '/uploads': 'http://localhost:4000',
    },
  },
});
