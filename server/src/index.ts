import { createApp } from './app';
import { openDb } from './db/db';

const PORT = Number(process.env.PORT ?? 3001);

const db = openDb();
const server = createApp(db).listen(PORT, () => {
  console.log(`🏛️  Empire-Builder-Server läuft auf http://localhost:${PORT}`);
});

// Beim Beenden (Strg+C) die Datenbank sauber schliessen
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close();
    db.close();
    process.exit(0);
  });
}
