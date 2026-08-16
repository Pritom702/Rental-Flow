import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Frontend runs on 5173. API calls to /api are proxied to the Express server
// on port 4000 so we avoid CORS issues during development.
export default defineConfig({
  plugins: [react()],
  server: {
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
