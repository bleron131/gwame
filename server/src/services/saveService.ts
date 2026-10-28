import {
  BUILDINGS, NODES, OFFLINE_LIMIT_SECONDS, QUESTS, START_RESOURCES, TOWNHALL_POS,
  cityStats, emptyStock, gainedBetween, generateNodes, isResearchId, levelForXp, produce,
  type Amounts, type AufgabenStand, type BuildingType, type CityStats, type ForschungsStand, type GameEvents, type GameState,
  type MapNode, type NodeType, type OfflineReport, type PlacedBuilding, type ResearchId, type Stock
} from '@empire/shared';
import type { DB } from '../db/db';
import { blackjackSicht } from './blackjackService';
import { GameError } from './errors';

interface SaveRow {
  id: number;
  city_name: string;
  level: number;
  experience: number;
  seed: number;
  last_calculated_at: number;
  last_harvest_at: number;
  research_active: string | null;  // diese Forschung läuft gerade
  research_ends_at: number;        // … und ist dann fertig (ms)
}

// Für Version 0.1 gibt es genau einen Spielstand
export function findSaveId(db: DB): number | undefined {
  const row = db.prepare('SELECT id FROM game_saves ORDER BY id LIMIT 1').get() as { id: number } | undefined;
  return row?.id;
}

export function readSave(db: DB, saveId: number): SaveRow {
  const row = db.prepare('SELECT * FROM game_saves WHERE id = ?').get(saveId) as SaveRow | undefined;
  if (!row) throw new GameError('NO_SAVE', 'Diesen Spielstand gibt es nicht.', 404);
  return row;
}

export function readStock(db: DB, saveId: number): Stock {
  const stock = emptyStock(); // fehlt ein (neuer) Rohstoff in der DB, ist er 0
  const rows = db.prepare('SELECT resource_type, amount FROM resources WHERE save_id = ?').all(saveId) as { resource_type: string; amount: number }[];
  for (const row of rows) if (row.resource_type in stock) stock[row.resource_type as keyof Stock] = row.amount;
  return stock;
}

// Speichert die angegebenen Rohstoffe (fehlende bleiben, wie sie sind)
export function writeStock(db: DB, saveId: number, stock: Amounts): void {
  const upsert = db.prepare(`INSERT INTO resources (save_id, resource_type, amount) VALUES (?, ?, ?)
    ON CONFLICT (save_id, resource_type) DO UPDATE SET amount = excluded.amount`);
  for (const r of Object.keys(stock) as (keyof Stock)[]) upsert.run(saveId, r, Math.max(0, stock[r] ?? 0));
}

export function readBuildings(db: DB, saveId: number): PlacedBuilding[] {
  const rows = db.prepare('SELECT id, building_type, x, y, level FROM buildings WHERE save_id = ? ORDER BY id').all(saveId) as
    { id: number; building_type: string; x: number; y: number; level: number }[];
  return rows.filter(r => r.building_type in BUILDINGS).map(r => ({ id: r.id, type: r.building_type as BuildingType, x: r.x, y: r.y, level: r.level }));
}

export function readNodes(db: DB, saveId: number): MapNode[] {
  const rows = db.prepare('SELECT id, node_type, x, y, hits_left FROM nodes WHERE save_id = ? ORDER BY id').all(saveId) as
    { id: number; node_type: string; x: number; y: number; hits_left: number }[];
  return rows.map(r => ({ id: r.id, type: r.node_type as NodeType, x: r.x, y: r.y, hitsLeft: r.hits_left }));
}

// Rohstoffe dazulegen – aber nur so viel, wie ins Lager passt. Gibt zurück, was wirklich dazukam.
export function gutschreiben(db: DB, saveId: number, menge: Amounts): Amounts {
  const stock = readStock(db, saveId);
  const cap = stadtWerte(db, saveId).capacity;
  const gained: Amounts = {};
  for (const r of Object.keys(menge) as (keyof Stock)[]) {
    const dazu = menge[r] ?? 0;
    if (dazu <= 0) continue;
    const grenze = cap[r];
    const neu = grenze === null ? stock[r] + dazu : Math.max(stock[r], Math.min(grenze, stock[r] + dazu));
    if (neu > stock[r]) gained[r] = Math.floor(neu - stock[r]);
    stock[r] = neu;
  }
  writeStock(db, saveId, stock);
  return gained;
}

// ===== Forschung =====
export function readResearch(db: DB, saveId: number): ResearchId[] {
  const rows = db.prepare('SELECT research_id FROM research WHERE save_id = ? ORDER BY rowid').all(saveId) as { research_id: string }[];
  return rows.map(r => r.research_id).filter(isResearchId);
}

export function readForschung(db: DB, saveId: number): ForschungsStand {
  const save = readSave(db, saveId);
  const aktiv = isResearchId(save.research_active) ? save.research_active : null;
  return { fertig: readResearch(db, saveId), aktiv, endetAm: aktiv ? save.research_ends_at : 0 };
}

// Die Werte der Stadt – mit allen fertigen Forschungen
export function stadtWerte(db: DB, saveId: number): CityStats {
  return cityStats(readBuildings(db, saveId), readResearch(db, saveId));
}

// ===== Aufgaben =====
// Die aktive Aufgabe ist die erste in QUESTS, die noch nicht erledigt ist.
export function readAufgabe(db: DB, saveId: number): AufgabenStand {
  const rows = db.prepare('SELECT quest_id, progress, completed FROM quests WHERE save_id = ?').all(saveId) as
    { quest_id: string; progress: number; completed: number }[];
  const erledigt = new Set(rows.filter(r => r.completed).map(r => r.quest_id));
  const nummer = QUESTS.findIndex(q => !erledigt.has(q.id));
  if (nummer < 0) return { nummer: QUESTS.length, id: null, zaehler: 0 };
  const id = QUESTS[nummer].id;
  return { nummer, id, zaehler: rows.find(r => r.quest_id === id)?.progress ?? 0 };
}

// Einen gefällten Baum / abgebauten Felsen für die aktive Aufgabe mitzählen
export function aufgabeZaehlen(db: DB, saveId: number, art: 'faellen' | 'abbauen'): void {
  const aufgabe = readAufgabe(db, saveId);
  const q = QUESTS[aufgabe.nummer];
  if (!q || q.ziel.art !== art) return;
  db.prepare(`INSERT INTO quests (save_id, quest_id, progress) VALUES (?, ?, 1)
    ON CONFLICT (save_id, quest_id) DO UPDATE SET progress = progress + 1`).run(saveId, q.id);
}

// Eine neue Stadt anlegen: Rathaus in die Mitte, Startrohstoffe, Bäume und Felsen
export function createSave(db: DB, cityName: string, now: number): number {
  const seed = Math.floor(Math.random() * 2 ** 31);
  const info = db.prepare('INSERT INTO game_saves (city_name, seed, last_calculated_at) VALUES (?, ?, ?)').run(cityName, seed, now);
  const saveId = Number(info.lastInsertRowid);
  writeStock(db, saveId, { ...START_RESOURCES });
  db.prepare('INSERT INTO buildings (save_id, building_type, x, y, level) VALUES (?, ?, ?, ?, 1)').run(saveId, 'townhall', TOWNHALL_POS.x, TOWNHALL_POS.y);
  const addNode = db.prepare('INSERT INTO nodes (save_id, node_type, x, y, hits_left) VALUES (?, ?, ?, ?, ?)');
  for (const n of generateNodes(seed)) addNode.run(saveId, n.type, n.x, n.y, NODES[n.type].hits);
  return saveId;
}

export function deleteAllSaves(db: DB): void {
  db.prepare('DELETE FROM game_saves').run();
}

// Die Produktion bis "now" nachrechnen und speichern.
// Wird vor JEDER Aktion aufgerufen – so stimmen die Vorräte immer.
//
// Wird unterwegs eine Forschung fertig, rechnen wir in zwei Teilen:
// bis zum Ende der Forschung ohne Bonus, danach mit Bonus.
export function settle(db: DB, saveId: number, now: number): OfflineReport {
  const save = readSave(db, saveId);
  const buildings = readBuildings(db, saveId);
  const fertig = readResearch(db, saveId);
  const vorher = readStock(db, saveId);
  const sekunden = Math.min(Math.max(0, (now - save.last_calculated_at) / 1000), OFFLINE_LIMIT_SECONDS);
  const ende = save.last_calculated_at + sekunden * 1000; // bis hierhin wird gerechnet
  let nachher = vorher;
  let zeit = save.last_calculated_at;

  if (save.research_active && save.research_ends_at <= now) {
    // Teil 1: bis die Forschung fertig ist
    const fertigAm = Math.max(zeit, Math.min(save.research_ends_at, ende));
    nachher = produce(nachher, cityStats(buildings, fertig), (fertigAm - zeit) / 1000);
    zeit = fertigAm;
    if (isResearchId(save.research_active)) {
      db.prepare('INSERT OR IGNORE INTO research (save_id, research_id) VALUES (?, ?)').run(saveId, save.research_active);
      fertig.push(save.research_active);
    }
    db.prepare('UPDATE game_saves SET research_active = NULL, research_ends_at = 0 WHERE id = ?').run(saveId);
  }
  // Teil 2: der Rest (mit allen fertigen Forschungen)
  nachher = produce(nachher, cityStats(buildings, fertig), (ende - zeit) / 1000);
  writeStock(db, saveId, nachher);
  db.prepare('UPDATE game_saves SET last_calculated_at = ? WHERE id = ?').run(Math.max(now, save.last_calculated_at), saveId);
  return { seconds: Math.round(sekunden), gained: gainedBetween(vorher, nachher) };
}

// Erfahrung dazuzählen – vielleicht gibt es ein neues Level
export function addXp(db: DB, saveId: number, amount: number): GameEvents {
  const save = readSave(db, saveId);
  const xp = save.experience + amount;
  const level = levelForXp(xp);
  db.prepare('UPDATE game_saves SET experience = ?, level = ? WHERE id = ?').run(xp, level, saveId);
  if (level <= save.level) return {};
  const unlocked = (Object.keys(BUILDINGS) as BuildingType[])
    .filter(t => BUILDINGS[t].buildable && BUILDINGS[t].unlockLevel > save.level && BUILDINGS[t].unlockLevel <= level);
  return { levelUp: level, unlocked };
}

export function loadState(db: DB, saveId: number, now: number): GameState {
  const save = readSave(db, saveId);
  const buildings = readBuildings(db, saveId);
  const forschung = readForschung(db, saveId);
  return {
    save: { id: save.id, cityName: save.city_name, level: save.level, experience: save.experience, lastCalculatedAt: save.last_calculated_at },
    resources: readStock(db, saveId),
    buildings,
    nodes: readNodes(db, saveId),
    stats: cityStats(buildings, forschung.fertig),
    forschung,
    aufgabe: readAufgabe(db, saveId),
    blackjack: blackjackSicht(db, saveId),
    serverTime: now
  };
}
