// Der "Server im Browser" für die GitHub-Pages-Version.
// GitHub Pages kann keinen Node-Server ausführen. Darum läuft hier die Datenbank (SQLite)
// direkt im Browser – mit GENAU DENSELBEN Spielregeln wie auf dem echten Server.
// Der Spielstand wird im Browser gespeichert (IndexedDB) und bleibt nach dem Schliessen erhalten.
import initSqlJs, { type Database } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import type { BuildingType, GameResponse } from '@empire/shared';
import schema from '../../../server/src/db/schema.sql?raw';
import { sqljsDb } from '../../../server/src/db/sqljsDb';
import { GameError } from '../../../server/src/services/errors';
import {
  gebaeudeAbreissen, gebaeudeBauen, gebaeudeVerbessern, naturAbbauen, spielLaden, stadtGruenden
} from '../../../server/src/services/gameApi';
import type { DB } from '../../../server/src/db/db';
import { ApiError } from './client';

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
    roh.exec(schema);
    // Nach jeder Änderung speichern (export() setzt die Einstellungen zurück, darum danach neu einrichten)
    let geplant = false;
    const speichern = () => {
      if (geplant) return;
      geplant = true;
      queueMicrotask(() => { geplant = false; const bytes = roh.export(); einrichten(); schreiben(bytes); });
    };
    return sqljsDb(roh, speichern);
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

export const browserApi = {
  laden: (willkommen: boolean) => ausfuehren(db => spielLaden(db, Date.now(), willkommen)),
  neueStadt: (cityName: string, replace = false) => ausfuehren(db => stadtGruenden(db, Date.now(), cityName, replace)),
  bauen: (type: BuildingType, x: number, y: number) => ausfuehren(db => gebaeudeBauen(db, Date.now(), id(), type, x, y)),
  verbessern: (gebaeudeId: number) => ausfuehren(db => gebaeudeVerbessern(db, Date.now(), id(), gebaeudeId)),
  abreissen: (gebaeudeId: number) => ausfuehren(db => gebaeudeAbreissen(db, Date.now(), id(), gebaeudeId)),
  abbauen: (nodeId: number) => ausfuehren(db => naturAbbauen(db, Date.now(), id(), nodeId))
};
