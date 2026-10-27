import type { Database as SqlJsDatenbank, SqlValue } from 'sql.js';
import type { DB } from './db';

// sql.js ist SQLite für den Browser (für die GitHub-Pages-Version).
// Diese kleine "Übersetzung" lässt sql.js aussehen wie better-sqlite3 –
// darum laufen alle Spielregeln aus services/ unverändert auch im Browser.
//
// "nachSpeichern" wird aufgerufen, wenn eine Änderung fertig ist
// (z. B. um die Datenbank im Browser zu speichern).
export function sqljsDb(roh: SqlJsDatenbank, nachSpeichern?: () => void): DB {
  let tiefe = 0; // wie viele Transaktionen gerade offen sind

  const werte = (args: unknown[]): SqlValue[] =>
    args.map(a => (a === undefined ? null : typeof a === 'boolean' ? (a ? 1 : 0) : (a as SqlValue)));
  const fertig = () => { if (tiefe === 0) nachSpeichern?.(); };

  const db = {
    prepare(sql: string) {
      return {
        get(...args: unknown[]) {
          const st = roh.prepare(sql);
          try { st.bind(werte(args)); return st.step() ? st.getAsObject() : undefined; } finally { st.free(); }
        },
        all(...args: unknown[]) {
          const st = roh.prepare(sql);
          const zeilen: Record<string, SqlValue>[] = [];
          try { st.bind(werte(args)); while (st.step()) zeilen.push(st.getAsObject()); return zeilen; } finally { st.free(); }
        },
        run(...args: unknown[]) {
          roh.run(sql, werte(args));
          const changes = roh.getRowsModified();
          const lastInsertRowid = (roh.exec('SELECT last_insert_rowid()')[0]?.values[0][0] as number) ?? 0;
          fertig();
          return { changes, lastInsertRowid };
        }
      };
    },
    exec(sql: string) { roh.exec(sql); fertig(); return db; },
    pragma(befehl: string) { roh.exec('PRAGMA ' + befehl); },
    // Transaktion: alles oder nichts (auch verschachtelt, mit "Savepoints")
    transaction<T>(fn: (...args: unknown[]) => T) {
      return (...args: unknown[]): T => {
        const name = 'stufe' + tiefe;
        roh.exec(tiefe === 0 ? 'BEGIN' : `SAVEPOINT ${name}`);
        tiefe++;
        try {
          const ergebnis = fn(...args);
          tiefe--;
          roh.exec(tiefe === 0 ? 'COMMIT' : `RELEASE ${name}`);
          fertig();
          return ergebnis;
        } catch (e) {
          tiefe--;
          roh.exec(tiefe === 0 ? 'ROLLBACK' : `ROLLBACK TO ${name}; RELEASE ${name}`);
          throw e;
        }
      };
    },
    close() { roh.close(); }
  };
  return db as unknown as DB;
}
