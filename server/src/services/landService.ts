import {
  INDUSTRIE, INDUSTRIE_PARZELLEN, LAND_AB_LEVEL, NODES, START_PARZELLEN, industrieFehlt,
  gebietVon, kaufbar, landPreis, parzellenNodes, type GameEvents
} from '@empire/shared';
import type { DB } from '../db/db';
import { pay, tileFree } from './buildingService';
import { GameError } from './errors';
import { addXp, besitzSet, industrieFrei, readBuildings, readParzellen, readSave, stadtWerte } from './saveService';

// Eine Parzelle Land am Rand der Stadt kaufen
export function landKaufen(db: DB, saveId: number, pxRoh: unknown, pyRoh: unknown): GameEvents {
  const p = { px: Number(pxRoh), py: Number(pyRoh) };
  if (!Number.isInteger(p.px) || !Number.isInteger(p.py) || gebietVon(p.px, p.py) !== 'stadt') {
    throw new GameError('BAD_PLOT', 'Dieses Land kann man nicht kaufen.');
  }
  if (readSave(db, saveId).level < LAND_AB_LEVEL) throw new GameError('LOCKED', `Land kaufen kannst du ab Level ${LAND_AB_LEVEL}.`);
  const besitz = besitzSet(db, saveId);
  if (!kaufbar(p, besitz)) throw new GameError('NOT_ADJACENT', besitz.has(`${p.px},${p.py}`) ? 'Dieses Land gehört dir schon.' : 'Du kannst nur Land kaufen, das an deine Stadt grenzt.');
  const gekauft = readParzellen(db, saveId).filter(x => gebietVon(x.px, x.py) === 'stadt').length - START_PARZELLEN.length;
  pay(db, saveId, landPreis(gekauft));
  db.prepare('INSERT INTO plots (save_id, px, py) VALUES (?, ?, ?)').run(saveId, p.px, p.py);
  // Auf neuem Land wachsen schon Bäume und liegen Felsen
  const seed = readSave(db, saveId).seed;
  const neu = db.prepare('INSERT INTO nodes (save_id, node_type, x, y, hits_left) VALUES (?, ?, ?, ?, ?)');
  for (const n of parzellenNodes(seed, p)) if (tileFree(db, saveId, n.x, n.y)) neu.run(saveId, n.type, n.x, n.y, NODES[n.type].hits);
  return addXp(db, saveId, 40);
}

// Was fehlt noch für die Industrie?
function fehltNoch(db: DB, saveId: number, now: number): string[] {
  return industrieFehlt(readSave(db, saveId).level, stadtWerte(db, saveId, now).population, readBuildings(db, saveId).map(b => b.type));
}

// Das ganze Industrie-Gebiet freischalten
export function industrieFreischalten(db: DB, saveId: number, now: number): GameEvents {
  if (industrieFrei(db, saveId)) throw new GameError('DONE', 'Die Industrie ist schon freigeschaltet.');
  const fehlt = fehltNoch(db, saveId, now);
  if (fehlt.length) throw new GameError('NOT_READY', `Für die Industrie fehlt noch: ${fehlt.join(', ')}.`);
  pay(db, saveId, INDUSTRIE.preis);
  for (const p of INDUSTRIE_PARZELLEN) db.prepare('INSERT INTO plots (save_id, px, py) VALUES (?, ?, ?)').run(saveId, p.px, p.py);
  return addXp(db, saveId, 200);
}
