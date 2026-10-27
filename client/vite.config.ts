import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // auch im WLAN erreichbar (zum Testen auf dem Handy)
    // Alles unter /api geht an unseren Server
    proxy: { '/api': 'http://localhost:3001' }
  }
});
