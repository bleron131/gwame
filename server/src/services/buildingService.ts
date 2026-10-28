import {
  BUILDINGS, DEMOLISH_REFUND, RESOURCE_IDS, XP,
  amountsText, inGrid, isBuildingType, missing, upgradeCost,
  type Amounts, type GameEvents
} from '@empire/shared';
import type { DB } from '../db/db';
import { GameError } from './errors';
import { addXp, gutschreiben, readBuildings, readSave, readStock, writeStock } from './saveService';

// Kosten abziehen – oder mit einer klaren Meldung abbrechen
export function pay(db: DB, saveId: number, cost: Amounts): void {
  const stock = readStock(db, saveId);
  const fehlt = missing(stock, cost);
  if (Object.keys(fehlt).length > 0) throw new GameError('NOT_ENOUGH', `Dir fehlt noch: ${amountsText(fehlt)}`);
  for (const r of RESOURCE_IDS) stock[r] -= cost[r] ?? 0;
  writeStock(db, saveId, stock);
}

export function tileFree(db: DB, saveId: number, x: number, y: number): boolean {
  const b = db.prepare('SELECT 1 FROM buildings WHERE save_id = ? AND x = ? AND y = ?').get(saveId, x, y);
  const n = db.prepare('SELECT 1 FROM nodes WHERE save_id = ? AND x = ? AND y = ?').get(saveId, x, y);
  return !b && !n;
}

function findBuilding(db: DB, saveId: number, buildingId: unknown) {
  const id = Number(buildingId);
  const b = Number.isInteger(id) ? readBuildings(db, saveId).find(x => x.id === id) : undefined;
  if (!b) throw new GameError('NOT_FOUND', 'Dieses Gebäude gibt es nicht.', 404);
  return b;
}

export function build(db: DB, saveId: number, type: unknown, x: unknown, y: unknown): GameEvents {
  if (!isBuildingType(type)) throw new GameError('UNKNOWN_BUILDING', 'Dieses Gebäude gibt es nicht.');
  const def = BUILDINGS[type];
  if (!def.buildable) throw new GameError('NOT_BUILDABLE', `${def.name} kann man nicht bauen.`);
  const px = Number(x), py = Number(y);
  if (!inGrid(px, py)) throw new GameError('OUT_OF_BOUNDS', 'Dieser Platz liegt ausserhalb deiner Stadt.');
  const save = readSave(db, saveId);
  if (save.level < def.unlockLevel) throw new GameError('LOCKED', `${def.name} gibt es ab Level ${def.unlockLevel}.`);
  if (!tileFree(db, saveId, px, py)) throw new GameError('TILE_TAKEN', 'Dieser Platz ist schon belegt.');
  pay(db, saveId, upgradeCost(type, 0));
  db.prepare('INSERT INTO buildings (save_id, building_type, x, y, level) VALUES (?, ?, ?, ?, 1)').run(saveId, type, px, py);
  return addXp(db, saveId, def.xp ?? XP.build);
}

export function upgrade(db: DB, saveId: number, buildingId: unknown): GameEvents {
  const b = findBuilding(db, saveId, buildingId);
  const def = BUILDINGS[b.type];
  if (b.level >= def.maxLevel) throw new GameError('MAX_LEVEL', `${def.name} ist schon auf der höchsten Stufe.`);
  pay(db, saveId, upgradeCost(b.type, b.level));
  db.prepare('UPDATE buildings SET level = level + 1 WHERE id = ?').run(b.id);
  return addXp(db, saveId, XP.upgradePerLevel * (b.level + 1));
}

export function demolish(db: DB, saveId: number, buildingId: unknown): GameEvents {
  const b = findBuilding(db, saveId, buildingId);
  if (b.type === 'townhall') throw new GameError('NOT_DEMOLISHABLE', 'Das Rathaus kann man nicht abreissen.');
  db.prepare('DELETE FROM buildings WHERE id = ?').run(b.id);
  // Die Hälfte der Baukosten zurück – aber nur so viel, wie ins Lager passt
  const cost = upgradeCost(b.type, 0);
  const zurueck: Amounts = {};
  for (const r of RESOURCE_IDS) zurueck[r] = Math.floor((cost[r] ?? 0) * DEMOLISH_REFUND);
  return { gained: gutschreiben(db, saveId, zurueck) };
}
