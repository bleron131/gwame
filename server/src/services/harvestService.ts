import { HARVEST_COOLDOWN_MS, NODES, RESOURCES, RESOURCE_IDS, XP, cityStats, type Amounts, type GameEvents } from '@empire/shared';
import type { DB } from '../db/db';
import { GameError } from './errors';
import { addXp, readBuildings, readNodes, readSave, readStock, writeStock } from './saveService';

// Der Bürgermeister schlägt einmal auf einen Baum oder Felsen
export function harvest(db: DB, saveId: number, nodeId: unknown, now: number): GameEvents {
  const id = Number(nodeId);
  const node = readNodes(db, saveId).find(n => n.id === id);
  if (!node) throw new GameError('NOT_FOUND', 'Hier gibt es nichts mehr abzubauen.', 404);
  const save = readSave(db, saveId);
  if (now - save.last_harvest_at < HARVEST_COOLDOWN_MS) throw new GameError('TOO_FAST', 'Nicht so schnell!', 429);

  const def = NODES[node.type];
  const stock = readStock(db, saveId);
  const cap = cityStats(readBuildings(db, saveId)).capacity;
  const gained: Amounts = {};
  for (const r of RESOURCE_IDS) {
    const menge = (def.yield as Amounts)[r] ?? 0;
    if (!menge) continue;
    const grenze = cap[r];
    if (grenze !== null && stock[r] >= grenze) {
      throw new GameError('STORAGE_FULL', `Dein Lager für ${RESOURCES[r].name} ist voll. Bau ein Lagerhaus!`);
    }
    const neu = grenze === null ? stock[r] + menge : Math.min(grenze, stock[r] + menge);
    gained[r] = Math.floor(neu - stock[r]);
    stock[r] = neu;
  }
  writeStock(db, saveId, stock);

  if (node.hitsLeft <= 1) db.prepare('DELETE FROM nodes WHERE id = ?').run(node.id);
  else db.prepare('UPDATE nodes SET hits_left = hits_left - 1 WHERE id = ?').run(node.id);
  db.prepare('UPDATE game_saves SET last_harvest_at = ? WHERE id = ?').run(now, saveId);

  return { ...addXp(db, saveId, XP.harvest), gained };
}
