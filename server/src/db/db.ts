import Database from 'better-sqlite3';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export type DB = Database.Database;

export const SCHEMA = readFileSync(fileURLToPath(new URL('./schema.sql', import.meta.url)), 'utf8');
const STANDARD_DATEI = fileURLToPath(new URL('../../data/empire.db', import.meta.url));

// Öffnet die Datenbank-Datei (oder ":memory:" für Tests) und legt fehlende Tabellen an.
export function openDb(file: string = process.env.DB_FILE ?? STANDARD_DATEI): DB {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');  // schneller und sicherer beim Schreiben
  db.pragma('foreign_keys = ON');   // beim Löschen einer Stadt alles mitlöschen
  db.exec(SCHEMA);
  return db;
}
