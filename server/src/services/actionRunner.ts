import type { GameEvents, GameResponse } from '@empire/shared';
import type { DB } from '../db/db';
import { loadState, settle } from './saveService';

const EIN_TAG_MS = 24 * 3600 * 1000;

// Führt eine Spieler-Aktion sicher aus:
// 1. Gab es diese Anfrage schon? Dann die alte Antwort zurückgeben (kein Doppelbau).
// 2. Produktion bis jetzt nachrechnen.
// 3. Die Aktion ausführen.
// 4. Alles in EINER Transaktion: Wenn irgendwo ein Fehler passiert,
//    wird nichts gespeichert (kein Geld weg ohne Gebäude).
export function runAction(db: DB, saveId: number, requestId: string | undefined, now: number, aktion: () => GameEvents | void): GameResponse {
  const transaktion = db.transaction((): GameResponse => {
    if (requestId) {
      const alt = db.prepare('SELECT response FROM processed_actions WHERE save_id = ? AND request_id = ?').get(saveId, requestId) as { response: string } | undefined;
      if (alt) return JSON.parse(alt.response) as GameResponse;
    }
    settle(db, saveId, now);
    const events = aktion() || {};
    const antwort: GameResponse = { state: loadState(db, saveId, now), events };
    if (requestId) {
      db.prepare('INSERT INTO processed_actions (save_id, request_id, response, created_at) VALUES (?, ?, ?, ?)')
        .run(saveId, requestId, JSON.stringify(antwort), now);
      db.prepare('DELETE FROM processed_actions WHERE created_at < ?').run(now - EIN_TAG_MS); // alte Einträge aufräumen
    }
    return antwort;
  });
  return transaktion();
}
