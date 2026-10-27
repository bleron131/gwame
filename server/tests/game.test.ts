import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { GRID_SIZE, OFFLINE_LIMIT_SECONDS, START_RESOURCES, upgradeCost, type GameState } from '@empire/shared';
import { createApp } from '../src/app';
import { SCHEMA, openDb, type DB } from '../src/db/db';
import { sqljsDb } from '../src/db/sqljsDb';
import { runAction } from '../src/services/actionRunner';
import { build, pay, upgrade } from '../src/services/buildingService';
import { GameError } from '../src/services/errors';
import { harvest } from '../src/services/harvestService';
import { createSave, loadState, readStock, settle, writeStock } from '../src/services/saveService';

// Eine feste "Uhr", die wir in den Tests vorspulen können
let jetzt = 1_700_000_000_000;
let db: DB;
let saveId: number;

// Sucht ein freies Feld (ohne Gebäude, Baum oder Felsen)
function freiesFeld(state: GameState, ausser: { x: number; y: number }[] = []) {
  for (let y = 0; y < GRID_SIZE; y++) for (let x = 0; x < GRID_SIZE; x++) {
    const belegt = state.buildings.some(b => b.x === x && b.y === y) || state.nodes.some(n => n.x === x && n.y === y) ||
      ausser.some(a => a.x === x && a.y === y);
    if (!belegt) return { x, y };
  }
  throw new Error('kein freies Feld');
}

// sql.js = SQLite im Browser (für die GitHub-Pages-Version)
let SQL: SqlJsStatic;
beforeAll(async () => { SQL = await initSqlJs(); });
function sqljsNeu(): DB {
  const roh = new SQL.Database();
  roh.exec('PRAGMA foreign_keys = ON');
  roh.exec(SCHEMA);
  return sqljsDb(roh);
}

// Alle Regel-Tests laufen zweimal: mit dem Server (better-sqlite3) und mit dem Browser (sql.js)
describe.each([
  ['Server (better-sqlite3)', () => openDb(':memory:')],
  ['Browser (sql.js)', sqljsNeu]
] as const)('Empire Builder – %s', (art, neueDb) => {
beforeEach(() => {
  jetzt = 1_700_000_000_000;
  db = neueDb();
  saveId = createSave(db, 'Teststadt', jetzt);
});
afterEach(() => db.close());

  it.skipIf(art.startsWith('Browser'))('Spiel neu laden: Gebäude und Ressourcen bleiben erhalten', () => {
    const ordner = mkdtempSync(join(tmpdir(), 'empire-'));
    const datei = join(ordner, 'test.db');
    let d = openDb(datei);
    const id = createSave(d, 'Speicherstadt', jetzt);
    const feld = freiesFeld(loadState(d, id, jetzt));
    runAction(d, id, undefined, jetzt, () => build(d, id, 'lumberjack', feld.x, feld.y));
    const vorher = loadState(d, id, jetzt);
    d.close();

    d = openDb(datei); // "Server neu gestartet"
    const nachher = loadState(d, id, jetzt);
    expect(nachher.buildings).toEqual(vorher.buildings);
    expect(nachher.resources).toEqual(vorher.resources);
    expect(nachher.save.cityName).toBe('Speicherstadt');
    d.close();
    rmSync(ordner, { recursive: true, force: true });
  });

  it('Zu wenig Gold: Bau wird abgelehnt und nichts wird abgezogen', () => {
    writeStock(db, saveId, { gold: 10, wood: 500, stone: 500 });
    const feld = freiesFeld(loadState(db, saveId, jetzt));
    expect(() => runAction(db, saveId, undefined, jetzt, () => build(db, saveId, 'lumberjack', feld.x, feld.y)))
      .toThrowError(/Gold/);
    const state = loadState(db, saveId, jetzt);
    expect(state.resources.gold).toBe(10);
    expect(state.resources.wood).toBe(500);
    expect(state.buildings).toHaveLength(1); // nur das Rathaus
  });

  it('Gleicher Bauplatz: das zweite Gebäude wird abgelehnt', () => {
    const feld = freiesFeld(loadState(db, saveId, jetzt));
    runAction(db, saveId, undefined, jetzt, () => build(db, saveId, 'lumberjack', feld.x, feld.y));
    expect(() => runAction(db, saveId, undefined, jetzt, () => build(db, saveId, 'lumberjack', feld.x, feld.y)))
      .toThrowError(GameError);
    expect(loadState(db, saveId, jetzt).buildings).toHaveLength(2);
  });

  it('Offline-Produktion wird korrekt nachberechnet', () => {
    const feld = freiesFeld(loadState(db, saveId, jetzt));
    runAction(db, saveId, undefined, jetzt, () => build(db, saveId, 'lumberjack', feld.x, feld.y));
    const vorher = readStock(db, saveId);
    jetzt += 10 * 60 * 1000; // 10 Minuten weg
    settle(db, saveId, jetzt);
    const nachher = readStock(db, saveId);
    expect(nachher.wood - vorher.wood).toBeCloseTo(12 * 10, 5);         // Holzfäller: 12 pro Minute
    expect(nachher.gold - vorher.gold).toBeCloseTo((10 + 5 * 2) * 10, 5); // Rathaus 10 + 5 Einwohner x 2 Steuern
  });

  it('Offline-Limit: höchstens 8 Stunden werden nachgerechnet', () => {
    jetzt += 20 * 3600 * 1000; // 20 Stunden weg
    const bericht = settle(db, saveId, jetzt);
    expect(bericht.seconds).toBe(OFFLINE_LIMIT_SECONDS);
    expect(readStock(db, saveId).gold).toBeCloseTo(START_RESOURCES.gold + 20 * 60 * 8, 5);
  });

  it('Lager voll: keine Ressource überschreitet die Lagergrenze', () => {
    const feld = freiesFeld(loadState(db, saveId, jetzt));
    runAction(db, saveId, undefined, jetzt, () => build(db, saveId, 'lumberjack', feld.x, feld.y));
    jetzt += 5 * 3600 * 1000;
    settle(db, saveId, jetzt);
    const state = loadState(db, saveId, jetzt);
    expect(state.resources.wood).toBe(state.stats.capacity.wood);
  });

  it('Gebäude verbessern: Kosten werden abgezogen und das Level steigt', () => {
    writeStock(db, saveId, { gold: 1000, wood: 200, stone: 0 });
    const feld = freiesFeld(loadState(db, saveId, jetzt));
    const r = runAction(db, saveId, undefined, jetzt, () => build(db, saveId, 'lumberjack', feld.x, feld.y));
    const holzfaeller = r.state.buildings.find(b => b.type === 'lumberjack')!;
    const kosten = upgradeCost('lumberjack', 1);
    expect(kosten).toEqual({ gold: 80, wood: 16 });
    const nachher = runAction(db, saveId, undefined, jetzt, () => upgrade(db, saveId, holzfaeller.id));
    expect(nachher.state.buildings.find(b => b.id === holzfaeller.id)!.level).toBe(2);
    expect(nachher.state.resources.gold).toBe(1000 - 50 - 80);
    expect(nachher.state.resources.wood).toBe(200 - 10 - 16);
  });

  it('Doppelte Anfrage: dieselbe Aktion wird nur einmal ausgeführt', () => {
    writeStock(db, saveId, { gold: 1000, wood: 200, stone: 0 });
    const feld = freiesFeld(loadState(db, saveId, jetzt));
    const erste = runAction(db, saveId, 'klick-123', jetzt, () => build(db, saveId, 'lumberjack', feld.x, feld.y));
    const zweite = runAction(db, saveId, 'klick-123', jetzt, () => build(db, saveId, 'lumberjack', feld.x, feld.y));
    expect(zweite).toEqual(erste);
    expect(loadState(db, saveId, jetzt).resources.gold).toBe(950);
  });

  it('Datenbankfehler: eine halbe Aktion wird zurückgerollt', () => {
    const vorher = readStock(db, saveId);
    expect(() => runAction(db, saveId, undefined, jetzt, () => {
      pay(db, saveId, { gold: 100 });           // Geld ist schon abgezogen …
      throw new Error('Stromausfall!');          // … dann passiert ein Fehler
    })).toThrow('Stromausfall!');
    expect(readStock(db, saveId)).toEqual(vorher); // nichts ist verloren
  });

  it('Bäume fällen gibt Holz, und nach 3 Schlägen ist der Baum weg', () => {
    const baum = loadState(db, saveId, jetzt).nodes.find(n => n.type === 'tree')!;
    for (let k = 0; k < 3; k++) {
      jetzt += 1000;
      runAction(db, saveId, undefined, jetzt, () => harvest(db, saveId, baum.id, jetzt));
    }
    const state = loadState(db, saveId, jetzt);
    expect(state.nodes.find(n => n.id === baum.id)).toBeUndefined();
    expect(state.resources.wood).toBeCloseTo(START_RESOURCES.wood + 15, 5);
    // Zu schnell hintereinander zuschlagen geht nicht
    const felsen = state.nodes.find(n => n.type === 'rock')!;
    runAction(db, saveId, undefined, jetzt + 1000, () => harvest(db, saveId, felsen.id, jetzt + 1000));
    expect(() => runAction(db, saveId, undefined, jetzt + 1100, () => harvest(db, saveId, felsen.id, jetzt + 1100))).toThrowError(/schnell/);
  });
});

describe('Empire Builder – Browser-Speicher', () => {
  it('Spielstand bleibt nach dem Neuladen der Seite erhalten (sql.js export/import)', () => {
    const roh = new SQL.Database();
    roh.exec('PRAGMA foreign_keys = ON'); roh.exec(SCHEMA);
    let d = sqljsDb(roh);
    const id = createSave(d, 'Browserstadt', jetzt);
    const feld = freiesFeld(loadState(d, id, jetzt));
    runAction(d, id, undefined, jetzt, () => build(d, id, 'house', feld.x, feld.y));
    const vorher = loadState(d, id, jetzt);
    const bytes = roh.export();     // so speichert der Browser die Datenbank
    d.close();
    const neu = new SQL.Database(bytes); // "Seite neu geladen"
    neu.exec('PRAGMA foreign_keys = ON'); neu.exec(SCHEMA);
    d = sqljsDb(neu);
    expect(loadState(d, id, jetzt)).toEqual(vorher);
    d.close();
  });
});

describe('Empire Builder – API', () => {
  it('neue Stadt, bauen und verständliche Fehlermeldungen über HTTP', async () => {
    const leer = openDb(':memory:');
    const server = createApp(leer, () => jetzt).listen(0);
    const port = (server.address() as { port: number }).port;
    const url = (p: string) => `http://127.0.0.1:${port}/api${p}`;
    const post = (p: string, body: unknown) => fetch(url(p), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    try {
      expect((await fetch(url('/game'))).status).toBe(404);
      const neu = await post('/game/new', { cityName: 'Neustadt' });
      expect(neu.status).toBe(201);
      const { state } = await neu.json() as { state: GameState };
      const feld = freiesFeld(state);
      expect((await post('/buildings', { type: 'house', x: feld.x, y: feld.y })).status).toBe(200);
      const falsch = await post('/buildings', { type: 'raumschiff', x: 0, y: 0 });
      expect(falsch.status).toBe(400);
      expect((await falsch.json()).message).toBe('Dieses Gebäude gibt es nicht.');
      const gesperrt = await post('/buildings', { type: 'warehouse', ...freiesFeld(state, [feld]) });
      expect((await gesperrt.json()).message).toMatch(/ab Level 3/);
    } finally {
      server.close();
      leer.close();
    }
  });
});
