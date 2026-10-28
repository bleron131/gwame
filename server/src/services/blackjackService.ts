import {
  RESOURCES, auszahlung, bankZiehtFertig, ergebnis, handWert, isRohstoff, istBlackjack, kannTeilen, leereStatistik, maxEinsatz, neuerStapel,
  type BlackjackStand, type BlackjackStatistik, type GameEvents, type Hand, type Karte, type ResourceId
} from '@empire/shared';
import type { DB } from '../db/db';
import { pay } from './buildingService';
import { GameError } from './errors';
import { gutschreiben, readBuildings } from './saveService';

// Eine Runde, wie sie in der Datenbank liegt (mit dem geheimen Stapel)
interface Runde {
  rohstoff: ResourceId;
  haende: Hand[];
  aktiv: number;
  geteilt: boolean;
  bank: Karte[];
  stapel: Karte[];
  laeuft: boolean;
}

function lesen(db: DB, saveId: number): Runde | null {
  const row = db.prepare('SELECT data FROM blackjack_games WHERE save_id = ?').get(saveId) as { data: string } | undefined;
  if (!row) return null;
  const r = JSON.parse(row.data);
  // Alte Runden (vor dem Teilen) hatten nur eine Hand: umbauen
  if (!r.haende) {
    return {
      rohstoff: r.rohstoff, aktiv: 0, geteilt: false, bank: r.bank, stapel: r.stapel ?? [], laeuft: r.laeuft,
      haende: [{ karten: r.spieler, einsatz: r.einsatz, verdoppelt: r.verdoppelt, fertig: !r.laeuft, ergebnis: r.ergebnis, ausgezahlt: r.ausgezahlt }]
    };
  }
  return r as Runde;
}

function schreiben(db: DB, saveId: number, r: Runde): void {
  db.prepare(`INSERT INTO blackjack_games (save_id, data) VALUES (?, ?)
    ON CONFLICT (save_id) DO UPDATE SET data = excluded.data`).run(saveId, JSON.stringify(r));
}

function statistikLesen(db: DB, saveId: number): BlackjackStatistik {
  const row = db.prepare('SELECT data FROM blackjack_stats WHERE save_id = ?').get(saveId) as { data: string } | undefined;
  return row ? { ...leereStatistik(), ...JSON.parse(row.data) } : leereStatistik();
}

// Was der Browser sehen darf (die zweite Karte der Bank ist verdeckt, solange die Runde läuft)
export function blackjackStand(db: DB, saveId: number): BlackjackStand {
  const r = lesen(db, saveId);
  return {
    statistik: statistikLesen(db, saveId),
    runde: r && {
      rohstoff: r.rohstoff, haende: r.haende, aktiv: r.aktiv, geteilt: r.geteilt,
      bank: r.laeuft ? [r.bank[0], null] : r.bank, laeuft: r.laeuft
    }
  };
}

function laufendeRunde(db: DB, saveId: number): Runde {
  const r = lesen(db, saveId);
  if (!r || !r.laeuft) throw new GameError('NO_ROUND', 'Es läuft gerade keine Runde.');
  return r;
}

// Runde beenden: (vielleicht) zieht die Bank, dann wird jede Hand ausgezahlt
function beenden(db: DB, saveId: number, r: Runde, now: number): GameEvents {
  const nochImSpiel = r.haende.some(h => handWert(h.karten).wert <= 21);
  const sofort = !r.geteilt && r.haende.length === 1 && r.haende[0].karten.length === 2 && (istBlackjack(r.haende[0].karten) || istBlackjack(r.bank));
  if (nochImSpiel && !sofort) bankZiehtFertig(r.bank, r.stapel);
  r.laeuft = false;
  const st = statistikLesen(db, saveId);
  let gesamt = 0, eingesetzt = 0;
  for (const h of r.haende) {
    h.fertig = true;
    h.ergebnis = ergebnis(h.karten, r.bank, r.geteilt);
    h.ausgezahlt = auszahlung(h.ergebnis, h.einsatz);
    gesamt += h.ausgezahlt; eingesetzt += h.einsatz;
    if (h.ergebnis === 'blackjack') { st.blackjacks++; st.siege++; }
    else if (h.ergebnis === 'gewonnen') st.siege++;
    else if (h.ergebnis === 'verloren') st.niederlagen++;
    else st.unentschieden++;
  }
  // Gewinne kommen ins Lager – aber nur so viel, wie hineinpasst (Gold ist unbegrenzt)
  const gained = gesamt > 0 ? gutschreiben(db, saveId, { [r.rohstoff]: gesamt }, now) : {};
  const echt = gained[r.rohstoff] ?? 0;
  if (echt < gesamt) { // passt nicht alles ins Lager: die Auszahlung der Hände anpassen
    let rest = echt;
    for (const h of r.haende) { h.ausgezahlt = Math.min(h.ausgezahlt, rest); rest -= h.ausgezahlt; }
  }
  // Statistik
  st.runden++;
  const netto = echt - eingesetzt;
  st.bilanz[r.rohstoff] = (st.bilanz[r.rohstoff] ?? 0) + netto;
  if (netto > 0 && (!st.besterGewinn || (st.besterGewinn.rohstoff === r.rohstoff ? netto > st.besterGewinn.menge : r.rohstoff === 'gold' && st.besterGewinn.rohstoff !== 'gold'))) {
    st.besterGewinn = { menge: netto, rohstoff: r.rohstoff };
  }
  // Bestenliste: die 10 grössten Gewinne (Gold zählt vor Rohstoffen)
  if (netto > 0) {
    st.besteGewinne = [...(st.besteGewinne ?? []), { menge: netto, rohstoff: r.rohstoff, am: now }]
      .sort((a, b) => Number(b.rohstoff === 'gold') - Number(a.rohstoff === 'gold') || b.menge - a.menge)
      .slice(0, 10);
  }
  db.prepare(`INSERT INTO blackjack_stats (save_id, data) VALUES (?, ?) ON CONFLICT (save_id) DO UPDATE SET data = excluded.data`)
    .run(saveId, JSON.stringify(st));
  r.stapel = []; // wird nicht mehr gebraucht
  schreiben(db, saveId, r);
  return { gained };
}

// Zur nächsten Hand – oder die Runde beenden, wenn alle Hände fertig sind
function weiter(db: DB, saveId: number, r: Runde, now: number): GameEvents {
  while (r.aktiv < r.haende.length && r.haende[r.aktiv].fertig) r.aktiv++;
  if (r.aktiv >= r.haende.length) return beenden(db, saveId, r, now);
  const h = r.haende[r.aktiv];
  if (h.karten.length === 1) h.karten.push(r.stapel.pop()!); // nach dem Teilen bekommt die nächste Hand ihre 2. Karte
  if (handWert(h.karten).wert === 21 || (r.geteilt && h.karten[0].rang === 'A')) { h.fertig = true; return weiter(db, saveId, r, now); }
  schreiben(db, saveId, r);
  return {};
}

const neueHand = (karten: Karte[], einsatz: number): Hand => ({ karten, einsatz, verdoppelt: false, fertig: false, ergebnis: null, ausgezahlt: 0 });

// Einsatz setzen und Karten geben
export function blackjackStarten(db: DB, saveId: number, rohstoff: unknown, menge: unknown, now: number, zufall: () => number = Math.random): GameEvents {
  if (!isRohstoff(rohstoff)) throw new GameError('BAD_STAKE', 'Diesen Rohstoff gibt es nicht.');
  const einsatz = Number(menge);
  if (!Number.isInteger(einsatz) || einsatz < 1) throw new GameError('BAD_STAKE', 'Der Einsatz muss mindestens 1 sein.');
  if (lesen(db, saveId)?.laeuft) throw new GameError('BUSY', 'Spiel zuerst die laufende Runde fertig.', 409);
  const hallen = readBuildings(db, saveId).filter(b => b.type === 'casino' && b.level - ((b.bauEnde ?? 0) > now ? 1 : 0) > 0);
  if (!hallen.length) throw new GameError('NO_CASINO', 'Bau zuerst eine Spielhalle (und warte, bis sie fertig ist).');
  const max = maxEinsatz(rohstoff, Math.max(...hallen.map(b => b.level)));
  if (einsatz > max) throw new GameError('TOO_HIGH', `Höchsteinsatz: ${max} ${RESOURCES[rohstoff].icon}. Verbessere die Spielhalle für mehr.`);
  pay(db, saveId, { [rohstoff]: einsatz });

  const stapel = neuerStapel(zufall);
  const spieler = [stapel.pop()!], bank = [stapel.pop()!];
  spieler.push(stapel.pop()!); bank.push(stapel.pop()!);
  const r: Runde = { rohstoff, haende: [neueHand(spieler, einsatz)], aktiv: 0, geteilt: false, bank, stapel, laeuft: true };
  // Hat jemand sofort Blackjack? Dann ist die Runde gleich vorbei.
  if (istBlackjack(spieler) || istBlackjack(bank)) return beenden(db, saveId, r, now);
  schreiben(db, saveId, r);
  return {};
}

// Noch eine Karte
export function blackjackZiehen(db: DB, saveId: number, now: number): GameEvents {
  const r = laufendeRunde(db, saveId);
  const h = r.haende[r.aktiv];
  h.karten.push(r.stapel.pop()!);
  if (handWert(h.karten).wert >= 21) h.fertig = true; // überkauft – oder 21, mehr geht nicht
  return h.fertig ? weiter(db, saveId, r, now) : (schreiben(db, saveId, r), {});
}

// Keine Karte mehr für diese Hand
export function blackjackHalten(db: DB, saveId: number, now: number): GameEvents {
  const r = laufendeRunde(db, saveId);
  r.haende[r.aktiv].fertig = true;
  return weiter(db, saveId, r, now);
}

// Einsatz verdoppeln, genau eine Karte ziehen, dann ist die Hand fertig
export function blackjackVerdoppeln(db: DB, saveId: number, now: number): GameEvents {
  const r = laufendeRunde(db, saveId);
  const h = r.haende[r.aktiv];
  if (h.karten.length !== 2) throw new GameError('NO_DOUBLE', 'Verdoppeln geht nur mit den ersten zwei Karten.');
  pay(db, saveId, { [r.rohstoff]: h.einsatz });
  h.einsatz *= 2;
  h.verdoppelt = true;
  h.karten.push(r.stapel.pop()!);
  h.fertig = true;
  return weiter(db, saveId, r, now);
}

// Teilen: zwei gleiche Karten werden zu zwei Händen, jede mit dem gleichen Einsatz
export function blackjackTeilen(db: DB, saveId: number, now: number): GameEvents {
  const r = laufendeRunde(db, saveId);
  const h = r.haende[r.aktiv];
  if (!kannTeilen(h.karten, r.haende.length)) throw new GameError('NO_SPLIT', 'Teilen geht nur mit zwei Karten vom gleichen Wert.');
  pay(db, saveId, { [r.rohstoff]: h.einsatz });
  const zweite = neueHand([h.karten.pop()!], h.einsatz);
  r.haende.splice(r.aktiv + 1, 0, zweite);
  r.geteilt = true;
  h.karten.push(r.stapel.pop()!);
  // Geteilte Asse bekommen nur je eine Karte
  if (h.karten[0].rang === 'A' || handWert(h.karten).wert === 21) h.fertig = true;
  return weiter(db, saveId, r, now);
}
