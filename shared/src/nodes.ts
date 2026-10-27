import type { Amounts } from './resources';

// "Nodes" sind Dinge auf der Karte, die dein Bürgermeister abbauen kann.
// Sie belegen ein Feld – wenn du sie abbaust, wird Platz zum Bauen frei.
export interface NodeDef {
  name: string;
  action: string;   // Text auf dem Knopf
  icon: string;
  yield: Amounts;   // so viel gibt es pro Schlag
  hits: number;     // so viele Schläge, bis es weg ist
}

export const NODES = {
  tree: { name: 'Baum', action: 'Fällen', icon: '🪓', yield: { wood: 5 }, hits: 3 },
  rock: { name: 'Felsen', action: 'Abbauen', icon: '⛏️', yield: { stone: 4 }, hits: 4 }
} satisfies Record<string, NodeDef>;

export type NodeType = keyof typeof NODES;

export function isNodeType(value: unknown): value is NodeType {
  return typeof value === 'string' && value in NODES;
}
