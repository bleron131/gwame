import type { DB } from './db';

// Migrationen = kleine Umbauten an der Datenbank für neue Spiel-Versionen.
//
// SQLite merkt sich in "PRAGMA user_version", welche Umbauten schon gemacht sind.
// Beim Start werden nur die fehlenden ausgeführt – alte Spielstände bleiben so erhalten.
// WICHTIG: Bestehende Einträge nie ändern, nur neue hinten anhängen!
const MIGRATIONEN: string[] = [
  // 1: Forschung, die gerade läuft (und wann sie fertig ist)
  `ALTER TABLE game_saves ADD COLUMN research_active TEXT;
   ALTER TABLE game_saves ADD COLUMN research_ends_at INTEGER NOT NULL DEFAULT 0;`,
  // 2: Bauzeit, Personal, Nachwachsen – und jeder alte Spielstand bekommt seine 4 Start-Parzellen
  `ALTER TABLE game_saves ADD COLUMN last_regrow_at INTEGER NOT NULL DEFAULT 0;
   ALTER TABLE game_saves ADD COLUMN bauarbeiter INTEGER NOT NULL DEFAULT 0;
   ALTER TABLE buildings ADD COLUMN bau_ende INTEGER NOT NULL DEFAULT 0;
   ALTER TABLE buildings ADD COLUMN arbeiter INTEGER NOT NULL DEFAULT 0;
   INSERT OR IGNORE INTO plots (save_id, px, py) SELECT id, 0, 0 FROM game_saves;
   INSERT OR IGNORE INTO plots (save_id, px, py) SELECT id, 1, 0 FROM game_saves;
   INSERT OR IGNORE INTO plots (save_id, px, py) SELECT id, 0, 1 FROM game_saves;
   INSERT OR IGNORE INTO plots (save_id, px, py) SELECT id, 1, 1 FROM game_saves;`
];

export const DB_VERSION = MIGRATIONEN.length;

// Legt fehlende Tabellen an und führt fehlende Migrationen aus.
// Funktioniert mit better-sqlite3 (Server) und sql.js (Browser).
export function datenbankEinrichten(db: DB, schema: string): void {
  db.exec(schema); // "CREATE TABLE IF NOT EXISTS" – schadet nie
  const version = (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
  for (let v = version; v < MIGRATIONEN.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONEN[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
    })();
  }
}
