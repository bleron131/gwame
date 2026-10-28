import type { GameEvents, GameResponse } from '@empire/shared';
import type { DB } from '../db/db';
import { runAction } from './actionRunner';
import { blackjackHalten, blackjackStarten, blackjackTeilen, blackjackVerdoppeln, blackjackZiehen } from './blackjackService';
import { build, demolish, hammer, upgrade } from './buildingService';
import { GameError } from './errors';
import { harvest } from './harvestService';
import { ausruhen, benutzen, einrichten, essen, lesen, umziehen } from './innenService';
import { industrieFreischalten, landKaufen } from './landService';
import { arbeiterAnstellen, arbeiterEntlassen, bauarbeiterAnstellen, bauarbeiterEntlassen } from './personalService';
import { claimQuest } from './questService';
import { startResearch } from './researchService';
import { bestellen } from './shopService';
import { createSave, deleteAllSaves, findSaveId, loadState, settle } from './saveService';

// Alle Aktionen des Spiels an einer Stelle.
// Der Express-Server (routes/game.ts) ruft sie auf – und die GitHub-Pages-Version
// im Browser ruft GENAU DIESELBEN Funktionen auf. So gibt es die Spielregeln nur einmal.

function spielstand(db: DB): number {
  const id = findSaveId(db);
  if (!id) throw new GameError('NO_SAVE', 'Es gibt noch keine Stadt.', 404);
  return id;
}

// Spielstand laden (rechnet vorher die Produktion nach)
export function spielLaden(db: DB, now: number, willkommen: boolean): GameResponse {
  const id = spielstand(db);
  return db.transaction((): GameResponse => {
    const bericht = settle(db, id, now);
    return { state: loadState(db, id, now), offline: willkommen && bericht.seconds >= 60 ? bericht : undefined };
  })();
}

export function stadtGruenden(db: DB, now: number, cityName: unknown, ersetzen: unknown): GameResponse {
  const name = typeof cityName === 'string' ? cityName.trim() : '';
  if (name.length < 1 || name.length > 24) throw new GameError('BAD_NAME', 'Der Name muss 1 bis 24 Zeichen lang sein.');
  if (findSaveId(db) && ersetzen !== true) throw new GameError('SAVE_EXISTS', 'Es gibt schon eine Stadt.', 409);
  const id = db.transaction(() => { deleteAllSaves(db); return createSave(db, name, now); })();
  return { state: loadState(db, id, now) };
}

// Eine Aktion auf dem (einzigen) Spielstand ausführen – sicher in einer Transaktion
function aktion(db: DB, now: number, anfrage: string | undefined, f: (id: number) => GameEvents | void): GameResponse {
  const id = spielstand(db);
  return runAction(db, id, anfrage, now, () => f(id));
}

type Anfrage = string | undefined;

export const gebaeudeBauen = (db: DB, now: number, a: Anfrage, type: unknown, x: unknown, y: unknown, bausatz?: unknown) =>
  aktion(db, now, a, id => build(db, id, type, x, y, now, bausatz === true));
export const gebaeudeVerbessern = (db: DB, now: number, a: Anfrage, gebaeudeId: unknown) => aktion(db, now, a, id => upgrade(db, id, gebaeudeId, now));
export const gebaeudeAbreissen = (db: DB, now: number, a: Anfrage, gebaeudeId: unknown) => aktion(db, now, a, id => demolish(db, id, gebaeudeId, now));
export const mitbauen = (db: DB, now: number, a: Anfrage, gebaeudeId: unknown) => aktion(db, now, a, id => hammer(db, id, gebaeudeId, now));
export const naturAbbauen = (db: DB, now: number, a: Anfrage, nodeId: unknown) => aktion(db, now, a, id => harvest(db, id, nodeId, now));
export const forschungStarten = (db: DB, now: number, a: Anfrage, forschungId: unknown) => aktion(db, now, a, id => startResearch(db, id, forschungId, now));
export const aufgabeAbholen = (db: DB, now: number, a: Anfrage, aufgabeId: unknown) => aktion(db, now, a, id => claimQuest(db, id, aufgabeId, now));

// Personal: Arbeiter in Gebäuden, Bauarbeiter für alle Baustellen
export const arbeiter = (db: DB, now: number, a: Anfrage, gebaeudeId: unknown, mehr: unknown) =>
  aktion(db, now, a, id => (mehr === false ? arbeiterEntlassen(db, id, gebaeudeId) : arbeiterAnstellen(db, id, gebaeudeId, now)));
export const bauarbeiter = (db: DB, now: number, a: Anfrage, mehr: unknown) =>
  aktion(db, now, a, id => (mehr === false ? bauarbeiterEntlassen(db, id) : bauarbeiterAnstellen(db, id, now)));

// Land und Industrie
export const landKauf = (db: DB, now: number, a: Anfrage, px: unknown, py: unknown) => aktion(db, now, a, id => landKaufen(db, id, px, py));
export const industrieKauf = (db: DB, now: number, a: Anfrage) => aktion(db, now, a, id => industrieFreischalten(db, id, now));

// PC-Shop
export const shopBestellen = (db: DB, now: number, a: Anfrage, posten: unknown) => aktion(db, now, a, id => bestellen(db, id, posten, now));

// Blackjack: Einsatz setzen, ziehen, halten, verdoppeln, teilen
export type BlackjackZug = 'ziehen' | 'halten' | 'verdoppeln' | 'teilen';
export const blackjackSpielen = (db: DB, now: number, a: Anfrage, rohstoff: unknown, menge: unknown) =>
  aktion(db, now, a, id => blackjackStarten(db, id, rohstoff, menge, now));
export const blackjackZug = (db: DB, now: number, a: Anfrage, zug: unknown) => aktion(db, now, a, id => {
  if (zug === 'ziehen') return blackjackZiehen(db, id, now);
  if (zug === 'halten') return blackjackHalten(db, id, now);
  if (zug === 'verdoppeln') return blackjackVerdoppeln(db, id, now);
  if (zug === 'teilen') return blackjackTeilen(db, id, now);
  throw new GameError('BAD_MOVE', 'Diesen Spielzug gibt es nicht.');
});

// Drinnen: einrichten, ausruhen, essen, lesen, umziehen, Bauernhof/Bäckerei benutzen
export const moebelStellen = (db: DB, now: number, a: Anfrage, gebaeudeId: unknown, platz: unknown, moebel: unknown) =>
  aktion(db, now, a, id => einrichten(db, id, gebaeudeId, platz, moebel, now));
export type InnenAktion = 'ausruhen' | 'essen' | 'lesen' | 'umziehen' | 'benutzen';
export const innenAktion = (db: DB, now: number, a: Anfrage, gebaeudeId: unknown, was: unknown, outfit?: unknown) => aktion(db, now, a, id => {
  if (was === 'ausruhen') return ausruhen(db, id, gebaeudeId, now);
  if (was === 'essen') return essen(db, id, gebaeudeId, now);
  if (was === 'lesen') return lesen(db, id, gebaeudeId, now);
  if (was === 'umziehen') return umziehen(db, id, gebaeudeId, outfit, now);
  if (was === 'benutzen') return benutzen(db, id, gebaeudeId, now);
  throw new GameError('BAD_ACTION', 'Das kann man hier nicht tun.');
});
