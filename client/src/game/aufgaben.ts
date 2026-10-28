import { QUESTS, kontextAusState, questFortschritt, type GameState, type QuestDef, type Stock } from '@empire/shared';

export interface AufgabeJetzt {
  q: QuestDef;
  aktuell: number;
  ziel: number;
  fertig: boolean;   // Belohnung kann abgeholt werden
}

// Gretas aktive Aufgabe und wie weit sie ist (mit dem live hochzählenden Vorrat)
export function aufgabeJetzt(state: GameState, vorrat: Stock): AufgabeJetzt | null {
  const q = QUESTS[state.aufgabe.nummer];
  if (!q) return null;
  const { aktuell, ziel } = questFortschritt(q, kontextAusState(state, vorrat));
  return { q, aktuell: Math.min(aktuell, ziel), ziel, fertig: aktuell >= ziel };
}
