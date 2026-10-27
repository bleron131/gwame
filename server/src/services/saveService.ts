import {
  BUILDINGS, NODES, OFFLINE_LIMIT_SECONDS, START_RESOURCES, TOWNHALL_POS,
  cityStats, emptyStock, gainedBetween, generateNodes, levelForXp, produce,
  type BuildingType, type GameEvents, type GameState, type MapNode, type NodeType,
  type OfflineReport, type PlacedBuilding, type Stock
} from '@empire/shared';
import type { DB } from '../db/db';
import { GameError } from './errors';

interface SaveRow {
  id: number;
  city_name: string;
  level: number;
  experience: number;
  seed: number;
  last_calculated_at: number;
  last_harvest_at: number;
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

export function writeStock(db: DB, saveId: number, stock: Stock): void {
  const upsert = db.prepare(`INSERT INTO resources (save_id, resource_type, amount) VALUES (?, ?, ?)
    ON CONFLICT (save_id, resource_type) DO UPDATE SET amount = excluded.amount`);
  for (const r of Object.keys(stock) as (keyof Stock)[]) upsert.run(saveId, r, Math.max(0, stock[r]));
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
export function settle(db: DB, saveId: number, now: number): OfflineReport {
  const save = readSave(db, saveId);
  const vorher = readStock(db, saveId);
  const sekunden = Math.min(Math.max(0, (now - save.last_calculated_at) / 1000), OFFLINE_LIMIT_SECONDS);
  const nachher = produce(vorher, cityStats(readBuildings(db, saveId)), sekunden);
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
  return {
    save: { id: save.id, cityName: save.city_name, level: save.level, experience: save.experience, lastCalculatedAt: save.last_calculated_at },
    resources: readStock(db, saveId),
    buildings,
    nodes: readNodes(db, saveId),
    stats: cityStats(buildings),
    serverTime: now
  };
}
