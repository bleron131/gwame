// Der "Server im Browser" für die GitHub-Pages-Version.
// GitHub Pages kann keinen Node-Server ausführen. Darum läuft hier die Datenbank (SQLite)
// direkt im Browser – mit GENAU DENSELBEN Spielregeln wie auf dem echten Server.
// Der Spielstand wird im Browser gespeichert (IndexedDB) und bleibt nach dem Schliessen erhalten.
import initSqlJs, { type Database } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import type { BuildingType, GameResponse, MoebelId, Outfit, ResearchId, ResourceId, ShopId } from '@empire/shared';
import schema from '../../../server/src/db/schema.sql?raw';
import { datenbankEinrichten } from '../../../server/src/db/migrationen';
import { sqljsDb } from '../../../server/src/db/sqljsDb';
import { GameError } from '../../../server/src/services/errors';
import * as spiel from '../../../server/src/services/gameApi';
import type { DB } from '../../../server/src/db/db';
import { ApiError, type BlackjackZug, type InnenAktion, type serverApi } from './client';

// ===== Speichern im Browser (IndexedDB) =====
const SPEICHER = { name: 'empire-builder', tabelle: 'spielstand', schluessel: 'datenbank' };

function idbOeffnen(): Promise<IDBDatabase> {
  return new Promise((ok, fehler) => {
    const anfrage = indexedDB.open(SPEICHER.name, 1);
    anfrage.onupgradeneeded = () => anfrage.result.createObjectStore(SPEICHER.tabelle);
    anfrage.onsuccess = () => ok(anfrage.result);
    anfrage.onerror = () => fehler(anfrage.error);
  });
}
async function lesen(): Promise<Uint8Array | undefined> {
  try {
    const idb = await idbOeffnen();
    return await new Promise(ok => {
      const a = idb.transaction(SPEICHER.tabelle).objectStore(SPEICHER.tabelle).get(SPEICHER.schluessel);
      a.onsuccess = () => ok(a.result as Uint8Array | undefined);
      a.onerror = () => ok(undefined);
    });
  } catch { return undefined; } // z. B. privater Modus: dann ohne Speichern spielen
}
async function schreiben(bytes: Uint8Array): Promise<void> {
  try {
    const idb = await idbOeffnen();
    idb.transaction(SPEICHER.tabelle, 'readwrite').objectStore(SPEICHER.tabelle).put(bytes, SPEICHER.schluessel);
  } catch { /* Speichern nicht möglich – das Spiel läuft trotzdem */ }
}

// ===== Datenbank starten (nur einmal) =====
let bereit: Promise<DB> | null = null;
function datenbank(): Promise<DB> {
  bereit ??= (async () => {
    const SQL = await initSqlJs({ locateFile: () => wasmUrl });
    const gespeichert = await lesen();
    const roh: Database = gespeichert ? new SQL.Database(gespeichert) : new SQL.Database();
    const einrichten = () => roh.exec('PRAGMA foreign_keys = ON');
    einrichten();
    // Nach jeder Änderung speichern (export() setzt die Einstellungen zurück, darum danach neu einrichten)
    let geplant = false;
    const speichern = () => {
      if (geplant) return;
      geplant = true;
      queueMicrotask(() => { geplant = false; const bytes = roh.export(); einrichten(); schreiben(bytes); });
    };
    const db = sqljsDb(roh, speichern);
    datenbankEinrichten(db, schema); // Tabellen anlegen + alte Spielstände erweitern
    return db;
  })();
  return bereit;
}

// Spielfehler in dieselben Fehler verwandeln, die auch der echte Server schickt
async function ausfuehren(f: (db: DB) => GameResponse): Promise<GameResponse> {
  const db = await datenbank();
  try {
    return f(db);
  } catch (e) {
    if (e instanceof GameError) throw new ApiError(e.code, e.message, e.status);
    throw e;
  }
}

const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

const t = () => Date.now();

// Genau dieselben Funktionen wie der echte Server (siehe server/src/routes/game.ts)
export const browserApi: typeof serverApi = {
  laden: (willkommen: boolean) => ausfuehren(db => spiel.spielLaden(db, t(), willkommen)),
  neueStadt: (cityName: string, replace = false) => ausfuehren(db => spiel.stadtGruenden(db, t(), cityName, replace)),
  bauen: (type: BuildingType, x: number, y: number, bausatz = false) => ausfuehren(db => spiel.gebaeudeBauen(db, t(), id(), type, x, y, bausatz)),
  mitbauen: (g: number) => ausfuehren(db => spiel.mitbauen(db, t(), id(), g)),
  moebel: (g: number, platz: number, moebel: MoebelId | null) => ausfuehren(db => spiel.moebelStellen(db, t(), id(), g, platz, moebel)),
  innen: (g: number, was: InnenAktion, outfit?: Outfit) => ausfuehren(db => spiel.innenAktion(db, t(), id(), g, was, outfit)),
  arbeiter: (g: number, mehr: boolean) => ausfuehren(db => spiel.arbeiter(db, t(), id(), g, mehr)),
  bauarbeiter: (mehr: boolean) => ausfuehren(db => spiel.bauarbeiter(db, t(), id(), mehr)),
  landKaufen: (px: number, py: number) => ausfuehren(db => spiel.landKauf(db, t(), id(), px, py)),
  industrie: () => ausfuehren(db => spiel.industrieKauf(db, t(), id())),
  bestellen: (posten: Partial<Record<ShopId, number>>) => ausfuehren(db => spiel.shopBestellen(db, t(), id(), posten)),
  verbessern: (g: number) => ausfuehren(db => spiel.gebaeudeVerbessern(db, t(), id(), g)),
  abreissen: (g: number) => ausfuehren(db => spiel.gebaeudeAbreissen(db, t(), id(), g)),
  abbauen: (nodeId: number) => ausfuehren(db => spiel.naturAbbauen(db, t(), id(), nodeId)),
  forschen: (f: ResearchId) => ausfuehren(db => spiel.forschungStarten(db, t(), id(), f)),
  abholen: (a: string) => ausfuehren(db => spiel.aufgabeAbholen(db, t(), id(), a)),
  blackjack: (rohstoff: ResourceId, menge: number) => ausfuehren(db => spiel.blackjackSpielen(db, t(), id(), rohstoff, menge)),
  blackjackZug: (zug: BlackjackZug) => ausfuehren(db => spiel.blackjackZug(db, t(), id(), zug))
};
