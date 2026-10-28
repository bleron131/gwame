import {
  ABBAU_RUECKGABE, AUSRUHEN, BACKEN, BAUERNHOF_ABFUELLEN, BUILDINGS, ESSEN, LESEN, MOEBEL, isMoebelId, isOutfit, raumFuerHaus,
  wirksamesLevel, type Amounts, type Einrichtung, type GameEvents, type MoebelAktion, type PlacedBuilding, type Stock
} from '@empire/shared';
import type { DB } from '../db/db';
import { findBuilding, pay } from './buildingService';
import { GameError } from './errors';
import { addXp, gutschreiben, readSave, readStock, writeStock } from './saveService';

// Alles, was der Bürgermeister in einem Gebäude tun kann: einrichten, ausruhen, essen, lesen …

function einHaus(db: DB, saveId: number, buildingId: unknown, now: number): PlacedBuilding {
  const b = findBuilding(db, saveId, buildingId);
  if (b.type !== 'house') throw new GameError('NOT_A_HOUSE', 'Das geht nur in einem Wohnhaus.');
  if (wirksamesLevel(b, now) < 1) throw new GameError('UNDER_CONSTRUCTION', 'Das Haus wird noch gebaut.');
  return b;
}

// Hat das Haus ein Möbelstück, mit dem man das tun kann?
function brauchtMoebel(b: PlacedBuilding, aktion: MoebelAktion, text: string) {
  const da = Object.values(b.einrichtung ?? {}).some(id => id && MOEBEL[id].aktion === aktion);
  if (!da) throw new GameError('NO_FURNITURE', text);
}

// Ein Möbelstück auf einen Stellplatz stellen (moebel = null: wegräumen, die Hälfte gibt es zurück)
export function einrichten(db: DB, saveId: number, buildingId: unknown, platzRoh: unknown, moebel: unknown, now: number): GameEvents {
  const b = einHaus(db, saveId, buildingId, now);
  const platz = Number(platzRoh);
  const raum = raumFuerHaus(wirksamesLevel(b, now));
  if (!Number.isInteger(platz) || platz < 0 || platz >= raum.stellplaetze.length) throw new GameError('BAD_SLOT', 'Diesen Platz gibt es nicht.');
  const e: Einrichtung = { ...(b.einrichtung ?? {}) };
  const alt = e[platz];
  let gained: Amounts = {};
  if (moebel === null) {
    if (!alt) throw new GameError('EMPTY_SLOT', 'Hier steht nichts.');
    const zurueck: Amounts = {};
    for (const [r, v] of Object.entries(MOEBEL[alt].kosten)) zurueck[r as keyof Stock] = Math.floor((v ?? 0) * ABBAU_RUECKGABE);
    gained = gutschreiben(db, saveId, zurueck, now);
    delete e[platz];
  } else {
    if (!isMoebelId(moebel)) throw new GameError('UNKNOWN_FURNITURE', 'Dieses Möbelstück gibt es nicht.');
    if (alt) throw new GameError('SLOT_TAKEN', 'Hier steht schon etwas. Räum es zuerst weg.');
    pay(db, saveId, MOEBEL[moebel].kosten);
    e[platz] = moebel;
  }
  db.prepare('UPDATE buildings SET einrichtung = ? WHERE id = ?').run(JSON.stringify(e), b.id);
  return moebel === null ? { gained } : addXp(db, saveId, 5);
}

// Im Bett ausruhen: eine Weile doppelter Ertrag beim Fällen, Abbauen und Mithelfen
export function ausruhen(db: DB, saveId: number, buildingId: unknown, now: number): GameEvents {
  einHaus(db, saveId, buildingId, now);
  db.prepare('UPDATE game_saves SET ausgeruht_bis = ? WHERE id = ?').run(now + AUSRUHEN.minuten * 60_000, saveId);
  return {};
}

// In der Küche essen (kostet Brot): eine Weile schneller laufen
export function essen(db: DB, saveId: number, buildingId: unknown, now: number): GameEvents {
  const b = einHaus(db, saveId, buildingId, now);
  brauchtMoebel(b, 'essen', 'Zum Essen brauchst du eine Küche oder einen Kühlschrank.');
  pay(db, saveId, { bread: ESSEN.brot });
  db.prepare('UPDATE game_saves SET satt_bis = ? WHERE id = ?').run(now + ESSEN.minuten * 60_000, saveId);
  return {};
}

// Ein Buch lesen: bringt Erfahrung (aber nur alle paar Minuten)
export function lesen(db: DB, saveId: number, buildingId: unknown, now: number): GameEvents {
  const b = einHaus(db, saveId, buildingId, now);
  brauchtMoebel(b, 'lesen', 'Zum Lesen brauchst du ein Bücherregal.');
  const warten = readSave(db, saveId).gelesen_am + LESEN.abstandMinuten * 60_000 - now;
  if (warten > 0) throw new GameError('TOO_SOON', `Du hast gerade erst gelesen. Noch ${Math.ceil(warten / 1000)} Sekunden.`);
  db.prepare('UPDATE game_saves SET gelesen_am = ? WHERE id = ?').run(now, saveId);
  return addXp(db, saveId, LESEN.xp);
}

// Am Kleiderschrank umziehen
export function umziehen(db: DB, saveId: number, buildingId: unknown, outfit: unknown, now: number): GameEvents {
  const b = einHaus(db, saveId, buildingId, now);
  brauchtMoebel(b, 'umziehen', 'Zum Umziehen brauchst du einen Kleiderschrank.');
  if (!isOutfit(outfit)) throw new GameError('BAD_OUTFIT', 'Diese Kleidung gibt es nicht.');
  db.prepare('UPDATE game_saves SET outfit = ? WHERE id = ?').run(JSON.stringify(outfit), saveId);
  return {};
}

// Im Bauernhof Getreide abfüllen – in der Bäckerei selbst Brot backen
export function benutzen(db: DB, saveId: number, buildingId: unknown, now: number): GameEvents {
  const b = findBuilding(db, saveId, buildingId);
  const level = wirksamesLevel(b, now);
  if (level < 1) throw new GameError('UNDER_CONSTRUCTION', 'Hier wird noch gebaut.');
  const abstand = b.type === 'farm' ? BAUERNHOF_ABFUELLEN.abstandSekunden : b.type === 'bakery' ? BACKEN.abstandSekunden : 0;
  if (!abstand) throw new GameError('NOTHING_TO_DO', `In ${BUILDINGS[b.type].name} gibt es nichts zu tun.`);
  const warten = (b.aktionAm ?? 0) + abstand * 1000 - now;
  if (warten > 0) throw new GameError('TOO_SOON', `Gleich wieder – noch ${Math.ceil(warten / 1000)} Sekunden.`);
  let gained: Amounts;
  if (b.type === 'farm') {
    gained = gutschreiben(db, saveId, { grain: BAUERNHOF_ABFUELLEN.getreideProLevel * level }, now);
  } else {
    const stock = readStock(db, saveId);
    if (stock.flour < BACKEN.mehl) throw new GameError('NOT_ENOUGH', `Zum Backen brauchst du ${BACKEN.mehl} 🥣 Mehl.`);
    writeStock(db, saveId, { flour: stock.flour - BACKEN.mehl });
    gained = gutschreiben(db, saveId, { bread: BACKEN.brot }, now);
  }
  if (!Object.keys(gained).length) throw new GameError('STORAGE_FULL', 'Dein Lager ist voll!');
  db.prepare('UPDATE buildings SET aktion_am = ? WHERE id = ?').run(now, b.id);
  return { ...addXp(db, saveId, 3), gained };
}

// Ist der Bürgermeister gerade ausgeruht? (für Abbauen und Mithelfen)
export const istAusgeruht = (db: DB, saveId: number, now: number) => readSave(db, saveId).ausgeruht_bis > now;
