import express, { type ErrorRequestHandler } from 'express';
import type { ApiErrorBody } from '@empire/shared';
import type { DB } from './db/db';
import { gameRouter } from './routes/game';
import { GameError } from './services/errors';

// Baut den Webserver zusammen. "uhr" kann man in Tests vorspulen.
export function createApp(db: DB, uhr?: () => number) {
  const app = express();
  app.use(express.json({ limit: '10kb' }));
  app.use('/api', gameRouter(db, uhr));

  app.use((_req, res) => {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Diese Adresse gibt es nicht.' } satisfies ApiErrorBody);
  });

  // Fehler in schöne Antworten verwandeln
  const fehler: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof GameError) {
      res.status(err.status).json({ error: err.code, message: err.message } satisfies ApiErrorBody);
    } else if (err?.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'BAD_JSON', message: 'Die Anfrage war kaputt.' } satisfies ApiErrorBody);
    } else {
      console.error(err);
      res.status(500).json({ error: 'SERVER_ERROR', message: 'Ups, auf dem Server ist etwas schiefgelaufen.' } satisfies ApiErrorBody);
    }
  };
  app.use(fehler);
  return app;
}
