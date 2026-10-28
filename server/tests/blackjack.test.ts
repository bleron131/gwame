import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { auszahlung, ergebnis, handWert, neuerStapel, seededRandom, type Karte, type Rang } from '@empire/shared';
import { openDb, type DB } from '../src/db/db';
import { runAction } from '../src/services/actionRunner';
import { blackjackHalten, blackjackStarten, blackjackVerdoppeln, blackjackZiehen } from '../src/services/blackjackService';
import { createSave, loadState, readStock, writeStock } from '../src/services/saveService';

// Karten schnell schreiben: k('A', 'K') = Ass und König
const k = (...r: Rang[]): Karte[] => r.map(rang => ({ rang, farbe: '♠' }));

describe('Blackjack – Regeln', () => {
  it('zählt Hände richtig (Ass = 11 oder 1)', () => {
    expect(handWert(k('A', 'K')).wert).toBe(21);
    expect(handWert(k('A', 'A', '9')).wert).toBe(21);
    expect(handWert(k('K', 'D', '5')).wert).toBe(25);
    expect(handWert(k('A', '6'))).toEqual({ wert: 17, weich: true });
  });
  it('entscheidet und zahlt richtig aus', () => {
    expect(ergebnis(k('A', 'K'), k('10', '9'))).toBe('blackjack');
    expect(ergebnis(k('10', '9'), k('10', '8'))).toBe('gewonnen');
    expect(ergebnis(k('10', '8'), k('10', '8'))).toBe('unentschieden');
    expect(ergebnis(k('10', '6', 'K'), k('10', '6', 'K'))).toBe('verloren'); // wer zuerst überkauft, verliert
    expect([auszahlung('blackjack', 10), auszahlung('gewonnen', 10), auszahlung('unentschieden', 10), auszahlung('verloren', 10)]).toEqual([25, 20, 10, 0]);
  });
  it('ein Stapel hat 6 × 52 Karten und wird gemischt', () => {
    const a = neuerStapel(seededRandom(1)), b = neuerStapel(seededRandom(2));
    expect(a).toHaveLength(312);
    expect(a.filter(x => x.rang === 'A')).toHaveLength(24);
    expect(a.slice(0, 10)).not.toEqual(b.slice(0, 10));
  });
});

describe('Blackjack – am Tisch', () => {
  let db: DB, id: number;
  const jetzt = 1_700_000_000_000;
  // Eine bestimmte Runde hinlegen (der Stapel wird von hinten gezogen)
  const runde = (spieler: Karte[], bank: Karte[], stapel: Karte[], einsatz = 50) =>
    db.prepare('INSERT OR REPLACE INTO blackjack_games (save_id, data) VALUES (?, ?)').run(id, JSON.stringify({
      rohstoff: 'gold', einsatz, spieler, bank, stapel, laeuft: true, verdoppelt: false, ergebnis: null, ausgezahlt: 0
    }));
  const tun = (f: () => unknown) => runAction(db, id, undefined, jetzt, () => { f(); });

  beforeEach(() => {
    db = openDb(':memory:');
    id = createSave(db, 'Spielstadt', jetzt);
    writeStock(db, id, { gold: 1000, wood: 100 });
  });
  afterEach(() => db.close());

  it('ohne Spielhalle geht es nicht, und der Höchsteinsatz gilt', () => {
    expect(() => tun(() => blackjackStarten(db, id, 'gold', 50))).toThrow(/Spielhalle/);
    db.prepare("INSERT INTO buildings (save_id, building_type, x, y, level) VALUES (?, 'casino', 0, 0, 1)").run(id);
    expect(() => tun(() => blackjackStarten(db, id, 'gold', 101))).toThrow(/Höchsteinsatz/);
    expect(() => tun(() => blackjackStarten(db, id, 'wood', 31))).toThrow(/Höchsteinsatz/);
    expect(() => tun(() => blackjackStarten(db, id, 'gold', 0))).toThrow(/mindestens 1/);
    expect(readStock(db, id).gold).toBe(1000); // nichts abgezogen
    // Mit Holz setzen geht auch
    tun(() => blackjackStarten(db, id, 'wood', 30, seededRandom(7)));
    expect(readStock(db, id).wood).toBeLessThanOrEqual(100);
    expect(loadState(db, id, jetzt).blackjack?.rohstoff).toBe('wood');
  });

  it('der Einsatz wird abgezogen und die Karte der Bank ist verdeckt', () => {
    db.prepare("INSERT INTO buildings (save_id, building_type, x, y, level) VALUES (?, 'casino', 0, 0, 1)").run(id);
    // Einen Samen suchen, bei dem niemand sofort Blackjack hat
    let samen = 1;
    for (;; samen++) {
      const s = neuerStapel(seededRandom(samen));
      const sp = [s[s.length - 1], s[s.length - 3]], ba = [s[s.length - 2], s[s.length - 4]];
      if (handWert(sp).wert !== 21 && handWert(ba).wert !== 21) break;
    }
    tun(() => blackjackStarten(db, id, 'gold', 50, seededRandom(samen)));
    const st = loadState(db, id, jetzt);
    expect(st.resources.gold).toBe(950);
    expect(st.blackjack?.laeuft).toBe(true);
    expect(st.blackjack?.spieler).toHaveLength(2);
    expect(st.blackjack?.bank[1]).toBeNull();
    // Während eine Runde läuft, kann man keine neue starten
    expect(() => tun(() => blackjackStarten(db, id, 'gold', 10))).toThrow(/laufende Runde/);
  });

  it('Halten: die Bank zieht bis 17 – hier überkauft sie sich, du gewinnst doppelt', () => {
    runde(k('10', '9'), k('10', '6'), k('K'));
    tun(() => blackjackHalten(db, id));
    const bj = loadState(db, id, jetzt).blackjack!;
    expect(bj.ergebnis).toBe('gewonnen');
    expect(bj.bank).toEqual(k('10', '6', 'K'));
    expect(readStock(db, id).gold).toBe(1000 + 100);
  });

  it('Halten: die Bank kommt auf 21 – Einsatz verloren', () => {
    runde(k('10', '7'), k('10', '6'), k('5'));
    tun(() => blackjackHalten(db, id));
    expect(loadState(db, id, jetzt).blackjack!.ergebnis).toBe('verloren');
    expect(readStock(db, id).gold).toBe(1000);
  });

  it('Ziehen: über 21 = sofort verloren, die Bank zieht nicht mehr', () => {
    runde(k('10', '6'), k('10', '6'), k('5', 'K'));
    tun(() => blackjackZiehen(db, id));
    const bj = loadState(db, id, jetzt).blackjack!;
    expect(bj.ergebnis).toBe('verloren');
    expect(bj.bank).toHaveLength(2);
    expect(() => tun(() => blackjackZiehen(db, id))).toThrow(/keine Runde/);
  });

  it('Verdoppeln: doppelter Einsatz, eine Karte, dann die Bank', () => {
    runde(k('5', '6'), k('10', '7'), k('K'));
    tun(() => blackjackVerdoppeln(db, id));
    const bj = loadState(db, id, jetzt).blackjack!;
    expect(bj.einsatz).toBe(100);
    expect(bj.spieler).toHaveLength(3);
    expect(bj.ergebnis).toBe('gewonnen');
    expect(readStock(db, id).gold).toBe(1000 - 50 + 200); // Einsatz 50 war schon weg, dann nochmal 50, Gewinn 200
  });

  it('Gewinne an Rohstoffen passen nur bis zur Lagergrenze', () => {
    db.prepare('INSERT OR REPLACE INTO blackjack_games (save_id, data) VALUES (?, ?)').run(id, JSON.stringify({
      rohstoff: 'wood', einsatz: 30, spieler: k('10', '9'), bank: k('10', '6'), stapel: k('K'), laeuft: true, verdoppelt: false, ergebnis: null, ausgezahlt: 0
    }));
    writeStock(db, id, { wood: 290 }); // Lager: 300
    tun(() => blackjackHalten(db, id));
    expect(readStock(db, id).wood).toBe(300);
    expect(loadState(db, id, jetzt).blackjack!.ausgezahlt).toBe(10);
  });
});
