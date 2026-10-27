import { Router, type Request } from 'express';
import type { GameResponse } from '@empire/shared';
import type { DB } from '../db/db';
import { runAction } from '../services/actionRunner';
import { build, demolish, upgrade } from '../services/buildingService';
import { GameError } from '../services/errors';
import { harvest } from '../services/harvestService';
import { createSave, deleteAllSaves, findSaveId, loadState, settle } from '../services/saveService';

// Die Adressen (API), über die der Browser mit dem Server spricht
export function gameRouter(db: DB, uhr: () => number = Date.now): Router {
  const r = Router();

  const spielstand = (): number => {
    const id = findSaveId(db);
    if (!id) throw new GameError('NO_SAVE', 'Es gibt noch keine Stadt.', 404);
    return id;
  };
  // Jede Aktion bekommt vom Browser eine eindeutige Nummer (gegen Doppelklicks)
  const anfrageId = (req: Request): string | undefined => {
    const key = req.get('Idempotency-Key');
    return key && key.length <= 100 ? key : undefined;
  };

  // Spielstand laden (rechnet vorher die Produktion nach)
  r.get('/game', (req, res) => {
    const id = spielstand();
    const now = uhr();
    const antwort = db.transaction((): GameResponse => {
      const bericht = settle(db, id, now);
      const willkommen = req.query.welcome === '1' && bericht.seconds >= 60;
      return { state: loadState(db, id, now), offline: willkommen ? bericht : undefined };
    })();
    res.json(antwort);
  });

  // Neue Stadt gründen
  r.post('/game/new', (req, res) => {
    const name = typeof req.body?.cityName === 'string' ? req.body.cityName.trim() : '';
    if (name.length < 1 || name.length > 24) throw new GameError('BAD_NAME', 'Der Name muss 1 bis 24 Zeichen lang sein.');
    if (findSaveId(db) && req.body?.replace !== true) throw new GameError('SAVE_EXISTS', 'Es gibt schon eine Stadt.', 409);
    const now = uhr();
    const id = db.transaction(() => { deleteAllSaves(db); return createSave(db, name, now); })();
    res.status(201).json({ state: loadState(db, id, now) } satisfies GameResponse);
  });

  r.post('/buildings', (req, res) => {
    const id = spielstand();
    res.json(runAction(db, id, anfrageId(req), uhr(), () => build(db, id, req.body?.type, req.body?.x, req.body?.y)));
  });

  r.post('/buildings/:id/upgrade', (req, res) => {
    const id = spielstand();
    res.json(runAction(db, id, anfrageId(req), uhr(), () => upgrade(db, id, req.params.id)));
  });

  r.delete('/buildings/:id', (req, res) => {
    const id = spielstand();
    res.json(runAction(db, id, anfrageId(req), uhr(), () => demolish(db, id, req.params.id)));
  });

  r.post('/nodes/:id/harvest', (req, res) => {
    const id = spielstand();
    const now = uhr();
    res.json(runAction(db, id, anfrageId(req), now, () => harvest(db, id, req.params.id, now)));
  });

  return r;
}
