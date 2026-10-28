import {
  RESOURCES, auszahlung, bankZiehtFertig, ergebnis, handWert, isRohstoff, istBlackjack, maxEinsatz, neuerStapel,
  type BlackjackSicht, type Ergebnis, type GameEvents, type Karte, type ResourceId
} from '@empire/shared';
import type { DB } from '../db/db';
import { pay } from './buildingService';
import { GameError } from './errors';
import { gutschreiben, readBuildings } from './saveService';

// Eine Runde, wie sie in der Datenbank liegt (mit dem geheimen Stapel)
interface Runde {
  rohstoff: ResourceId;
  einsatz: number;
  spieler: Karte[];
  bank: Karte[];
  stapel: Karte[];
  laeuft: boolean;
  verdoppelt: boolean;
  ergebnis: Ergebnis | null;
  ausgezahlt: number;
}

function lesen(db: DB, saveId: number): Runde | null {
  const row = db.prepare('SELECT data FROM blackjack_games WHERE save_id = ?').get(saveId) as { data: string } | undefined;
  return row ? (JSON.parse(row.data) as Runde) : null;
}

function schreiben(db: DB, saveId: number, r: Runde): void {
  db.prepare(`INSERT INTO blackjack_games (save_id, data) VALUES (?, ?)
    ON CONFLICT (save_id) DO UPDATE SET data = excluded.data`).run(saveId, JSON.stringify(r));
}

// Was der Browser sehen darf (die zweite Karte der Bank ist verdeckt, solange die Runde läuft)
export function blackjackSicht(db: DB, saveId: number): BlackjackSicht | null {
  const r = lesen(db, saveId);
  if (!r) return null;
  return {
    rohstoff: r.rohstoff, einsatz: r.einsatz, spieler: r.spieler,
    bank: r.laeuft ? [r.bank[0], null] : r.bank,
    laeuft: r.laeuft, verdoppelt: r.verdoppelt, ergebnis: r.ergebnis, ausgezahlt: r.ausgezahlt
  };
}

function laufendeRunde(db: DB, saveId: number): Runde {
  const r = lesen(db, saveId);
  if (!r || !r.laeuft) throw new GameError('NO_ROUND', 'Es läuft gerade keine Runde.');
  return r;
}

// Runde beenden: (vielleicht) zieht die Bank, dann wird ausgezahlt
function beenden(db: DB, saveId: number, r: Runde, bankZieht: boolean): GameEvents {
  if (bankZieht) bankZiehtFertig(r.bank, r.stapel);
  r.laeuft = false;
  r.ergebnis = ergebnis(r.spieler, r.bank);
  const betrag = auszahlung(r.ergebnis, r.einsatz);
  // Gewinne kommen ins Lager – aber nur so viel, wie hineinpasst (Gold ist unbegrenzt)
  const gained = betrag > 0 ? gutschreiben(db, saveId, { [r.rohstoff]: betrag }) : {};
  r.ausgezahlt = gained[r.rohstoff] ?? 0;
  r.stapel = []; // wird nicht mehr gebraucht
  schreiben(db, saveId, r);
  return { gained };
}

// Einsatz setzen und Karten geben
export function blackjackStarten(db: DB, saveId: number, rohstoff: unknown, menge: unknown, zufall: () => number = Math.random): GameEvents {
  if (!isRohstoff(rohstoff)) throw new GameError('BAD_STAKE', 'Diesen Rohstoff gibt es nicht.');
  const einsatz = Number(menge);
  if (!Number.isInteger(einsatz) || einsatz < 1) throw new GameError('BAD_STAKE', 'Der Einsatz muss mindestens 1 sein.');
  if (lesen(db, saveId)?.laeuft) throw new GameError('BUSY', 'Spiel zuerst die laufende Runde fertig.', 409);
  const hallen = readBuildings(db, saveId).filter(b => b.type === 'casino');
  if (!hallen.length) throw new GameError('NO_CASINO', 'Bau zuerst eine Spielhalle.');
  const max = maxEinsatz(rohstoff, Math.max(...hallen.map(b => b.level)));
  if (einsatz > max) throw new GameError('TOO_HIGH', `Höchsteinsatz: ${max} ${RESOURCES[rohstoff].icon}. Verbessere die Spielhalle für mehr.`);
  pay(db, saveId, { [rohstoff]: einsatz });

  const stapel = neuerStapel(zufall);
  const r: Runde = {
    rohstoff, einsatz, stapel, laeuft: true, verdoppelt: false, ergebnis: null, ausgezahlt: 0,
    spieler: [stapel.pop()!], bank: [stapel.pop()!]
  };
  r.spieler.push(stapel.pop()!); r.bank.push(stapel.pop()!);
  // Hat jemand sofort Blackjack? Dann ist die Runde gleich vorbei.
  if (istBlackjack(r.spieler) || istBlackjack(r.bank)) return beenden(db, saveId, r, false);
  schreiben(db, saveId, r);
  return {};
}

// Noch eine Karte
export function blackjackZiehen(db: DB, saveId: number): GameEvents {
  const r = laufendeRunde(db, saveId);
  r.spieler.push(r.stapel.pop()!);
  const wert = handWert(r.spieler).wert;
  if (wert > 21) return beenden(db, saveId, r, false); // überkauft: verloren, die Bank muss nicht ziehen
  if (wert === 21) return beenden(db, saveId, r, true); // 21 – mehr geht nicht, automatisch halten
  schreiben(db, saveId, r);
  return {};
}

// Keine Karte mehr – jetzt ist die Bank dran
export function blackjackHalten(db: DB, saveId: number): GameEvents {
  return beenden(db, saveId, laufendeRunde(db, saveId), true);
}

// Einsatz verdoppeln, genau eine Karte ziehen, dann ist die Bank dran
export function blackjackVerdoppeln(db: DB, saveId: number): GameEvents {
  const r = laufendeRunde(db, saveId);
  if (r.spieler.length !== 2) throw new GameError('NO_DOUBLE', 'Verdoppeln geht nur mit den ersten zwei Karten.');
  pay(db, saveId, { [r.rohstoff]: r.einsatz });
  r.einsatz *= 2;
  r.verdoppelt = true;
  r.spieler.push(r.stapel.pop()!);
  return beenden(db, saveId, r, handWert(r.spieler).wert <= 21);
}
