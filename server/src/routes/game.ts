import { Router, type Request } from 'express';
import type { DB } from '../db/db';
import {
  aufgabeAbholen, blackjackSpielen, blackjackZug, forschungStarten, gebaeudeAbreissen, gebaeudeBauen, gebaeudeVerbessern, naturAbbauen, spielLaden, stadtGruenden
} from '../services/gameApi';

// Die Adressen (API), über die der Browser mit dem Server spricht.
// Die eigentliche Arbeit machen die Funktionen in services/gameApi.ts.
export function gameRouter(db: DB, uhr: () => number = Date.now): Router {
  const r = Router();

  // Jede Aktion bekommt vom Browser eine eindeutige Nummer (gegen Doppelklicks)
  const anfrageId = (req: Request): string | undefined => {
    const key = req.get('Idempotency-Key');
    return key && key.length <= 100 ? key : undefined;
  };

  r.get('/game', (req, res) => {
    res.json(spielLaden(db, uhr(), req.query.welcome === '1'));
  });
  r.post('/game/new', (req, res) => {
    res.status(201).json(stadtGruenden(db, uhr(), req.body?.cityName, req.body?.replace));
  });
  r.post('/buildings', (req, res) => {
    res.json(gebaeudeBauen(db, uhr(), anfrageId(req), req.body?.type, req.body?.x, req.body?.y));
  });
  r.post('/buildings/:id/upgrade', (req, res) => {
    res.json(gebaeudeVerbessern(db, uhr(), anfrageId(req), req.params.id));
  });
  r.delete('/buildings/:id', (req, res) => {
    res.json(gebaeudeAbreissen(db, uhr(), anfrageId(req), req.params.id));
  });
  r.post('/nodes/:id/harvest', (req, res) => {
    res.json(naturAbbauen(db, uhr(), anfrageId(req), req.params.id));
  });
  r.post('/research/:id', (req, res) => {
    res.json(forschungStarten(db, uhr(), anfrageId(req), req.params.id));
  });
  r.post('/quests/:id/claim', (req, res) => {
    res.json(aufgabeAbholen(db, uhr(), anfrageId(req), req.params.id));
  });
  r.post('/blackjack', (req, res) => {
    res.json(blackjackSpielen(db, uhr(), anfrageId(req), req.body?.rohstoff, req.body?.menge));
  });
  r.post('/blackjack/:zug', (req, res) => {
    res.json(blackjackZug(db, uhr(), anfrageId(req), req.params.zug));
  });

  return r;
}
