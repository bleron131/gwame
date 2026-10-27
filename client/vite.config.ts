import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// "npm run build:pages" baut die Version für GitHub Pages:
// Die Seite liegt dann unter https://NAME.github.io/REPO/ – darum der "base"-Pfad.
export default defineConfig(({ mode }) => ({
  base: mode === 'pages' ? (process.env.BASE_PATH ?? '/gwame/') : '/',
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // auch im WLAN erreichbar (zum Testen auf dem Handy)
    // Alles unter /api geht an unseren Server
    proxy: { '/api': 'http://localhost:3001' }
  }
}));
