import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { GRID_SIZE, QUESTS, RESEARCH, TOWNHALL_POS, cityStats, emptyStock, xpForLevel, type GameState } from '@empire/shared';
import { SCHEMA, openDb, type DB } from '../src/db/db';
import { DB_VERSION, datenbankEinrichten } from '../src/db/migrationen';
import { sqljsDb } from '../src/db/sqljsDb';
import { runAction } from '../src/services/actionRunner';
import { build } from '../src/services/buildingService';
import { harvest } from '../src/services/harvestService';
import { claimQuest } from '../src/services/questService';
import { startResearch } from '../src/services/researchService';
import { createSave, loadState, readStock, settle, writeStock } from '../src/services/saveService';

// Tests für Produktionsketten, Strassen, Forschung, Aufgaben und Migrationen
let jetzt = 1_700_000_000_000;
let db: DB;
let saveId: number;
const MINUTE = 60 * 1000;

let SQL: SqlJsStatic;
beforeAll(async () => { SQL = await initSqlJs(); });
function sqljsNeu(): DB {
  const roh = new SQL.Database();
  roh.exec('PRAGMA foreign_keys = ON');
  const d = sqljsDb(roh);
  datenbankEinrichten(d, SCHEMA);
  return d;
}

// Kleine Helfer
const zustand = () => loadState(db, saveId, jetzt);
// Level kommt aus der Erfahrung – darum beides setzen
const levelSetzen = (level: number) => db.prepare('UPDATE game_saves SET level = ?, experience = ? WHERE id = ?').run(level, xpForLevel(level), saveId);
const viel = () => writeStock(db, saveId, { gold: 5000, wood: 290, stone: 290, planks: 290 });
// Alle Bäume und Felsen weg, damit wir frei bauen können
const platzMachen = () => db.prepare('DELETE FROM nodes WHERE save_id = ?').run(saveId);
const bauen = (typ: string, x: number, y: number) => runAction(db, saveId, undefined, jetzt, () => build(db, saveId, typ, x, y));
const warten = (ms: number) => { jetzt += ms; settle(db, saveId, jetzt); };

describe.each([
  ['Server (better-sqlite3)', () => openDb(':memory:')],
  ['Browser (sql.js)', sqljsNeu]
] as const)('Fortschritt – %s', (_art, neueDb) => {
  beforeEach(() => {
    jetzt = 1_700_000_000_000;
    db = neueDb();
    saveId = createSave(db, 'Teststadt', jetzt);
    platzMachen();
  });
  afterEach(() => db.close());

  it('Produktionskette: Getreide → Mehl → Brot', () => {
    levelSetzen(4); viel();
    bauen('farm', 0, 0);
    bauen('windmill', 2, 0);
    bauen('bakery', 4, 0);
    writeStock(db, saveId, { grain: 0, flour: 0, bread: 0 });
    warten(10 * MINUTE);
    const s = readStock(db, saveId);
    // Die Bäckerei braucht Mehl, die Mühle braucht Getreide – trotzdem kommt am Ende Brot heraus
    // 1 Bauernhof (10 🌾) reicht genau für 1 Mühle (braucht 10 🌾 → 6 🥣), die reicht für 1 Bäckerei (6 🥣 → 8 🍞)
    expect(s.grain).toBeCloseTo(0, 5);
    expect(s.flour).toBeCloseTo(0, 5);
    // 8 Brot pro Minute, minus 0,5 für die 5 Einwohner = 7,5 pro Minute
    expect(s.bread).toBeCloseTo(75, 5);
  });

  it('Ohne Zutaten arbeitet die Windmühle nicht', () => {
    levelSetzen(3); viel();
    bauen('windmill', 0, 0);
    writeStock(db, saveId, { grain: 0, flour: 0 });
    warten(5 * MINUTE);
    expect(readStock(db, saveId).flour).toBe(0);
  });

  it('Strasse zum Rathaus: verbundene Gebäude arbeiten 50 % mehr', () => {
    viel();
    const { x, y } = TOWNHALL_POS;
    bauen('road', x + 1, y);
    bauen('road', x + 2, y);
    bauen('lumberjack', x + 3, y);   // hängt an der Strasse
    bauen('lumberjack', 0, 0);       // weit weg, ohne Strasse
    const st = zustand();
    const [verbunden, allein] = st.buildings.filter(b => b.type === 'lumberjack');
    expect(st.stats.verbunden).toContain(verbunden.id);
    expect(st.stats.verbunden).not.toContain(allein.id);
    expect(st.stats.ratesPerMinute.wood).toBeCloseTo(12 * 1.5 + 12, 5);
    // Strassen kann man nicht verbessern und sie zählen nicht als Hindernis für die Produktion
    expect(st.buildings.filter(b => b.type === 'road')).toHaveLength(2);
  });

  it('Forschung: kostet, dauert, und wirkt erst danach – auch offline', () => {
    viel();
    expect(() => runAction(db, saveId, undefined, jetzt, () => startResearch(db, saveId, 'axt', jetzt))).toThrow(/Level 2/);
    levelSetzen(2);
    bauen('lumberjack', 0, 0);
    writeStock(db, saveId, { wood: 100 });
    const vorher = readStock(db, saveId);
    const r = runAction(db, saveId, undefined, jetzt, () => startResearch(db, saveId, 'axt', jetzt));
    expect(r.state.forschung.aktiv).toBe('axt');
    expect(r.state.forschung.endetAm).toBe(jetzt + RESEARCH.axt.seconds * 1000);
    expect(r.state.resources.gold).toBe(vorher.gold - 150);
    // Nur eine Forschung gleichzeitig
    expect(() => runAction(db, saveId, undefined, jetzt, () => startResearch(db, saveId, 'werkzeug', jetzt))).toThrow(/schon eine Forschung/);

    // 2 Minuten offline: 1 Minute ohne Bonus (12 Holz), 1 Minute mit +50 % (18 Holz)
    warten(2 * MINUTE);
    const st = zustand();
    expect(st.forschung.fertig).toEqual(['axt']);
    expect(st.forschung.aktiv).toBeNull();
    expect(st.resources.wood).toBeCloseTo(100 - 50 + 12 + 18, 5);
    expect(st.stats.ratesPerMinute.wood).toBeCloseTo(18, 5);
    // Schärfere Äxte: +2 Holz pro Schlag
    db.prepare("INSERT INTO nodes (save_id, node_type, x, y, hits_left) VALUES (?, 'tree', 9, 9, 3)").run(saveId);
    const baum = zustand().nodes[0];
    const h = runAction(db, saveId, undefined, jetzt, () => harvest(db, saveId, baum.id, jetzt));
    expect(h.events?.gained?.wood).toBe(7);
    // Zweimal dieselbe Forschung geht nicht
    expect(() => runAction(db, saveId, undefined, jetzt, () => startResearch(db, saveId, 'axt', jetzt))).toThrow(/schon erforscht/);
  });

  it('Aufgaben: erst erledigen, dann Belohnung abholen – dann kommt die nächste', () => {
    expect(zustand().aufgabe).toEqual({ nummer: 0, id: 'holz', zaehler: 0 });
    expect(() => runAction(db, saveId, undefined, jetzt, () => claimQuest(db, saveId, 'holz'))).toThrow(/noch nicht erledigt/);
    // Drei Bäume pflanzen und fällen (je 3 Schläge)
    for (let i = 0; i < 3; i++) db.prepare("INSERT INTO nodes (save_id, node_type, x, y, hits_left) VALUES (?, 'tree', ?, 0, 3)").run(saveId, i);
    for (const baum of zustand().nodes) {
      for (let k = 0; k < 3; k++) { jetzt += 1000; runAction(db, saveId, undefined, jetzt, () => harvest(db, saveId, baum.id, jetzt)); }
    }
    expect(zustand().aufgabe.zaehler).toBe(3);
    const gold = readStock(db, saveId).gold;
    const r = runAction(db, saveId, undefined, jetzt, () => claimQuest(db, saveId, 'holz'));
    expect(r.state.resources.gold).toBeCloseTo(gold + (QUESTS[0].belohnung.gold ?? 0), 5);
    expect(r.state.aufgabe).toEqual({ nummer: 1, id: 'holzfaeller', zaehler: 0 });
    // Die alte Aufgabe kann man nicht nochmal abholen
    expect(() => runAction(db, saveId, undefined, jetzt, () => claimQuest(db, saveId, 'holz'))).toThrow(/nicht dran/);
    // Zweite Aufgabe: Holzfäller bauen
    bauen('lumberjack', 5, 5);
    expect(runAction(db, saveId, undefined, jetzt, () => claimQuest(db, saveId, 'holzfaeller')).state.aufgabe.id).toBe('nachbarn');
  });
});

describe('Migrationen', () => {
  it('Ein alter Spielstand (ohne Forschungs-Spalten) wird erweitert und bleibt erhalten', () => {
    const ordner = mkdtempSync(join(tmpdir(), 'empire-alt-'));
    const datei = join(ordner, 'alt.db');
    // So sah die Datenbank vor dieser Version aus: nur das Schema, user_version = 0
    const alt = new Database(datei);
    alt.exec(SCHEMA);
    const id = createSave(alt as unknown as DB, 'Altstadt', jetzt);
    alt.prepare("INSERT INTO buildings (save_id, building_type, x, y, level) VALUES (?, 'house', 0, 0, 2)").run(id);
    expect(alt.pragma('user_version', { simple: true })).toBe(0);
    alt.close();

    const d = openDb(datei);
    expect(d.pragma('user_version', { simple: true })).toBe(DB_VERSION);
    const st = loadState(d, id, jetzt);
    expect(st.save.cityName).toBe('Altstadt');
    expect(st.buildings.some(b => b.type === 'house' && b.level === 2)).toBe(true);
    expect(st.forschung).toEqual({ fertig: [], aktiv: null, endetAm: 0 });
    d.close();
    // Zweimal öffnen schadet nicht (Migration läuft nur einmal)
    openDb(datei).close();
    rmSync(ordner, { recursive: true, force: true });
  });

  it('Auch im Browser (sql.js): alter Spielstand aus dem Speicher wird erweitert', () => {
    const roh = new SQL.Database();
    roh.exec(SCHEMA);
    const id = createSave(sqljsDb(roh), 'Webstadt', jetzt);
    const bytes = roh.export();
    const neu = sqljsDb(new SQL.Database(bytes));
    datenbankEinrichten(neu, SCHEMA);
    expect(loadState(neu, id, jetzt).save.cityName).toBe('Webstadt');
    expect(loadState(neu, id, jetzt).forschung.aktiv).toBeNull();
  });
});

describe('Regeln ohne Datenbank', () => {
  it('Lagertechnik vergrössert das Lager, Gold bleibt unbegrenzt', () => {
    const b = [{ id: 1, type: 'townhall' as const, x: 7, y: 7, level: 1 }];
    expect(cityStats(b).capacity.wood).toBe(300);
    expect(cityStats(b, ['lagertechnik']).capacity.wood).toBe(450);
    expect(cityStats(b).capacity.gold).toBeNull();
  });
  it('Jede Aufgabe hat eine eindeutige ID', () => {
    expect(new Set(QUESTS.map(q => q.id)).size).toBe(QUESTS.length);
    expect(GRID_SIZE).toBeGreaterThan(0);
    expect(emptyStock().bread).toBe(0);
  });
});

// Für TypeScript: GameState wird oben indirekt benutzt
export type _S = GameState;
