import {
  AUSRUHEN, BUILDINGS, DEMOLISH_REFUND, HAMMER_SEKUNDEN, HARVEST_COOLDOWN_MS, RESOURCE_IDS, XP,
  amountsText, bauzeit, feldGebiet, imBau, isBuildingType, missing, upgradeCost,
  type Amounts, type GameEvents
} from '@empire/shared';
import type { DB } from '../db/db';
import { GameError } from './errors';
import { addXp, besitzSet, gutschreiben, readBuildings, readSave, readStock, writeStock } from './saveService';

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

export function findBuilding(db: DB, saveId: number, buildingId: unknown) {
  const id = Number(buildingId);
  const b = Number.isInteger(id) ? readBuildings(db, saveId).find(x => x.id === id) : undefined;
  if (!b) throw new GameError('NOT_FOUND', 'Dieses Gebäude gibt es nicht.', 404);
  return b;
}

// Bauen: Platz prüfen, bezahlen (oder einen Bausatz aus dem Shop nehmen), dann beginnt die Baustelle.
// Ein Bausatz ist sofort fertig – er wurde ja schon fertig geliefert.
export function build(db: DB, saveId: number, type: unknown, x: unknown, y: unknown, now: number, bausatz = false): GameEvents {
  if (!isBuildingType(type)) throw new GameError('UNKNOWN_BUILDING', 'Dieses Gebäude gibt es nicht.');
  const def = BUILDINGS[type];
  if (!def.buildable) throw new GameError('NOT_BUILDABLE', `${def.name} kann man nicht bauen.`);
  const px = Number(x), py = Number(y);
  const gebiet = feldGebiet(px, py, besitzSet(db, saveId));
  if (!gebiet) throw new GameError('OUT_OF_BOUNDS', 'Dieses Land gehört dir noch nicht. Kauf es zuerst!');
  if (def.gebiet === 'industrie' && gebiet !== 'industrie') throw new GameError('WRONG_AREA', `${def.name} darf nur ins Industrie-Gebiet.`);
  if (def.gebiet === 'stadt' && gebiet !== 'stadt') throw new GameError('WRONG_AREA', `${def.name} gehört in die Stadt, nicht in die Industrie.`);
  const save = readSave(db, saveId);
  if (!bausatz && save.level < def.unlockLevel) throw new GameError('LOCKED', `${def.name} gibt es ab Level ${def.unlockLevel}.`);
  if (!tileFree(db, saveId, px, py)) throw new GameError('TILE_TAKEN', 'Dieser Platz ist schon belegt.');

  let ende = 0;
  if (bausatz) {
    const r = db.prepare('UPDATE bausaetze SET anzahl = anzahl - 1 WHERE save_id = ? AND building_type = ? AND anzahl > 0').run(saveId, type);
    if (r.changes === 0) throw new GameError('NO_KIT', `Du hast keinen Bausatz für ${def.name}. Bestell einen im 💻 PC!`);
  } else {
    pay(db, saveId, upgradeCost(type, 0));
    const sek = bauzeit(type, 1, save.bauarbeiter);
    ende = sek > 0 ? now + sek * 1000 : 0;
  }
  db.prepare('INSERT INTO buildings (save_id, building_type, x, y, level, bau_ende) VALUES (?, ?, ?, ?, 1, ?)').run(saveId, type, px, py, ende);
  return { ...addXp(db, saveId, def.xp ?? XP.build), ...(ende ? { bauEnde: ende } : {}) };
}

export function upgrade(db: DB, saveId: number, buildingId: unknown, now: number): GameEvents {
  const b = findBuilding(db, saveId, buildingId);
  const def = BUILDINGS[b.type];
  if (imBau(b, now)) throw new GameError('UNDER_CONSTRUCTION', 'Hier wird noch gebaut – warte, bis es fertig ist.');
  if (b.level >= def.maxLevel) throw new GameError('MAX_LEVEL', `${def.name} ist schon auf der höchsten Stufe.`);
  pay(db, saveId, upgradeCost(b.type, b.level));
  const sek = bauzeit(b.type, b.level + 1, readSave(db, saveId).bauarbeiter);
  const ende = sek > 0 ? now + sek * 1000 : 0;
  db.prepare('UPDATE buildings SET level = level + 1, bau_ende = ? WHERE id = ?').run(ende, b.id);
  return { ...addXp(db, saveId, XP.upgradePerLevel * (b.level + 1)), ...(ende ? { bauEnde: ende } : {}) };
}

export function demolish(db: DB, saveId: number, buildingId: unknown, now: number): GameEvents {
  const b = findBuilding(db, saveId, buildingId);
  if (b.type === 'townhall') throw new GameError('NOT_DEMOLISHABLE', 'Das Rathaus kann man nicht abreissen.');
  db.prepare('DELETE FROM buildings WHERE id = ?').run(b.id);
  // Die Hälfte der Baukosten zurück – aber nur so viel, wie ins Lager passt.
  // Die Arbeiter werden wieder frei (sie wohnen ja weiter in der Stadt).
  const cost = upgradeCost(b.type, 0);
  const zurueck: Amounts = {};
  for (const r of RESOURCE_IDS) zurueck[r] = Math.floor((cost[r] ?? 0) * DEMOLISH_REFUND);
  return { gained: gutschreiben(db, saveId, zurueck, now) };
}

// Der Bürgermeister hilft selbst auf der Baustelle mit: jeder Hammerschlag spart 2 Sekunden (ausgeruht: 4)
export function hammer(db: DB, saveId: number, buildingId: unknown, now: number): GameEvents {
  const b = findBuilding(db, saveId, buildingId);
  if (!imBau(b, now)) throw new GameError('NOT_UNDER_CONSTRUCTION', 'Hier ist schon alles fertig gebaut.');
  const save = readSave(db, saveId);
  if (now - save.last_harvest_at < HARVEST_COOLDOWN_MS) throw new GameError('TOO_FAST', 'Nicht so schnell!', 429);
  const sekunden = HAMMER_SEKUNDEN * (save.ausgeruht_bis > now ? AUSRUHEN.ertragFaktor : 1); // ausgeruht: doppelt so viel
  const neu = Math.max(now, (b.bauEnde ?? 0) - sekunden * 1000);
  db.prepare('UPDATE buildings SET bau_ende = ? WHERE id = ?').run(neu <= now ? now : neu, b.id);
  db.prepare('UPDATE game_saves SET last_harvest_at = ? WHERE id = ?').run(now, saveId);
  return addXp(db, saveId, XP.hammer);
}
