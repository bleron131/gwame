import { HARVEST_COOLDOWN_MS, NODES, RESEARCH, RESOURCES, RESOURCE_IDS, XP, type Amounts, type GameEvents } from '@empire/shared';
import type { DB } from '../db/db';
import { GameError } from './errors';
import { addXp, aufgabeZaehlen, readNodes, readResearch, readSave, readStock, stadtWerte, writeStock } from './saveService';

// Der Bürgermeister schlägt einmal auf einen Baum oder Felsen
export function harvest(db: DB, saveId: number, nodeId: unknown, now: number): GameEvents {
  const id = Number(nodeId);
  const node = readNodes(db, saveId).find(n => n.id === id);
  if (!node) throw new GameError('NOT_FOUND', 'Hier gibt es nichts mehr abzubauen.', 404);
  const save = readSave(db, saveId);
  if (now - save.last_harvest_at < HARVEST_COOLDOWN_MS) throw new GameError('TOO_FAST', 'Nicht so schnell!', 429);

  const def = NODES[node.type];
  // Forschung "Schärfere Äxte": mehr Holz pro Schlag
  const extraHolz = readResearch(db, saveId).reduce((s, f) => s + (RESEARCH[f].effekt.ernte ?? 0), 0);
  const ertrag: Amounts = { ...def.yield };
  if (ertrag.wood) ertrag.wood += extraHolz;

  const stock = readStock(db, saveId);
  const cap = stadtWerte(db, saveId, now).capacity;
  const gained: Amounts = {};
  for (const r of RESOURCE_IDS) {
    const menge = ertrag[r] ?? 0;
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

  if (node.hitsLeft <= 1) {
    db.prepare('DELETE FROM nodes WHERE id = ?').run(node.id);
    aufgabeZaehlen(db, saveId, node.type === 'tree' ? 'faellen' : 'abbauen'); // für Gretas Aufgabe
  } else {
    db.prepare('UPDATE nodes SET hits_left = hits_left - 1 WHERE id = ?').run(node.id);
  }
  db.prepare('UPDATE game_saves SET last_harvest_at = ? WHERE id = ?').run(now, saveId);

  return { ...addXp(db, saveId, XP.harvest), gained };
}
