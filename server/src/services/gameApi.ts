import type { GameResponse } from '@empire/shared';
import type { DB } from '../db/db';
import { runAction } from './actionRunner';
import { blackjackHalten, blackjackStarten, blackjackVerdoppeln, blackjackZiehen } from './blackjackService';
import { build, demolish, upgrade } from './buildingService';
import { GameError } from './errors';
import { harvest } from './harvestService';
import { claimQuest } from './questService';
import { startResearch } from './researchService';
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

export function gebaeudeBauen(db: DB, now: number, anfrage: string | undefined, type: unknown, x: unknown, y: unknown): GameResponse {
  const id = spielstand(db);
  return runAction(db, id, anfrage, now, () => build(db, id, type, x, y));
}

export function gebaeudeVerbessern(db: DB, now: number, anfrage: string | undefined, gebaeudeId: unknown): GameResponse {
  const id = spielstand(db);
  return runAction(db, id, anfrage, now, () => upgrade(db, id, gebaeudeId));
}

export function gebaeudeAbreissen(db: DB, now: number, anfrage: string | undefined, gebaeudeId: unknown): GameResponse {
  const id = spielstand(db);
  return runAction(db, id, anfrage, now, () => demolish(db, id, gebaeudeId));
}

export function naturAbbauen(db: DB, now: number, anfrage: string | undefined, nodeId: unknown): GameResponse {
  const id = spielstand(db);
  return runAction(db, id, anfrage, now, () => harvest(db, id, nodeId, now));
}

export function forschungStarten(db: DB, now: number, anfrage: string | undefined, forschungId: unknown): GameResponse {
  const id = spielstand(db);
  return runAction(db, id, anfrage, now, () => startResearch(db, id, forschungId, now));
}

export function aufgabeAbholen(db: DB, now: number, anfrage: string | undefined, aufgabeId: unknown): GameResponse {
  const id = spielstand(db);
  return runAction(db, id, anfrage, now, () => claimQuest(db, id, aufgabeId));
}

// Blackjack: Einsatz setzen, ziehen, halten, verdoppeln
export type BlackjackZug = 'ziehen' | 'halten' | 'verdoppeln';
export function blackjackSpielen(db: DB, now: number, anfrage: string | undefined, rohstoff: unknown, menge: unknown): GameResponse {
  const id = spielstand(db);
  return runAction(db, id, anfrage, now, () => blackjackStarten(db, id, rohstoff, menge));
}
export function blackjackZug(db: DB, now: number, anfrage: string | undefined, zug: unknown): GameResponse {
  const id = spielstand(db);
  return runAction(db, id, anfrage, now, () => {
    if (zug === 'ziehen') return blackjackZiehen(db, id);
    if (zug === 'halten') return blackjackHalten(db, id);
    if (zug === 'verdoppeln') return blackjackVerdoppeln(db, id);
    throw new GameError('BAD_MOVE', 'Diesen Spielzug gibt es nicht.');
  });
}
