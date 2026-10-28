import { Router, type Request } from 'express';
import type { DB } from '../db/db';
import * as spiel from '../services/gameApi';

// Die Adressen (API), über die der Browser mit dem Server spricht.
// Die eigentliche Arbeit machen die Funktionen in services/gameApi.ts.
export function gameRouter(db: DB, uhr: () => number = Date.now): Router {
  const r = Router();

  // Jede Aktion bekommt vom Browser eine eindeutige Nummer (gegen Doppelklicks)
  const anfrageId = (req: Request): string | undefined => {
    const key = req.get('Idempotency-Key');
    return key && key.length <= 100 ? key : undefined;
  };

  r.get('/game', (req, res) => { res.json(spiel.spielLaden(db, uhr(), req.query.welcome === '1')); });
  r.post('/game/new', (req, res) => { res.status(201).json(spiel.stadtGruenden(db, uhr(), req.body?.cityName, req.body?.replace)); });

  r.post('/buildings', (req, res) => {
    res.json(spiel.gebaeudeBauen(db, uhr(), anfrageId(req), req.body?.type, req.body?.x, req.body?.y, req.body?.bausatz));
  });
  r.post('/buildings/:id/upgrade', (req, res) => { res.json(spiel.gebaeudeVerbessern(db, uhr(), anfrageId(req), req.params.id)); });
  r.post('/buildings/:id/hammer', (req, res) => { res.json(spiel.mitbauen(db, uhr(), anfrageId(req), req.params.id)); });
  r.post('/buildings/:id/workers', (req, res) => { res.json(spiel.arbeiter(db, uhr(), anfrageId(req), req.params.id, req.body?.mehr)); });
  r.delete('/buildings/:id', (req, res) => { res.json(spiel.gebaeudeAbreissen(db, uhr(), anfrageId(req), req.params.id)); });

  r.post('/nodes/:id/harvest', (req, res) => { res.json(spiel.naturAbbauen(db, uhr(), anfrageId(req), req.params.id)); });
  r.post('/research/:id', (req, res) => { res.json(spiel.forschungStarten(db, uhr(), anfrageId(req), req.params.id)); });
  r.post('/quests/:id/claim', (req, res) => { res.json(spiel.aufgabeAbholen(db, uhr(), anfrageId(req), req.params.id)); });

  r.post('/builders', (req, res) => { res.json(spiel.bauarbeiter(db, uhr(), anfrageId(req), req.body?.mehr)); });
  r.post('/land', (req, res) => { res.json(spiel.landKauf(db, uhr(), anfrageId(req), req.body?.px, req.body?.py)); });
  r.post('/land/industrie', (req, res) => { res.json(spiel.industrieKauf(db, uhr(), anfrageId(req))); });
  r.post('/shop/orders', (req, res) => { res.json(spiel.shopBestellen(db, uhr(), anfrageId(req), req.body?.posten)); });

  r.post('/blackjack', (req, res) => { res.json(spiel.blackjackSpielen(db, uhr(), anfrageId(req), req.body?.rohstoff, req.body?.menge)); });
  r.post('/blackjack/:zug', (req, res) => { res.json(spiel.blackjackZug(db, uhr(), anfrageId(req), req.params.zug)); });

  return r;
}
