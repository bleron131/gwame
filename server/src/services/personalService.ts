import { BUILDINGS, MAX_BAUARBEITER, arbeiterPreis, bauarbeiterPreis, type GameEvents } from '@empire/shared';
import type { DB } from '../db/db';
import { findBuilding, pay } from './buildingService';
import { GameError } from './errors';
import { readSave, stadtWerte } from './saveService';

// Wie viele Einwohner haben noch keine Arbeit?
function freieEinwohner(db: DB, saveId: number, now: number): number {
  const w = stadtWerte(db, saveId, now);
  return w.population - w.angestellte;
}

// Einen Arbeiter in einem Gebäude anstellen: +25 % Produktion, kostet einmalig Gold und 1 Gold Lohn pro Minute
export function arbeiterAnstellen(db: DB, saveId: number, buildingId: unknown, now: number): GameEvents {
  const b = findBuilding(db, saveId, buildingId);
  const plaetze = BUILDINGS[b.type].arbeitsplaetze ?? 0;
  if (!plaetze) throw new GameError('NO_JOBS', `In ${BUILDINGS[b.type].name} gibt es keine Arbeitsplätze.`);
  if ((b.arbeiter ?? 0) >= plaetze) throw new GameError('FULL', 'Alle Arbeitsplätze sind besetzt.');
  if (freieEinwohner(db, saveId, now) < 1) throw new GameError('NO_PEOPLE', 'Alle Einwohner haben schon Arbeit. Bau mehr Wohnhäuser!');
  pay(db, saveId, arbeiterPreis(b.arbeiter ?? 0));
  db.prepare('UPDATE buildings SET arbeiter = arbeiter + 1 WHERE id = ?').run(b.id);
  return {};
}

export function arbeiterEntlassen(db: DB, saveId: number, buildingId: unknown): GameEvents {
  const b = findBuilding(db, saveId, buildingId);
  if (!b.arbeiter) throw new GameError('NO_WORKER', 'Hier arbeitet niemand.');
  db.prepare('UPDATE buildings SET arbeiter = arbeiter - 1 WHERE id = ?').run(b.id);
  return {};
}

// Einen Bauarbeiter anstellen: alle Baustellen werden 30 % schneller (gilt für neue Baustellen)
export function bauarbeiterAnstellen(db: DB, saveId: number, now: number): GameEvents {
  const n = readSave(db, saveId).bauarbeiter;
  if (n >= MAX_BAUARBEITER) throw new GameError('FULL', `Mehr als ${MAX_BAUARBEITER} Bauarbeiter brauchst du nicht.`);
  if (freieEinwohner(db, saveId, now) < 1) throw new GameError('NO_PEOPLE', 'Alle Einwohner haben schon Arbeit. Bau mehr Wohnhäuser!');
  pay(db, saveId, bauarbeiterPreis(n));
  db.prepare('UPDATE game_saves SET bauarbeiter = bauarbeiter + 1 WHERE id = ?').run(saveId);
  return {};
}

export function bauarbeiterEntlassen(db: DB, saveId: number): GameEvents {
  if (readSave(db, saveId).bauarbeiter < 1) throw new GameError('NO_WORKER', 'Du hast keine Bauarbeiter.');
  db.prepare('UPDATE game_saves SET bauarbeiter = bauarbeiter - 1 WHERE id = ?').run(saveId);
  return {};
}
