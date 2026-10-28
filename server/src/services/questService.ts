import { QUESTS, kontextAusState, questFortschritt, type GameEvents } from '@empire/shared';
import type { DB } from '../db/db';
import { GameError } from './errors';
import { addXp, gutschreiben, loadState } from './saveService';

// Die Belohnung für Gretas aktive Aufgabe abholen
export function claimQuest(db: DB, saveId: number, questId: unknown, now: number): GameEvents {
  const state = loadState(db, saveId, now);
  const q = QUESTS[state.aufgabe.nummer];
  if (!q) throw new GameError('NO_QUEST', 'Du hast alle Aufgaben erledigt!');
  if (q.id !== questId) throw new GameError('WRONG_QUEST', 'Diese Aufgabe ist gerade nicht dran.');

  // Ist das Ziel wirklich erreicht? (der Server prüft selbst – dem Browser glauben wir nicht)
  const { aktuell, ziel } = questFortschritt(q, kontextAusState(state));
  if (aktuell < ziel) throw new GameError('NOT_DONE', 'Diese Aufgabe ist noch nicht erledigt.');

  db.prepare(`INSERT INTO quests (save_id, quest_id, progress, completed) VALUES (?, ?, ?, 1)
    ON CONFLICT (save_id, quest_id) DO UPDATE SET completed = 1`).run(saveId, q.id, state.aufgabe.zaehler);
  const gained = gutschreiben(db, saveId, q.belohnung, now);
  return { ...addXp(db, saveId, q.xp), gained };
}
